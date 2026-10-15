package com.gamehub.statistics;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.gamehub.game.GameEventPublisher;
import com.gamehub.game.entity.Game;
import com.gamehub.game.repository.GameRepository;
import com.gamehub.infrastructure.RedisKeys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Duration;
import java.time.LocalDate;

@Component
public class CounterSyncJob {
    private static final Logger log = LoggerFactory.getLogger(CounterSyncJob.class);
    private final StringRedisTemplate redis;
    private final GameRepository games;
    private final GameEventPublisher events;
    public CounterSyncJob(StringRedisTemplate redis, GameRepository games, GameEventPublisher events) {
        this.redis = redis; this.games = games; this.events = events;
    }
    @Scheduled(fixedDelayString = "${gamehub.statistics.sync-ms:60000}")
    public void sync() {
        syncPattern("game:view:pending:", "view_count", "stats:views:" + LocalDate.now());
        syncPattern("game:click:pending:", "resource_click_count", null);
    }
    private void syncPattern(String prefix, String column, String statKey) {
        // SCAN bounds each Redis iteration; KEYS blocks the server for the entire keyspace.
        try (Cursor<String> cursor = redis.scan(ScanOptions.scanOptions().match(prefix + "*").count(200).build())) {
            while (cursor.hasNext()) {
                try { syncKey(cursor.next(), prefix, column, statKey); }
                catch (RuntimeException e) {log.warn("Counter sync failed for a key; next run will retry remaining counters", e);}
            }
        } catch (Exception e) {
            log.warn("Counter scan unavailable; next run will retry", e);
        }
    }
    private void syncKey(String key, String prefix, String column, String statKey) {
        String raw = redis.opsForValue().getAndDelete(key);
        if (raw == null) return;
        long delta;
        Long gameId;
        try {
            delta = Long.parseLong(raw); gameId = Long.valueOf(key.substring(prefix.length()));
            if (delta <= 0 || gameId <= 0) throw new IllegalArgumentException();
        } catch (RuntimeException e) {log.warn("Ignoring malformed counter key/value: {}={}", key, raw); return;}
        int updated;
        try {
            updated = games.update(null, new UpdateWrapper<Game>().eq("id", gameId).setSql(column + " = " + column + " + " + delta));
        } catch (RuntimeException e) {
            redis.opsForValue().increment(key, delta);
            log.warn("Counter database sync failed for gameId={}, restored {} pending increments", gameId, delta, e);
            return;
        }
        if (updated == 0) return;
        if (statKey != null) {
            try {redis.opsForValue().increment(statKey, delta); redis.expire(statKey, Duration.ofDays(30));}
            catch (RuntimeException e) {log.warn("Daily statistics increment failed for gameId={}", gameId, e);}
        }
        try {redis.delete(RedisKeys.gameDetail(gameId));}
        catch (RuntimeException e) {log.warn("Failed to evict counter-stale cache for gameId={}", gameId, e);}
        events.publish("UPDATED", gameId);
    }
    @Scheduled(cron = "0 0 0 * * *")
    public void resetDailyRankings() {
        try {redis.delete(java.util.List.of(RedisKeys.DAILY_RANKING, RedisKeys.HOT_SEARCH));}
        catch (RuntimeException e) {log.warn("Daily ranking reset unavailable", e);}
    }
}
