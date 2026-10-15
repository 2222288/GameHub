package com.gamehub.search;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gamehub.category.entity.Category;
import com.gamehub.category.repository.CategoryRepository;
import com.gamehub.game.entity.Game;
import com.gamehub.game.entity.GameLanguage;
import com.gamehub.game.entity.GamePlatform;
import com.gamehub.game.repository.GameLanguageRepository;
import com.gamehub.game.repository.GamePlatformRepository;
import com.gamehub.game.repository.GameRepository;
import com.gamehub.infrastructure.RabbitConfig;
import com.gamehub.search.entity.GameSearchDocument;
import com.gamehub.search.repository.GameSearchRepository;
import com.gamehub.tag.entity.GameTag;
import com.gamehub.tag.entity.Tag;
import com.gamehub.tag.repository.GameTagRepository;
import com.gamehub.tag.repository.TagRepository;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;

@Component
public class SearchIndexConsumer {
    private final GameRepository games;
    private final CategoryRepository categories;
    private final GameTagRepository gameTags;
    private final TagRepository tags;
    private final GamePlatformRepository platforms;
    private final GameLanguageRepository languages;
    private final GameSearchRepository search;

    public SearchIndexConsumer(GameRepository games, CategoryRepository categories, GameTagRepository gameTags,
                               TagRepository tags, GamePlatformRepository platforms, GameLanguageRepository languages,
                               GameSearchRepository search) {
        this.games = games;
        this.categories = categories;
        this.gameTags = gameTags;
        this.tags = tags;
        this.platforms = platforms;
        this.languages = languages;
        this.search = search;
    }

    @RabbitListener(queues = RabbitConfig.QUEUE)
    public void consume(GameIndexEvent event) {
        Game game = games.selectById(event.gameId());
        if (game == null || !"PUBLISHED".equals(game.getStatus())) {
            search.deleteById(event.gameId());
            return;
        }

        Category category = categories.selectById(game.getCategoryId());
        List<Long> tagIds = gameTags.selectList(new LambdaQueryWrapper<GameTag>().eq(GameTag::getGameId, game.getId()))
                .stream().map(GameTag::getTagId).toList();
        List<String> tagNames = tagIds.isEmpty() ? List.of() : tags.selectBatchIds(tagIds).stream().map(Tag::getName).toList();
        List<String> platformNames = platforms.selectList(new LambdaQueryWrapper<GamePlatform>().eq(GamePlatform::getGameId, game.getId()))
                .stream().map(GamePlatform::getPlatform).toList();
        List<String> languageNames = languages.selectList(new LambdaQueryWrapper<GameLanguage>().eq(GameLanguage::getGameId, game.getId()))
                .stream().map(GameLanguage::getLanguage).toList();

        search.save(GameSearchDocument.builder()
                .id(game.getId())
                .name(game.getName())
                .nameSort(game.getName() == null ? "" : game.getName().toLowerCase(Locale.ROOT))
                .englishName(game.getEnglishName())
                .aliases(game.getAliases())
                .summary(game.getSummary())
                .slug(game.getSlug())
                .category(category == null ? null : category.getName())
                .tags(tagNames)
                .platforms(platformNames)
                .languages(languageNames)
                .coverUrl(game.getCoverUrl())
                .updatedAtEpoch(epoch(game.getUpdatedAt()))
                .publishedAtEpoch(epoch(game.getPublishedAt()))
                .viewCount(game.getViewCount() == null ? 0L : game.getViewCount())
                .resourceClickCount(game.getResourceClickCount() == null ? 0L : game.getResourceClickCount())
                .build());
    }

    private Long epoch(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC).toEpochMilli();
    }
}
