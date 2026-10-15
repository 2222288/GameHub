package com.gamehub.category;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gamehub.category.dto.CategoryRequest;
import com.gamehub.category.entity.Category;
import com.gamehub.category.repository.CategoryRepository;
import com.gamehub.category.vo.CategoryVO;
import com.gamehub.common.BusinessException;
import com.gamehub.game.GameEventPublisher;
import com.gamehub.game.entity.Game;
import com.gamehub.game.repository.GameRepository;
import com.gamehub.infrastructure.RedisKeys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.gamehub.game.vo.CategoryGameCount;

@Service
public class CategoryService {
    private static final Logger log = LoggerFactory.getLogger(CategoryService.class);
    private final CategoryRepository repo;
    private final GameRepository games;
    private final StringRedisTemplate redis;
    private final GameEventPublisher events;

    public CategoryService(CategoryRepository repo, GameRepository games, StringRedisTemplate redis, GameEventPublisher events) {
        this.repo = repo;
        this.games = games;
        this.redis = redis;
        this.events = events;
    }

    public List<CategoryVO> publicList() {
        Map<Long, Long> counts = games.countPublishedByCategory().stream()
                .collect(Collectors.toMap(CategoryGameCount::categoryId, CategoryGameCount::gameCount));
        return repo.selectList(new LambdaQueryWrapper<Category>()
                        .eq(Category::getEnabled, true)
                        .orderByAsc(Category::getSortOrder))
                .stream()
                .map(c -> new CategoryVO(c.getId(), c.getName(), c.getSlug(), c.getIcon(), c.getDescription(),
                        c.getSortOrder(), c.getEnabled(),
                        counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    public List<Category> all() {
        return repo.selectList(new LambdaQueryWrapper<Category>().orderByAsc(Category::getSortOrder));
    }

    public Category get(Long id) {
        Category c = repo.selectById(id);
        if (c == null) throw new BusinessException(40402, "category not found");
        return c;
    }

    public Category getBySlug(String slug) {
        Category c = repo.selectOne(new LambdaQueryWrapper<Category>()
                .eq(Category::getSlug, slug)
                .eq(Category::getEnabled, true));
        if (c == null) throw new BusinessException(40402, "category not found");
        return c;
    }

    @Transactional
    public Category save(Long id, CategoryRequest r) {
        Category c = id == null ? new Category() : get(id);
        c.setName(r.name().trim());
        c.setSlug(r.slug().trim());
        c.setIcon(r.icon());
        c.setDescription(r.description());
        c.setSortOrder(r.sortOrder());
        c.setEnabled(r.enabled());
        c.setUpdatedAt(LocalDateTime.now());
        if (id == null) {
            c.setCreatedAt(LocalDateTime.now());
            repo.insert(c);
        } else {
            repo.updateById(c);
            refreshDependentGames(id);
        }
        return c;
    }

    public void delete(Long id) {
        get(id);
        if (games.selectCount(new LambdaQueryWrapper<Game>().eq(Game::getCategoryId, id)) > 0) {
            throw new BusinessException(40902, "category is in use");
        }
        repo.deleteById(id);
    }

    private void refreshDependentGames(Long categoryId) {
        for (Game game : games.selectList(new LambdaQueryWrapper<Game>().eq(Game::getCategoryId, categoryId))) {
            safeEvict(game.getId());
            events.publish("UPDATED", game.getId());
        }
    }
    private void safeEvict(Long gameId) {
        try {
            redis.delete(RedisKeys.gameDetail(gameId));
        } catch (RuntimeException e) {
            log.warn("Failed to evict game detail cache for gameId={}", gameId, e);
        }
    }

}
