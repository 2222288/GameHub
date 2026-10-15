package com.gamehub.tag;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gamehub.common.BusinessException;
import com.gamehub.game.GameEventPublisher;
import com.gamehub.infrastructure.RedisKeys;
import com.gamehub.tag.dto.TagRequest;
import com.gamehub.tag.entity.GameTag;
import com.gamehub.tag.entity.Tag;
import com.gamehub.tag.repository.GameTagRepository;
import com.gamehub.tag.repository.TagRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TagService {
    private static final Logger log = LoggerFactory.getLogger(TagService.class);
    private final TagRepository repo;
    private final GameTagRepository gameTags;
    private final StringRedisTemplate redis;
    private final GameEventPublisher events;

    public TagService(TagRepository repo, GameTagRepository gameTags, StringRedisTemplate redis, GameEventPublisher events) {
        this.repo = repo;
        this.gameTags = gameTags;
        this.redis = redis;
        this.events = events;
    }

    public List<Tag> list(String q) {
        LambdaQueryWrapper<Tag> w = new LambdaQueryWrapper<Tag>().orderByAsc(Tag::getName);
        if (q != null && !q.isBlank()) w.like(Tag::getName, q.trim());
        return repo.selectList(w);
    }

    public Tag get(Long id) {
        Tag t = repo.selectById(id);
        if (t == null) throw new BusinessException(40403, "tag not found");
        return t;
    }

    @Transactional
    public Tag save(Long id, TagRequest r) {
        Tag t = id == null ? new Tag() : get(id);
        List<Long> affectedGameIds = id == null ? List.of() : gameTags.selectList(
                        new LambdaQueryWrapper<GameTag>().eq(GameTag::getTagId, id))
                .stream().map(GameTag::getGameId).distinct().toList();

        t.setName(r.name().trim());
        t.setSlug(r.slug().trim());
        t.setUpdatedAt(LocalDateTime.now());
        if (id == null) {
            t.setCreatedAt(LocalDateTime.now());
            repo.insert(t);
        } else {
            repo.updateById(t);
            for (Long gameId : affectedGameIds) {
                safeEvict(gameId);
                events.publish("UPDATED", gameId);
            }
        }
        return t;
    }

    public void delete(Long id) {
        get(id);
        if (gameTags.selectCount(new LambdaQueryWrapper<GameTag>().eq(GameTag::getTagId, id)) > 0) {
            throw new BusinessException(40903, "tag is in use");
        }
        repo.deleteById(id);
    }
    private void safeEvict(Long gameId) {
        try {
            redis.delete(RedisKeys.gameDetail(gameId));
        } catch (RuntimeException e) {
            log.warn("Failed to evict game detail cache for gameId={}", gameId, e);
        }
    }

}
