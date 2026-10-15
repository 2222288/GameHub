package com.gamehub.game;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gamehub.category.entity.Category;
import com.gamehub.category.repository.CategoryRepository;
import com.gamehub.game.entity.*;
import com.gamehub.game.repository.*;
import com.gamehub.media.repository.GameMediaRepository;
import com.gamehub.resource.repository.ResourceLinkRepository;
import com.gamehub.tag.entity.GameTag;
import com.gamehub.tag.entity.Tag;
import com.gamehub.tag.repository.GameTagRepository;
import com.gamehub.tag.repository.TagRepository;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GameServiceBatchTest {
    private final GameRepository games = mock(GameRepository.class);
    private final CategoryRepository categories = mock(CategoryRepository.class);
    private final TagRepository tags = mock(TagRepository.class);
    private final GameTagRepository relations = mock(GameTagRepository.class);
    private final GamePlatformRepository platforms = mock(GamePlatformRepository.class);
    private final GameLanguageRepository languages = mock(GameLanguageRepository.class);
    private GameService service;
    @BeforeEach void setup() {
        var assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "test");
        assistant.setCurrentNamespace("test");
        for (Class<?> type : List.of(Game.class,Category.class,Tag.class,GameTag.class,GamePlatform.class,GameLanguage.class)) TableInfoHelper.initTableInfo(assistant,type);
        service = new GameService(games,categories,tags,relations,platforms,languages,
                mock(GameRequirementRepository.class),mock(GameVersionRepository.class),mock(GameMediaRepository.class),
                mock(ResourceLinkRepository.class),mock(StringRedisTemplate.class),new ObjectMapper(),mock(GameEventPublisher.class));
    }
    @Test void emptyPageDoesNotQueryRelations() {
        assertTrue(service.cards(List.of()).isEmpty());
        verifyNoInteractions(games,categories,tags,relations,platforms,languages);
    }
    @Test void twentyCardsRequireOnlyFiveRelationQueriesAndPreserveOrder() {
        List<Game> records = new ArrayList<>(); List<GameTag> joins = new ArrayList<>();
        List<GamePlatform> platformRows = new ArrayList<>(); List<GameLanguage> languageRows = new ArrayList<>();
        for (long id=20;id>=1;id--) {
            Game game=new Game();game.setId(id);game.setName("Game "+id);game.setCategoryId(1L);game.setStatus("PUBLISHED");game.setBannerUrl("/media/banner-"+id+".jpg");records.add(game);
            GameTag join=new GameTag();join.setGameId(id);join.setTagId(1L);joins.add(join);
            GamePlatform platform=new GamePlatform();platform.setId(id);platform.setGameId(id);platform.setPlatform("Windows");platformRows.add(platform);
            GameLanguage language=new GameLanguage();language.setId(id);language.setGameId(id);language.setLanguage("English");languageRows.add(language);
        }
        Category category=new Category();category.setId(1L);category.setName("PC");
        Tag tag=new Tag();tag.setId(1L);tag.setName("RPG");
        when(categories.selectBatchIds(anyCollection())).thenReturn(List.of(category));
        when(relations.selectList(any())).thenReturn(joins); when(tags.selectBatchIds(anyCollection())).thenReturn(List.of(tag));
        when(platforms.selectList(any())).thenReturn(platformRows); when(languages.selectList(any())).thenReturn(languageRows);
        var cards=service.cards(records);
        assertEquals(records.stream().map(Game::getId).toList(),cards.stream().map(x->x.id()).toList());
        assertEquals(records.stream().map(Game::getBannerUrl).toList(),cards.stream().map(x->x.bannerUrl()).toList());
        assertTrue(cards.stream().allMatch(x->x.tags().equals(List.of("RPG")) && x.platforms().equals(List.of("Windows")) && x.languages().equals(List.of("English")) && x.category().equals("PC")));
        verify(categories,times(1)).selectBatchIds(anyCollection()); verify(tags,times(1)).selectBatchIds(anyCollection());
        verify(relations,times(1)).selectList(any()); verify(platforms,times(1)).selectList(any());verify(languages,times(1)).selectList(any());
        verify(categories,never()).selectById(any()); verifyNoInteractions(games);
    }
}
