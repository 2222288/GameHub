package com.gamehub.resource;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gamehub.common.BusinessException;
import com.gamehub.game.GameService;
import com.gamehub.game.entity.GameVersion;
import com.gamehub.game.repository.GameVersionRepository;
import com.gamehub.resource.dto.ReportRequest;
import com.gamehub.resource.dto.ResourceLinkRequest;
import com.gamehub.resource.entity.LinkReport;
import com.gamehub.resource.entity.ResourceLink;
import com.gamehub.resource.entity.ResourceStatus;
import com.gamehub.resource.repository.LinkReportRepository;
import com.gamehub.resource.repository.ResourceLinkRepository;
import com.gamehub.resource.vo.AdminReportVO;
import com.gamehub.resource.vo.AdminResourceLinkVO;
import com.gamehub.resource.vo.PublicResourceLinkVO;
import com.gamehub.resource.vo.ResourceRedirectVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Service
public class ResourceService {
    private static final Logger log = LoggerFactory.getLogger(ResourceService.class);

    private final ResourceLinkRepository links;
    private final LinkReportRepository reports;
    private final GameService games;
    private final StringRedisTemplate redis;
    private final GameVersionRepository versions;
    private final String ipHashSecret;

    public ResourceService(ResourceLinkRepository links, LinkReportRepository reports, GameService games,
                           StringRedisTemplate redis, GameVersionRepository versions,
                           @Value("${gamehub.jwt.secret}") String ipHashSecret) {
        this.links = links;
        this.reports = reports;
        this.games = games;
        this.redis = redis;
        this.versions = versions;
        this.ipHashSecret = ipHashSecret;
    }

    public List<PublicResourceLinkVO> publicLinks(Long gameId) {
        games.getPublishedEntity(gameId);
        return links.selectList(new LambdaQueryWrapper<ResourceLink>()
                        .eq(ResourceLink::getGameId, gameId)
                        .isNull(ResourceLink::getDeletedAt)
                        .orderByAsc(ResourceLink::getSortOrder)
                        .orderByAsc(ResourceLink::getId))
                .stream().map(this::toPublic).toList();
    }

    public ResourceLink get(Long id) {
        ResourceLink r = links.selectById(id);
        if (r == null || r.getDeletedAt() != null) throw new BusinessException(40404, "resource link not found");
        return r;
    }

    @Transactional
    public ResourceLink add(Long gameId, ResourceLinkRequest q) {
        games.getEntity(gameId);
        validateRequest(gameId, q);
        ResourceLink r = new ResourceLink();
        apply(r, q);
        r.setGameId(gameId);
        r.setCreatedAt(LocalDateTime.now());
        r.setUpdatedAt(LocalDateTime.now());
        r.setLastCheckedAt(LocalDateTime.now());
        links.insert(r);
        games.evict(gameId);
        return r;
    }

    @Transactional
    public ResourceLink update(Long id, ResourceLinkRequest q) {
        ResourceLink r = get(id);
        validateRequest(r.getGameId(), q);
        String previousStatus = r.getStatus();
        String previousUrl = r.getUrl();
        apply(r, q);
        if (!java.util.Objects.equals(previousStatus, r.getStatus()) || !java.util.Objects.equals(previousUrl, r.getUrl())) {
            r.setLastCheckedAt(LocalDateTime.now());
        }
        r.setUpdatedAt(LocalDateTime.now());
        links.updateById(r);
        games.evict(r.getGameId());
        return r;
    }

    private void validateRequest(Long gameId, ResourceLinkRequest q) {
        try {
            URI uri = URI.create(q.url().trim());
            String scheme = uri.getScheme();
            if (!("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (Exception e) {
            throw new BusinessException(40016, "resource url must use http or https");
        }

        if (q.gameVersionId() != null) {
            GameVersion version = versions.selectById(q.gameVersionId());
            if (version == null || !gameId.equals(version.getGameId())) {
                throw new BusinessException(40017, "game version does not belong to game");
            }
        }
    }

    private void apply(ResourceLink r, ResourceLinkRequest q) {
        r.setProvider(q.provider().trim());
        r.setUrl(q.url().trim());
        r.setPassword(trimToNull(q.password()));
        r.setVersion(trimToNull(q.version()));
        r.setStatus(q.status());
        r.setSortOrder(q.sortOrder() == null ? 0 : q.sortOrder());
        r.setGameVersionId(q.gameVersionId());
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Transactional
    public void delete(Long id) {
        ResourceLink r = get(id);
        r.setUpdatedAt(LocalDateTime.now());
        links.updateById(r);
        links.deleteById(id);
        games.evict(r.getGameId());
    }

    public ResourceRedirectVO click(Long id) {
        ResourceLink r = get(id);
        games.getPublishedEntity(r.getGameId());
        if (ResourceStatus.DISABLED.name().equals(r.getStatus())) throw new BusinessException(40304, "resource link disabled");
        try {
            redis.opsForValue().increment("game:click:pending:" + r.getGameId());
            redis.opsForValue().increment("stats:clicks:" + java.time.LocalDate.now());
        } catch (RuntimeException e) {
            // Analytics is secondary to delivering an otherwise valid resource link.
            log.warn("Failed to record resource click for linkId={}", id, e);
        }
        return new ResourceRedirectVO(r.getUrl());
    }

    public void report(Long id, ReportRequest q, String ip, String ua) {
        ResourceLink r = get(id);
        games.getPublishedEntity(r.getGameId());
        String hash = hash(ip + ":" + id + ":" + ipHashSecret);
        String key = "report:dedup:" + hash;
        boolean duplicate;
        try {
            Boolean first = redis.opsForValue().setIfAbsent(key, "1", 10, TimeUnit.MINUTES);
            duplicate = Boolean.FALSE.equals(first);
        } catch (RuntimeException e) {
            // Keep report submission available if Redis is temporarily down, while preserving dedup via MySQL.
            duplicate = reports.selectCount(new LambdaQueryWrapper<LinkReport>()
                    .eq(LinkReport::getResourceLinkId, id)
                    .eq(LinkReport::getIpHash, hash)
                    .ge(LinkReport::getCreatedAt, LocalDateTime.now().minusMinutes(10))) > 0;
            log.warn("Redis report dedup unavailable; used MySQL fallback for linkId={}", id, e);
        }
        if (duplicate) throw new BusinessException(42901, "duplicate report too soon");

        LinkReport x = new LinkReport();
        x.setResourceLinkId(id);
        x.setReason(q.reason());
        x.setIpHash(hash);
        x.setUserAgent(ua == null ? "" : ua.substring(0, Math.min(250, ua.length())));
        x.setStatus("PENDING");
        x.setCreatedAt(LocalDateTime.now());
        reports.insert(x);

        long count = reports.selectCount(new LambdaQueryWrapper<LinkReport>()
                .eq(LinkReport::getResourceLinkId, id)
                .eq(LinkReport::getStatus, "PENDING"));
        if (count >= 3 && ResourceStatus.ACTIVE.name().equals(r.getStatus())) {
            r.setStatus(ResourceStatus.BROKEN.name());
            r.setUpdatedAt(LocalDateTime.now());
            links.updateById(r);
            games.evict(r.getGameId());
        }
    }

    private String hash(String s) {
        try {
            byte[] b = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(b);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public List<AdminResourceLinkVO> adminLinksByGame(Long gameId) {
        String gameName = games.getEntity(gameId).getName();
        return links.selectList(new LambdaQueryWrapper<ResourceLink>()
                        .eq(ResourceLink::getGameId, gameId)
                        .isNull(ResourceLink::getDeletedAt)
                        .orderByAsc(ResourceLink::getSortOrder)
                        .orderByAsc(ResourceLink::getId))
                .stream()
                .map(r -> toAdmin(r, gameName))
                .toList();
    }

    public List<AdminResourceLinkVO> adminLinks(String status, String q) {
        LambdaQueryWrapper<ResourceLink> w = new LambdaQueryWrapper<ResourceLink>()
                .isNull(ResourceLink::getDeletedAt)
                .orderByDesc(ResourceLink::getUpdatedAt);
        if (status != null && !status.isBlank()) w.eq(ResourceLink::getStatus, status);
        String keyword = q == null ? "" : q.trim().toLowerCase();
        return links.selectList(w).stream()
                .map(r -> {
                    String name;
                    try { name = games.getEntity(r.getGameId()).getName(); }
                    catch (Exception e) { name = "(deleted game)"; }
                    return toAdmin(r, name);
                })
                .filter(r -> keyword.isEmpty()
                        || contains(r.gameName(), keyword)
                        || contains(r.provider(), keyword)
                        || contains(r.url(), keyword))
                .toList();
    }


    private AdminResourceLinkVO toAdmin(ResourceLink r, String gameName) {
        long count = reports.selectCount(new LambdaQueryWrapper<LinkReport>()
                .eq(LinkReport::getResourceLinkId, r.getId()));
        return new AdminResourceLinkVO(r.getId(), r.getGameId(), r.getGameVersionId(), gameName, r.getProvider(), r.getUrl(), r.getPassword(),
                r.getVersion(), r.getStatus(), r.getSortOrder(), count, r.getLastCheckedAt(), r.getUpdatedAt());
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT));
    }

    public List<AdminReportVO> adminReports(String status) {
        LambdaQueryWrapper<LinkReport> w = new LambdaQueryWrapper<LinkReport>().orderByDesc(LinkReport::getCreatedAt);
        if (status != null && !status.isBlank()) w.eq(LinkReport::getStatus, status);
        return reports.selectList(w).stream().map(r -> {
            ResourceLink link = links.selectById(r.getResourceLinkId());
            Long gid = link == null ? null : link.getGameId();
            String name = "-";
            if (gid != null) {
                try { name = games.getEntity(gid).getName(); }
                catch (Exception ignored) { name = "(deleted game)"; }
            }
            return new AdminReportVO(r.getId(), r.getResourceLinkId(), gid, name,
                    link == null ? "-" : link.getProvider(), r.getReason(), r.getStatus(), r.getCreatedAt(), r.getProcessedAt());
        }).toList();
    }

    @Transactional
    public void processReport(Long reportId) {
        LinkReport r = getReport(reportId);
        r.setStatus("PROCESSED");
        r.setProcessedAt(LocalDateTime.now());
        reports.updateById(r);
    }

    @Transactional
    public void setReportedLinkStatus(Long reportId, String status) {
        validateStatus(status);
        LinkReport report = getReport(reportId);
        ResourceLink link = get(report.getResourceLinkId());
        link.setStatus(status);
        link.setLastCheckedAt(LocalDateTime.now());
        link.setUpdatedAt(LocalDateTime.now());
        links.updateById(link);
        games.evict(link.getGameId());
    }

    @Transactional
    public void deleteReportedLink(Long reportId) {
        LinkReport report = getReport(reportId);
        delete(report.getResourceLinkId());
        if (!"PROCESSED".equals(report.getStatus())) {
            report.setStatus("PROCESSED");
            report.setProcessedAt(LocalDateTime.now());
            reports.updateById(report);
        }
    }

    private LinkReport getReport(Long id) {
        LinkReport r = reports.selectById(id);
        if (r == null) throw new BusinessException(40405, "report not found");
        return r;
    }

    private void validateStatus(String status) {
        try { ResourceStatus.valueOf(status); }
        catch (Exception e) { throw new BusinessException(40015, "invalid resource status"); }
    }

    private PublicResourceLinkVO toPublic(ResourceLink r) {
        return new PublicResourceLinkVO(r.getId(), r.getProvider(), r.getPassword(), r.getVersion(), r.getStatus(),
                r.getSortOrder(), r.getLastCheckedAt(), r.getUpdatedAt());
    }
}
