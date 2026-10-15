package com.gamehub.search;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gamehub.category.entity.Category;
import com.gamehub.category.repository.CategoryRepository;
import com.gamehub.common.BusinessException;
import com.gamehub.common.PageResult;
import com.gamehub.game.GameService;
import com.gamehub.game.vo.GameCardVO;
import com.gamehub.infrastructure.RedisKeys;
import com.gamehub.search.entity.GameSearchDocument;
import com.gamehub.search.entity.SearchLog;
import com.gamehub.search.repository.SearchLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.query.StringQuery;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SearchService {
    private static final Logger log = LoggerFactory.getLogger(SearchService.class);
    private static final int MAX_KEYWORD_LENGTH = 200;

    private final ElasticsearchOperations es;
    private final GameService games;
    private final CategoryRepository categories;
    private final SearchLogRepository logs;
    private final StringRedisTemplate redis;
    private final ObjectMapper om;

    public SearchService(ElasticsearchOperations es, GameService games, CategoryRepository categories,
                         SearchLogRepository logs, StringRedisTemplate redis, ObjectMapper om) {
        this.es = es;
        this.games = games;
        this.categories = categories;
        this.logs = logs;
        this.redis = redis;
        this.om = om;
    }

    public PageResult<GameCardVO> search(String q, int page, int size, String category, String tag,
                                         String platform, String language, String sort) {
        int safePage = Math.max(1, Math.min(1_000_000, page));
        int safeSize = Math.max(1, Math.min(60, size));
        String keyword = q == null ? "" : q.trim();
        if (keyword.length() > MAX_KEYWORD_LENGTH) {
            throw new BusinessException(40018, "search keyword is too long");
        }

        Category categoryEntity = resolveCategory(category);
        if (category != null && !category.isBlank() && categoryEntity == null) {
            record(keyword, 0);
            return new PageResult<>(List.of(), 0, safePage, safeSize, 0);
        }
        if (keyword.isBlank()) {
            return games.listFiltered(safePage, safeSize, categoryEntity == null ? null : categoryEntity.getId(),
                    tag, platform, language, sort);
        }

        try {
            Map<String, Object> multi = Map.of("multi_match", Map.of(
                    "query", keyword,
                    "fields", List.of("name^8", "aliases^7", "englishName^6", "tags^4", "category^2", "summary^1"),
                    "type", "best_fields",
                    "fuzziness", "AUTO"));
            List<Object> filter = new ArrayList<>();
            if (categoryEntity != null) filter.add(Map.of("term", Map.of("category", categoryEntity.getName())));
            if (tag != null && !tag.isBlank()) filter.add(Map.of("term", Map.of("tags", tag)));
            if (platform != null && !platform.isBlank()) filter.add(Map.of("term", Map.of("platforms", platform)));
            if (language != null && !language.isBlank()) filter.add(Map.of("term", Map.of("languages", language)));

            Map<String, Object> bool = new LinkedHashMap<>();
            bool.put("must", List.of(multi));
            if (!filter.isEmpty()) bool.put("filter", filter);
            String source = om.writeValueAsString(Map.of("bool", bool));
            StringQuery query = new StringQuery(source, PageRequest.of(safePage - 1, safeSize));
            query.setTrackTotalHits(true);
            applyEsSort(query, sort);
            SearchHits<GameSearchDocument> hits = es.search(query, GameSearchDocument.class);
            List<Long> ids = hits.getSearchHits().stream().map(h -> h.getContent().getId()).toList();
            List<GameCardVO> items = games.cardsByIds(ids);

            // If ES contains a stale document, do not expose an inconsistent total/page; use the DB fallback immediately.
            if (items.size() != ids.size()) {
                log.warn("Elasticsearch returned stale game ids; using MySQL search fallback");
                return fallback(keyword, safePage, safeSize, categoryEntity, tag, platform, language, sort);
            }

            record(keyword, (int) Math.min(Integer.MAX_VALUE, hits.getTotalHits()));
            return new PageResult<>(items, hits.getTotalHits(), safePage, safeSize,
                    (hits.getTotalHits() + safeSize - 1) / safeSize);
        } catch (Exception e) {
            log.warn("Elasticsearch search failed; using MySQL fallback", e);
            return fallback(keyword, safePage, safeSize, categoryEntity, tag, platform, language, sort);
        }
    }

    private PageResult<GameCardVO> fallback(String q, int page, int size, Category category, String tag,
                                            String platform, String language, String sort) {
        PageResult<GameCardVO> result = games.searchPublished(q, page, size, category == null ? null : category.getId(),
                tag, platform, language, sort);
        record(q, (int) Math.min(Integer.MAX_VALUE, result.total()));
        return result;
    }

    private void applyEsSort(StringQuery query, String sort) {
        if ("updated".equals(sort)) query.addSort(Sort.by(Sort.Order.desc("updatedAtEpoch")));
        else if ("published".equals(sort)) query.addSort(Sort.by(Sort.Order.desc("publishedAtEpoch")));
        else if ("views".equals(sort)) query.addSort(Sort.by(Sort.Order.desc("viewCount")));
        else if ("resources".equals(sort)) query.addSort(Sort.by(Sort.Order.desc("resourceClickCount")));
        else if ("name".equals(sort)) query.addSort(Sort.by(Sort.Order.asc("nameSort")));
        // relevance/unknown: keep Elasticsearch score order.
    }

    private Category resolveCategory(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            long id = Long.parseLong(value);
            return categories.selectById(id);
        } catch (NumberFormatException ignored) {
            return categories.selectOne(new LambdaQueryWrapper<Category>()
                    .eq(Category::getSlug, value)
                    .or().eq(Category::getName, value)
                    .last("limit 1"));
        }
    }

    private void record(String q, int count) {
        if (q == null || q.isBlank()) return;

        try {
            SearchLog searchLog = new SearchLog();
            searchLog.setKeyword(q);
            searchLog.setResultCount(count);
            searchLog.setCreatedAt(LocalDateTime.now());
            logs.insert(searchLog);
        } catch (RuntimeException e) {
            log.warn("Failed to persist search log for keyword={}", q, e);
        }

        try {
            redis.opsForZSet().incrementScore(RedisKeys.HOT_SEARCH, q, 1);
            String dailyKey = "stats:searches:" + java.time.LocalDate.now();
            redis.opsForValue().increment(dailyKey);
            redis.expire(dailyKey, java.time.Duration.ofDays(30));
        } catch (RuntimeException e) {
            log.warn("Failed to update search analytics for keyword={}", q, e);
        }
    }
}
