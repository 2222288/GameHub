package com.gamehub.statistics;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gamehub.game.entity.Game;
import com.gamehub.game.repository.GameRepository;
import com.gamehub.infrastructure.RedisKeys;
import com.gamehub.resource.entity.LinkReport;
import com.gamehub.resource.entity.ResourceLink;
import com.gamehub.resource.repository.LinkReportRepository;
import com.gamehub.resource.repository.ResourceLinkRepository;
import com.gamehub.statistics.vo.DashboardVO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class StatisticsService {
    private static final Logger log = LoggerFactory.getLogger(StatisticsService.class);

    private final GameRepository games;
    private final ResourceLinkRepository links;
    private final LinkReportRepository reports;
    private final StringRedisTemplate redis;

    public StatisticsService(GameRepository games, ResourceLinkRepository links,
                             LinkReportRepository reports, StringRedisTemplate redis) {
        this.games = games;
        this.links = links;
        this.reports = reports;
        this.redis = redis;
    }

    public DashboardVO dashboard() {
        long all = games.selectCount(new LambdaQueryWrapper<Game>().ne(Game::getStatus, "DELETED"));
        long published = count("PUBLISHED");
        long draft = count("DRAFT");
        long offline = count("OFFLINE");
        long linkCount = links.selectCount(new LambdaQueryWrapper<ResourceLink>().isNull(ResourceLink::getDeletedAt));
        long broken = links.selectCount(new LambdaQueryWrapper<ResourceLink>()
                .eq(ResourceLink::getStatus, "BROKEN")
                .isNull(ResourceLink::getDeletedAt));

        String day = LocalDate.now().toString();
        long views = redisNumber("stats:views:" + day);
        long clicks = redisNumber("stats:clicks:" + day);
        long searches = redisNumber("stats:searches:" + day);

        List<Map<String, Object>> recent = games.selectList(new LambdaQueryWrapper<Game>()
                        .ne(Game::getStatus, "DELETED")
                        .orderByDesc(Game::getCreatedAt)
                        .last("limit 6"))
                .stream().map(g -> map("id", g.getId(), "name", g.getName(), "status", g.getStatus())).toList();

        List<Map<String, Object>> recentReports = reports.selectList(new LambdaQueryWrapper<LinkReport>()
                        .eq(LinkReport::getStatus, "PENDING")
                        .orderByDesc(LinkReport::getCreatedAt)
                        .last("limit 6"))
                .stream().map(r -> map("id", r.getId(), "reason", r.getReason(), "resourceLinkId", r.getResourceLinkId())).toList();

        List<Map<String, Object>> hot = hotSearches();
        return new DashboardVO(all, published, draft, offline, linkCount, broken,
                views, clicks, searches, recent, recentReports, hot);
    }

    private long count(String status) {
        return games.selectCount(new LambdaQueryWrapper<Game>().eq(Game::getStatus, status));
    }

    private long redisNumber(String key) {
        try {
            String value = redis.opsForValue().get(key);
            if (value == null) return 0;
            return Long.parseLong(value);
        } catch (RuntimeException e) {
            log.warn("Failed to read dashboard Redis counter key={}", key, e);
            return 0;
        }
    }

    private List<Map<String, Object>> hotSearches() {
        try {
            Set<ZSetOperations.TypedTuple<String>> tuples = redis.opsForZSet()
                    .reverseRangeWithScores(RedisKeys.HOT_SEARCH, 0, 5);
            if (tuples == null) return List.of();
            return tuples.stream().map(t -> map("keyword", t.getValue(), "count", t.getScore())).toList();
        } catch (RuntimeException e) {
            log.warn("Failed to read hot searches from Redis", e);
            return List.of();
        }
    }

    private Map<String, Object> map(Object... kv) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) result.put(String.valueOf(kv[i]), kv[i + 1]);
        return result;
    }
}
