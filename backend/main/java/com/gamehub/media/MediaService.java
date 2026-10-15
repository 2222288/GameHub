package com.gamehub.media;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gamehub.common.BusinessException;
import com.gamehub.game.GameEventPublisher;
import com.gamehub.game.entity.Game;
import com.gamehub.game.repository.GameRepository;
import com.gamehub.infrastructure.RedisKeys;
import com.gamehub.media.entity.GameMedia;
import com.gamehub.media.repository.GameMediaRepository;
import io.minio.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaService {
    private static final Logger log = LoggerFactory.getLogger(MediaService.class);
    private static final Set<String> ALLOWED = Set.of("jpg", "jpeg", "png", "webp");

    private final MinioClient minio;
    private final GameMediaRepository repo;
    private final GameRepository games;
    private final StringRedisTemplate redis;
    private final GameEventPublisher events;
    private final CoverColorAnalyzer colorAnalyzer;
    private final String bucket;
    private volatile boolean ready = false;

    public MediaService(MinioClient minio, GameMediaRepository repo, GameRepository games,
                        StringRedisTemplate redis, GameEventPublisher events, CoverColorAnalyzer colorAnalyzer,
                        @Value("${gamehub.minio.bucket}") String bucket) {
        this.minio = minio;
        this.repo = repo;
        this.games = games;
        this.redis = redis;
        this.events = events;
        this.colorAnalyzer = colorAnalyzer;
        this.bucket = bucket;
    }

    @Scheduled(initialDelay = 2000, fixedDelay = 15000)
    public void initialize() {
        if (ready) return;
        try {
            ensureBucket();
            ready = true;
            log.info("MinIO bucket ready: {}", bucket);
        } catch (Exception e) {
            log.warn("MinIO not ready yet: {}", e.getMessage());
        }
    }

    private void ensureBucket() throws Exception {
        if (!minio.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
            minio.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
        String policy = "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"AWS\":[\"*\"]},\"Action\":[\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::" + bucket + "/*\"]}]}";
        minio.setBucketPolicy(SetBucketPolicyArgs.builder().bucket(bucket).config(policy).build());
    }

    public GameMedia upload(Long gameId, String type, MultipartFile file, Integer sort) {
        String original = Optional.ofNullable(file.getOriginalFilename()).orElse("image.webp");
        String ext = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1).toLowerCase() : "";
        if (!ALLOWED.contains(ext)) throw new BusinessException(40012, "unsupported image type");
        if (file.isEmpty()) throw new BusinessException(40011, "empty image");
        if (file.getSize() > 10L * 1024 * 1024) throw new BusinessException(40013, "image too large");
        verifySignature(file, ext);

        Game game = games.selectById(gameId);
        if (game == null) throw new BusinessException(40401, "game not found");
        String folder = switch (type) {
            case "COVER" -> "cover";
            case "BANNER" -> "banner";
            case "SCREENSHOT" -> "screenshots";
            default -> throw new BusinessException(40014, "invalid media type");
        };
        String object = "games/" + game.getSlug() + "/" + folder + "/" + UUID.randomUUID() + "." + ext;
        String contentType = switch (ext) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            default -> "application/octet-stream";
        };
        try {
            ensureBucket();
            ready = true;
            minio.putObject(PutObjectArgs.builder().bucket(bucket).object(object)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(contentType).build());
        } catch (Exception e) {
            log.error("MinIO upload failed for gameId={}, type={}", gameId, type, e);
            throw new BusinessException(50012, "upload failed");
        }

        List<GameMedia> oldSingletons = List.of();
        if ("COVER".equals(type) || "BANNER".equals(type)) {
            oldSingletons = repo.selectList(new LambdaQueryWrapper<GameMedia>()
                    .eq(GameMedia::getGameId, gameId).eq(GameMedia::getType, type));
        }

        String url = "/media/" + bucket + "/" + object;
        GameMedia m = new GameMedia();
        m.setGameId(gameId);
        m.setType(type);
        m.setUrl(url);
        m.setSortOrder(resolveSortOrder(gameId, type, sort));
        m.setCreatedAt(LocalDateTime.now());
        repo.insert(m);

        if ("COVER".equals(type)) {
            game.setCoverUrl(url);
            CoverColorAnalyzer.ColorProfile profile = colorAnalyzer.analyze(file);
            applyCoverProfile(game, profile);
            games.updateById(game);
        } else if ("BANNER".equals(type)) {
            game.setBannerUrl(url);
            games.updateById(game);
        }

        for (GameMedia old : oldSingletons) {
            if (!old.getId().equals(m.getId())) removeMedia(old, false);
        }
        safeEvict(gameId);
        events.publish("UPDATED", gameId);
        return m;
    }

    public CoverColorAnalyzer.ColorProfile reanalyzeCover(Long gameId) {
        Game game = games.selectById(gameId);
        if (game == null) throw new BusinessException(40401, "game not found");
        String prefix = "/media/" + bucket + "/";
        if (game.getCoverUrl() == null || !game.getCoverUrl().startsWith(prefix)) {
            throw new BusinessException(40015, "cover is not managed media");
        }

        CoverColorAnalyzer.ColorProfile profile;
        try (GetObjectResponse source = minio.getObject(GetObjectArgs.builder()
                .bucket(bucket).object(game.getCoverUrl().substring(prefix.length())).build())) {
            profile = colorAnalyzer.analyze(source);
        } catch (Exception e) {
            log.warn("Cover colour analysis failed for gameId={}: {}", gameId, e.getMessage());
            throw new BusinessException(50013, "cover analysis failed");
        }
        if (profile == null) throw new BusinessException(40016, "cover format cannot be analysed");

        applyCoverProfile(game, profile);
        games.updateById(game);
        safeEvict(gameId);
        events.publish("UPDATED", gameId);
        return profile;
    }

    public void delete(Long id) {
        GameMedia m = repo.selectById(id);
        if (m == null) throw new BusinessException(40412, "media not found");
        removeMedia(m, true);
    }

    private void removeMedia(GameMedia m, boolean clearGameReference) {
        String prefix = m.getUrl() != null && m.getUrl().startsWith("/media/" + bucket + "/")
                ? "/media/" + bucket + "/" : "/assets/";
        if (m.getUrl() != null && m.getUrl().startsWith(prefix)) {
            try {
                minio.removeObject(RemoveObjectArgs.builder().bucket(bucket)
                        .object(m.getUrl().substring(prefix.length())).build());
            } catch (Exception e) {
                log.warn("Failed to remove MinIO object {}: {}", m.getUrl(), e.getMessage());
            }
        }
        repo.deleteById(m.getId());
        Game game = games.selectById(m.getGameId());
        if (clearGameReference && game != null) {
            if ("COVER".equals(m.getType()) && java.util.Objects.equals(game.getCoverUrl(), m.getUrl())) {
                game.setCoverUrl(null);
                clearCoverProfile(game);
            }
            if ("BANNER".equals(m.getType()) && java.util.Objects.equals(game.getBannerUrl(), m.getUrl())) game.setBannerUrl(null);
            games.updateById(game);
        }
        safeEvict(m.getGameId());
        if (clearGameReference) events.publish("UPDATED", m.getGameId());
    }

    private void clearCoverProfile(Game game) {
        game.setCoverHue(null);
        game.setCoverChroma(null);
        game.setCoverLightness(null);
        game.setCoverAccent(null);
        game.setCoverColorConfidence(null);
    }

    private void applyCoverProfile(Game game, CoverColorAnalyzer.ColorProfile profile) {
        if (profile == null) {
            clearCoverProfile(game);
            return;
        }
        game.setCoverHue(profile.hue());
        game.setCoverChroma(profile.chroma());
        game.setCoverLightness(profile.lightness());
        game.setCoverAccent(profile.accentColor());
        game.setCoverColorConfidence(profile.confidence());
    }


    private int resolveSortOrder(Long gameId, String type, Integer requested) {
        if (requested != null) return requested;
        if (!"SCREENSHOT".equals(type)) return 0;
        return repo.selectList(new LambdaQueryWrapper<GameMedia>()
                        .eq(GameMedia::getGameId, gameId)
                        .eq(GameMedia::getType, "SCREENSHOT"))
                .stream()
                .map(GameMedia::getSortOrder)
                .filter(java.util.Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private void safeEvict(Long gameId) {
        try {
            redis.delete(RedisKeys.gameDetail(gameId));
        } catch (RuntimeException e) {
            log.warn("Failed to evict game detail cache for gameId={}", gameId, e);
        }
    }

    private void verifySignature(MultipartFile file, String ext) {
        try (InputStream in = file.getInputStream()) {
            byte[] h = in.readNBytes(12);
            boolean ok = switch (ext) {
                case "jpg", "jpeg" -> h.length >= 3 && (h[0] & 0xff) == 0xff && (h[1] & 0xff) == 0xd8 && (h[2] & 0xff) == 0xff;
                case "png" -> h.length >= 8 && (h[0] & 0xff) == 0x89 && h[1] == 0x50 && h[2] == 0x4e && h[3] == 0x47
                        && h[4] == 0x0d && h[5] == 0x0a && h[6] == 0x1a && h[7] == 0x0a;
                case "webp" -> h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                        && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P';
                default -> false;
            };
            if (!ok) throw new BusinessException(40012, "invalid image content");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(40012, "invalid image content");
        }
    }
}
