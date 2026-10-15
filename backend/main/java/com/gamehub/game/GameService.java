package com.gamehub.game;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gamehub.category.entity.Category;
import com.gamehub.category.repository.CategoryRepository;
import com.gamehub.common.BusinessException;
import com.gamehub.common.PageResult;
import com.gamehub.game.dto.GameUpsertRequest;
import com.gamehub.game.dto.RequirementRequest;
import com.gamehub.game.entity.Game;
import com.gamehub.game.entity.GameLanguage;
import com.gamehub.game.entity.GamePlatform;
import com.gamehub.game.entity.GameRequirement;
import com.gamehub.game.entity.GameVersion;
import com.gamehub.game.repository.GameLanguageRepository;
import com.gamehub.game.repository.GamePlatformRepository;
import com.gamehub.game.repository.GameRepository;
import com.gamehub.game.repository.GameRequirementRepository;
import com.gamehub.game.repository.GameVersionRepository;
import com.gamehub.game.vo.GameCardVO;
import com.gamehub.game.vo.GameDetailVO;
import com.gamehub.game.vo.GameRequirementVO;
import com.gamehub.game.vo.WallGameVO;
import com.gamehub.infrastructure.RedisKeys;
import com.gamehub.media.entity.GameMedia;
import com.gamehub.media.repository.GameMediaRepository;
import com.gamehub.media.vo.GameMediaVO;
import com.gamehub.resource.entity.ResourceLink;
import com.gamehub.resource.repository.ResourceLinkRepository;
import com.gamehub.resource.vo.PublicResourceLinkVO;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class GameService {
    private static final Logger log = LoggerFactory.getLogger(GameService.class);
    private static final Set<String> ALLOWED_PLATFORMS = Set.of("Windows", "macOS", "Linux", "VR", "Emulator");
    private static final Set<String> ALLOWED_LANGUAGES = Set.of("简体中文", "繁体中文", "English", "日文", "韩文", "多语言");

    private final GameRepository games;
    private final CategoryRepository categories;
    private final TagRepository tags;
    private final GameTagRepository gameTags;
    private final GamePlatformRepository platforms;
    private final GameLanguageRepository languages;
    private final GameRequirementRepository requirements;
    private final GameVersionRepository gameVersions;
    private final GameMediaRepository media;
    private final ResourceLinkRepository links;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final GameEventPublisher events;

    public GameService(GameRepository games, CategoryRepository categories, TagRepository tags,
                       GameTagRepository gameTags, GamePlatformRepository platforms,
                       GameLanguageRepository languages, GameRequirementRepository requirements,
                       GameVersionRepository gameVersions, GameMediaRepository media,
                       ResourceLinkRepository links, StringRedisTemplate redis,
                       ObjectMapper objectMapper, GameEventPublisher events) {
        this.games = games;
        this.categories = categories;
        this.tags = tags;
        this.gameTags = gameTags;
        this.platforms = platforms;
        this.languages = languages;
        this.requirements = requirements;
        this.gameVersions = gameVersions;
        this.media = media;
        this.links = links;
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    public Game getEntity(Long id) {
        Game game = games.selectById(id);
        if (game == null || "DELETED".equals(game.getStatus())) throw new BusinessException(40401, "game not found");
        return game;
    }

    public Game getPublishedEntity(Long id) {
        Game game = getEntity(id);
        if (!"PUBLISHED".equals(game.getStatus())) throw new BusinessException(40401, "game not found");
        return game;
    }

    public PageResult<GameCardVO> list(long page, long size, Long categoryId, String status, String sort) {
        long safePage = Math.max(1, page);
        long safeSize = Math.max(1, Math.min(60, size));
        Page<Game> request = new Page<>(safePage, safeSize);
        LambdaQueryWrapper<Game> query = new LambdaQueryWrapper<Game>().ne(Game::getStatus, "DELETED");
        if (categoryId != null) query.eq(Game::getCategoryId, categoryId);
        if (status != null && !status.isBlank()) query.eq(Game::getStatus, status);
        else query.eq(Game::getStatus, "PUBLISHED");
        applySort(query, sort);
        Page<Game> result = games.selectPage(request, query);
        return new PageResult<>(cards(result.getRecords()), result.getTotal(), safePage, safeSize, result.getPages());
    }

    public PageResult<GameCardVO> listFiltered(long page, long size, Long categoryId, String tag,
                                               String platform, String language, String sort) {
        return searchPublished(null, page, size, categoryId, tag, platform, language, sort);
    }

    public PageResult<GameCardVO> searchPublished(String keyword, long page, long size, Long categoryId,
                                                 String tag, String platform, String language, String sort) {
        long safePage = Math.max(1, Math.min(1_000_000, page));
        long safeSize = Math.max(1, Math.min(60, size));
        Page<Game> result = games.searchPublished(new Page<>(safePage, safeSize), keyword, categoryId,
                trimToNull(tag), trimToNull(platform), trimToNull(language), sort);
        return new PageResult<>(cards(result.getRecords()), result.getTotal(), safePage, safeSize, result.getPages());
    }

    public PageResult<GameCardVO> adminList(long page, long size, String q, Long categoryId, String status) {
        long safePage = Math.max(1, page);
        long safeSize = Math.max(1, Math.min(100, size));
        Page<Game> request = new Page<>(safePage, safeSize);
        LambdaQueryWrapper<Game> query = new LambdaQueryWrapper<Game>().ne(Game::getStatus, "DELETED");
        if (q != null && !q.isBlank()) {
            String keyword = q.trim();
            query.and(x -> x.like(Game::getName, keyword)
                    .or().like(Game::getEnglishName, keyword)
                    .or().like(Game::getAliases, keyword));
        }
        if (categoryId != null) query.eq(Game::getCategoryId, categoryId);
        if (status != null && !status.isBlank()) query.eq(Game::getStatus, status);
        query.orderByDesc(Game::getUpdatedAt);
        Page<Game> result = games.selectPage(request, query);
        return new PageResult<>(cards(result.getRecords()), result.getTotal(), safePage, safeSize, result.getPages());
    }

    private void applySort(LambdaQueryWrapper<Game> query, String sort) {
        if ("published".equals(sort)) query.orderByDesc(Game::getPublishedAt);
        else if ("views".equals(sort)) query.orderByDesc(Game::getViewCount);
        else if ("resources".equals(sort)) query.orderByDesc(Game::getResourceClickCount);
        else if ("name".equals(sort)) query.orderByAsc(Game::getName);
        else query.orderByDesc(Game::getUpdatedAt);
        query.orderByDesc(Game::getId);
    }

    public List<GameCardVO> latest() {
        return cards(games.selectList(new LambdaQueryWrapper<Game>()
                        .eq(Game::getStatus, "PUBLISHED")
                        .orderByDesc(Game::getUpdatedAt)
                        .orderByDesc(Game::getId)
                        .last("limit 8")));
    }

    public List<WallGameVO> wall(int size) {
        int safeSize = Math.max(12, Math.min(120, size));
        return games.selectList(new LambdaQueryWrapper<Game>()
                        .eq(Game::getStatus, "PUBLISHED")
                        .and(query -> query.eq(Game::getWallEnabled, true).or().isNull(Game::getWallEnabled))
                        .isNotNull(Game::getCoverUrl)
                        .ne(Game::getCoverUrl, "")
                        .orderByDesc(Game::getUpdatedAt)
                        .orderByDesc(Game::getId)
                        .last("limit " + safeSize))
                .stream().map(game -> new WallGameVO(game.getId(), game.getName(), game.getSlug(), game.getCoverUrl(),
                        game.getCoverHueOverride() != null ? game.getCoverHueOverride()
                                : game.getCoverHue() == null ? fallbackHue(game.getName()) : game.getCoverHue(),
                        game.getCoverChroma(), game.getCoverLightness(), game.getCoverAccent(),
                        game.getCoverColorConfidence())).toList();
    }

    private double fallbackHue(String value) {
        int hash = 0;
        for (int i = 0; i < value.length(); i++) hash = (hash + value.charAt(i)) % 360;
        return hash;
    }

    public GameDetailVO detailBySlug(String slug) {
        Game game = games.selectOne(new LambdaQueryWrapper<Game>()
                .eq(Game::getSlug, slug)
                .eq(Game::getStatus, "PUBLISHED"));
        if (game == null) throw new BusinessException(40401, "game not found");
        try {
            redis.opsForValue().increment(RedisKeys.gameView(game.getId()));
            redis.opsForZSet().incrementScore(RedisKeys.DAILY_RANKING, String.valueOf(game.getId()), 1);
        } catch (RuntimeException e) {
            // View analytics must not make an otherwise readable game page unavailable.
            log.warn("Failed to record game view for gameId={}", game.getId(), e);
        }
        return detail(game);
    }

    public GameDetailVO adminDetail(Long id) {
        return detail(getEntity(id));
    }

    public GameDetailVO detail(Game game) {
        String key = RedisKeys.gameDetail(game.getId());
        try {
            String cached = redis.opsForValue().get(key);
            if (cached != null) return objectMapper.readValue(cached, GameDetailVO.class);
        } catch (Exception ignored) {
            // Cache corruption/unavailability should not make the page unavailable.
        }
        GameDetailVO detail = buildDetail(game);
        try {
            redis.opsForValue().set(key, objectMapper.writeValueAsString(detail), 30, TimeUnit.MINUTES);
        } catch (Exception ignored) {
            // Redis is an optimization for this read path.
        }
        return detail;
    }

    private GameDetailVO buildDetail(Game game) {
        Category category = categories.selectById(game.getCategoryId());
        List<Long> tagIds = tagIds(game.getId());
        List<String> tagNames = tagIds.isEmpty() ? List.of() : tags.selectBatchIds(tagIds).stream().map(Tag::getName).toList();
        List<String> platformNames = platforms.selectList(new LambdaQueryWrapper<GamePlatform>().eq(GamePlatform::getGameId, game.getId()))
                .stream().map(GamePlatform::getPlatform).toList();
        List<String> languageNames = languages.selectList(new LambdaQueryWrapper<GameLanguage>().eq(GameLanguage::getGameId, game.getId()))
                .stream().map(GameLanguage::getLanguage).toList();
        List<GameMediaVO> screenshots = media.selectList(new LambdaQueryWrapper<GameMedia>()
                        .eq(GameMedia::getGameId, game.getId())
                        .eq(GameMedia::getType, "SCREENSHOT")
                        .orderByAsc(GameMedia::getSortOrder)
                        .orderByAsc(GameMedia::getId))
                .stream().map(x -> new GameMediaVO(x.getId(), x.getType(), x.getUrl(), x.getSortOrder())).toList();
        List<GameRequirementVO> requirementList = requirements.selectList(new LambdaQueryWrapper<GameRequirement>()
                        .eq(GameRequirement::getGameId, game.getId()))
                .stream().map(x -> new GameRequirementVO(x.getId(), x.getType(), x.getOs(), x.getCpu(), x.getGpu(), x.getMemory(), x.getStorage())).toList();
        List<PublicResourceLinkVO> resourceLinks = links.selectList(new LambdaQueryWrapper<ResourceLink>()
                        .eq(ResourceLink::getGameId, game.getId())
                        .isNull(ResourceLink::getDeletedAt)
                        .orderByAsc(ResourceLink::getSortOrder)
                        .orderByAsc(ResourceLink::getId))
                .stream().map(x -> new PublicResourceLinkVO(x.getId(), x.getProvider(), x.getPassword(), x.getVersion(), x.getStatus(), x.getSortOrder(), x.getLastCheckedAt(), x.getUpdatedAt())).toList();
        GameVersion currentVersion = gameVersions.selectOne(new LambdaQueryWrapper<GameVersion>()
                .eq(GameVersion::getGameId, game.getId())
                .eq(GameVersion::getIsCurrent, true)
                .last("limit 1"));

        return new GameDetailVO(game.getId(), game.getName(), game.getEnglishName(), game.getSlug(), game.getAliases(),
                game.getSummary(), game.getDescription(), game.getDeveloper(), game.getPublisher(), game.getReleaseDate(),
                category == null ? null : category.getName(), game.getCategoryId(), game.getCoverUrl(), game.getBannerUrl(),
                game.getCoverHue(), game.getCoverChroma(), game.getCoverLightness(), game.getCoverAccent(),
                game.getCoverColorConfidence(), game.getCoverHueOverride(), game.getWallEnabled(), game.getCurrentVersion(),
                game.getFileSize(), currentVersion == null ? null : currentVersion.getReleaseDate(),
                currentVersion == null ? null : currentVersion.getReleaseNotes(), game.getStatus(), safe(game.getViewCount()),
                safe(game.getResourceClickCount()), game.getUpdatedAt(), tagNames, tagIds, platformNames, languageNames, screenshots,
                requirementList, resourceLinks);
    }

    public GameCardVO card(Game game) {
        return cards(List.of(game)).get(0);
    }

    /** Fetch related data once per page, preserving the caller's game order. */
    public List<GameCardVO> cards(List<Game> records) {
        if (records.isEmpty()) return List.of();
        List<Long> gameIds = records.stream().map(Game::getId).distinct().toList();
        List<Long> categoryIds = records.stream().map(Game::getCategoryId).filter(Objects::nonNull).distinct().toList();
        Map<Long, Category> categoryById = categoryIds.isEmpty() ? Map.of() : categories.selectBatchIds(categoryIds)
                .stream().collect(Collectors.toMap(Category::getId, x -> x));
        List<GameTag> relations = gameTags.selectList(new LambdaQueryWrapper<GameTag>()
                .in(GameTag::getGameId, gameIds).orderByAsc(GameTag::getTagId));
        List<Long> tagIds = relations.stream().map(GameTag::getTagId).distinct().toList();
        Map<Long, String> tagById = tagIds.isEmpty() ? Map.of() : tags.selectBatchIds(tagIds)
                .stream().collect(Collectors.toMap(Tag::getId, Tag::getName));
        Map<Long, List<String>> tagByGame = new HashMap<>();
        for (GameTag relation : relations) {
            String name = tagById.get(relation.getTagId());
            if (name != null) tagByGame.computeIfAbsent(relation.getGameId(), ignored -> new ArrayList<>()).add(name);
        }
        Map<Long, List<String>> platformByGame = new HashMap<>();
        for (GamePlatform platform : platforms.selectList(new LambdaQueryWrapper<GamePlatform>()
                .in(GamePlatform::getGameId, gameIds).orderByAsc(GamePlatform::getId))) {
            platformByGame.computeIfAbsent(platform.getGameId(), ignored -> new ArrayList<>()).add(platform.getPlatform());
        }
        Map<Long, List<String>> languageByGame = new HashMap<>();
        for (GameLanguage language : languages.selectList(new LambdaQueryWrapper<GameLanguage>()
                .in(GameLanguage::getGameId, gameIds).orderByAsc(GameLanguage::getId))) {
            languageByGame.computeIfAbsent(language.getGameId(), ignored -> new ArrayList<>()).add(language.getLanguage());
        }
        return records.stream().map(game -> {
            Category category = categoryById.get(game.getCategoryId());
            return new GameCardVO(game.getId(), game.getName(), game.getEnglishName(), game.getSlug(), game.getSummary(), game.getCoverUrl(), game.getBannerUrl(),
                    category == null ? null : category.getName(), game.getCurrentVersion(), game.getStatus(), safe(game.getViewCount()),
                    safe(game.getResourceClickCount()), game.getUpdatedAt(), game.getPublishedAt(),
                    tagByGame.getOrDefault(game.getId(), List.of()), platformByGame.getOrDefault(game.getId(), List.of()),
                    languageByGame.getOrDefault(game.getId(), List.of()));
        }).toList();
    }

    private List<Long> tagIds(Long gameId) {
        return gameTags.selectList(new LambdaQueryWrapper<GameTag>().eq(GameTag::getGameId, gameId))
                .stream().map(GameTag::getTagId).toList();
    }

    private List<String> tagNames(Long gameId) {
        List<Long> ids = tagIds(gameId);
        if (ids.isEmpty()) return List.of();
        return tags.selectBatchIds(ids).stream().map(Tag::getName).toList();
    }

    private long safe(Long value) {
        return value == null ? 0 : value;
    }

    @Transactional
    public GameDetailVO create(GameUpsertRequest request) {
        validateRequest(request);
        if (games.selectCount(new LambdaQueryWrapper<Game>().eq(Game::getSlug, request.slug())) > 0) {
            throw new BusinessException(40901, "slug already exists");
        }
        Game game = new Game();
        apply(game, request);
        game.setStatus("DRAFT");
        game.setViewCount(0L);
        game.setResourceClickCount(0L);
        game.setCreatedAt(LocalDateTime.now());
        game.setUpdatedAt(LocalDateTime.now());
        games.insert(game);
        replaceRelations(game.getId(), request);
        syncCurrentVersion(game.getId(), request);
        events.publish("UPDATED", game.getId());
        return buildDetail(game);
    }

    @Transactional
    public GameDetailVO update(Long id, GameUpsertRequest request) {
        validateRequest(request);
        Game game = getEntity(id);
        if (games.selectCount(new LambdaQueryWrapper<Game>().eq(Game::getSlug, request.slug()).ne(Game::getId, id)) > 0) {
            throw new BusinessException(40901, "slug already exists");
        }
        String oldCover = game.getCoverUrl();
        apply(game, request);
        if (!Objects.equals(oldCover, game.getCoverUrl())) clearCoverProfile(game);
        game.setUpdatedAt(LocalDateTime.now());
        games.updateById(game);
        replaceRelations(id, request);
        syncCurrentVersion(id, request);
        evict(id);
        events.publish("UPDATED", id);
        return buildDetail(game);
    }

    private void validateRequest(GameUpsertRequest request) {
        if (categories.selectById(request.categoryId()) == null) {
            throw new BusinessException(40021, "invalid category");
        }

        List<Long> tagIds = request.tagIds() == null ? List.of() : request.tagIds().stream().filter(Objects::nonNull).distinct().toList();
        if (!tagIds.isEmpty() && tags.selectBatchIds(tagIds).size() != tagIds.size()) {
            throw new BusinessException(40022, "invalid tag");
        }

        for (String platform : distinctValues(request.platforms())) {
            if (!ALLOWED_PLATFORMS.contains(platform)) throw new BusinessException(40023, "invalid platform");
        }
        for (String language : distinctValues(request.languages())) {
            if (!ALLOWED_LANGUAGES.contains(language)) throw new BusinessException(40024, "invalid language");
        }

        Set<String> requirementTypes = new HashSet<>();
        if (request.requirements() != null) {
            for (RequirementRequest requirement : request.requirements()) {
                if (requirement == null || requirement.type() == null ||
                        !("MINIMUM".equals(requirement.type()) || "RECOMMENDED".equals(requirement.type()))) {
                    throw new BusinessException(40025, "invalid requirement type");
                }
                if (!requirementTypes.add(requirement.type())) {
                    throw new BusinessException(40026, "duplicate requirement type");
                }
            }
        }
    }

    private void apply(Game game, GameUpsertRequest request) {
        game.setName(request.name().trim());
        game.setEnglishName(trimToNull(request.englishName()));
        game.setSlug(request.slug().trim());
        game.setAliases(trimToNull(request.aliases()));
        game.setSummary(request.summary().trim());
        game.setDescription(request.description());
        game.setDeveloper(trimToNull(request.developer()));
        game.setPublisher(trimToNull(request.publisher()));
        game.setReleaseDate(request.releaseDate());
        game.setCategoryId(request.categoryId());
        game.setCoverUrl(trimToNull(request.coverUrl()));
        game.setBannerUrl(trimToNull(request.bannerUrl()));
        game.setCoverHueOverride(request.coverHueOverride());
        game.setWallEnabled(request.wallEnabled() == null || request.wallEnabled());
        game.setCurrentVersion(trimToNull(request.currentVersion()));
        game.setFileSize(trimToNull(request.fileSize()));
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void clearCoverProfile(Game game) {
        game.setCoverHue(null);
        game.setCoverChroma(null);
        game.setCoverLightness(null);
        game.setCoverAccent(null);
        game.setCoverColorConfidence(null);
    }

    private List<String> distinctValues(List<String> values) {
        if (values == null) return List.of();
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) result.add(value.trim());
        }
        return new ArrayList<>(result);
    }

    private void replaceRelations(Long gameId, GameUpsertRequest request) {
        gameTags.delete(new LambdaQueryWrapper<GameTag>().eq(GameTag::getGameId, gameId));
        if (request.tagIds() != null) {
            for (Long tagId : request.tagIds().stream().filter(Objects::nonNull).distinct().toList()) {
                GameTag relation = new GameTag();
                relation.setGameId(gameId);
                relation.setTagId(tagId);
                gameTags.insert(relation);
            }
        }

        platforms.delete(new LambdaQueryWrapper<GamePlatform>().eq(GamePlatform::getGameId, gameId));
        for (String value : distinctValues(request.platforms())) {
            GamePlatform relation = new GamePlatform();
            relation.setGameId(gameId);
            relation.setPlatform(value);
            platforms.insert(relation);
        }

        languages.delete(new LambdaQueryWrapper<GameLanguage>().eq(GameLanguage::getGameId, gameId));
        for (String value : distinctValues(request.languages())) {
            GameLanguage relation = new GameLanguage();
            relation.setGameId(gameId);
            relation.setLanguage(value);
            languages.insert(relation);
        }

        requirements.delete(new LambdaQueryWrapper<GameRequirement>().eq(GameRequirement::getGameId, gameId));
        if (request.requirements() != null) {
            for (RequirementRequest source : request.requirements()) {
                GameRequirement target = new GameRequirement();
                target.setGameId(gameId);
                target.setType(source.type());
                target.setOs(source.os());
                target.setCpu(source.cpu());
                target.setGpu(source.gpu());
                target.setMemory(source.memory());
                target.setStorage(source.storage());
                requirements.insert(target);
            }
        }
    }

    private void syncCurrentVersion(Long gameId, GameUpsertRequest request) {
        List<GameVersion> all = versions(gameId);
        for (GameVersion version : all) {
            if (Boolean.TRUE.equals(version.getIsCurrent())) {
                version.setIsCurrent(false);
                version.setUpdatedAt(LocalDateTime.now());
                gameVersions.updateById(version);
            }
        }

        String currentVersion = trimToNull(request.currentVersion());
        if (currentVersion == null) return;
        GameVersion version = gameVersions.selectOne(new LambdaQueryWrapper<GameVersion>()
                .eq(GameVersion::getGameId, gameId)
                .eq(GameVersion::getVersion, currentVersion));
        if (version == null) {
            version = new GameVersion();
            version.setGameId(gameId);
            version.setVersion(currentVersion);
            version.setCreatedAt(LocalDateTime.now());
        }
        version.setReleaseNotes(request.versionNotes());
        version.setFileSize(trimToNull(request.fileSize()));
        version.setReleaseDate(request.versionUpdateDate());
        version.setIsCurrent(true);
        version.setUpdatedAt(LocalDateTime.now());
        if (version.getId() == null) gameVersions.insert(version);
        else gameVersions.updateById(version);
    }

    private List<GameVersion> versions(Long gameId) {
        return gameVersions.selectList(new LambdaQueryWrapper<GameVersion>().eq(GameVersion::getGameId, gameId));
    }

    @Transactional
    public void publish(Long id) {
        Game game = getEntity(id);
        game.setStatus("PUBLISHED");
        game.setPublishedAt(LocalDateTime.now());
        game.setUpdatedAt(LocalDateTime.now());
        games.updateById(game);
        evict(id);
        events.publish("PUBLISHED", id);
    }

    @Transactional
    public void offline(Long id) {
        Game game = getEntity(id);
        game.setStatus("OFFLINE");
        game.setUpdatedAt(LocalDateTime.now());
        games.updateById(game);
        evict(id);
        events.publish("UPDATED", id);
    }

    @Transactional
    public void delete(Long id) {
        Game game = getEntity(id);
        game.setStatus("DELETED");
        game.setUpdatedAt(LocalDateTime.now());
        games.updateById(game);
        games.deleteById(id);
        evict(id);
        events.publish("DELETED", id);
    }

    public void evict(Long id) {
        try {
            redis.delete(RedisKeys.gameDetail(id));
        } catch (RuntimeException e) {
            // Cache eviction is best-effort; database writes must remain authoritative.
            log.warn("Failed to evict game detail cache for gameId={}", id, e);
        }
    }

    public List<GameCardVO> cardsByIds(List<Long> ids) {
        if (ids.isEmpty()) return List.of();
        Map<Long, Game> byId = new HashMap<>();
        for (Game game : games.selectBatchIds(ids)) {
            if ("PUBLISHED".equals(game.getStatus())) byId.put(game.getId(), game);
        }
        return cards(ids.stream().map(byId::get).filter(Objects::nonNull).toList());
    }

    public List<Game> publishedAll() {
        return games.selectList(new LambdaQueryWrapper<Game>().eq(Game::getStatus, "PUBLISHED"));
    }
}
