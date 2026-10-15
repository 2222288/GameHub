package com.gamehub.game.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.gamehub.game.entity.Game;
import com.gamehub.game.vo.CategoryGameCount;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface GameRepository extends BaseMapper<Game> {
    @Select("SELECT category_id AS categoryId, COUNT(*) AS gameCount FROM game WHERE status = 'PUBLISHED' AND deleted_at IS NULL GROUP BY category_id")
    List<CategoryGameCount> countPublishedByCategory();

    @Select("""
        <script>
        SELECT g.* FROM game g
        WHERE g.status = 'PUBLISHED' AND g.deleted_at IS NULL
        <if test="categoryId != null">AND g.category_id = #{categoryId}</if>
        <if test="tag != null and tag != ''">
          AND EXISTS (SELECT 1 FROM game_tag gt JOIN tag t ON t.id = gt.tag_id
                      WHERE gt.game_id = g.id AND t.name = #{tag})
        </if>
        <if test="platform != null and platform != ''">
          AND EXISTS (SELECT 1 FROM game_platform gp WHERE gp.game_id = g.id AND gp.platform = #{platform})
        </if>
        <if test="language != null and language != ''">
          AND EXISTS (SELECT 1 FROM game_language gl WHERE gl.game_id = g.id AND gl.language = #{language})
        </if>
        <if test="keyword != null and keyword != ''">
          AND (LOCATE(LOWER(#{keyword}), LOWER(g.name)) &gt; 0
            OR LOCATE(LOWER(#{keyword}), LOWER(g.english_name)) &gt; 0
            OR LOCATE(LOWER(#{keyword}), LOWER(g.aliases)) &gt; 0
            OR LOCATE(LOWER(#{keyword}), LOWER(g.summary)) &gt; 0
            OR EXISTS (SELECT 1 FROM category c WHERE c.id = g.category_id AND LOCATE(LOWER(#{keyword}), LOWER(c.name)) &gt; 0)
            OR EXISTS (SELECT 1 FROM game_tag gt JOIN tag t ON t.id = gt.tag_id WHERE gt.game_id = g.id AND LOCATE(LOWER(#{keyword}), LOWER(t.name)) &gt; 0))
        </if>
        ORDER BY
        <choose>
          <when test="sort == 'views'">g.view_count DESC,</when>
          <when test="sort == 'resources'">g.resource_click_count DESC,</when>
          <when test="sort == 'name'">g.name ASC,</when>
          <when test="sort == 'published'">g.published_at DESC,</when>
          <otherwise>g.updated_at DESC,</otherwise>
        </choose>
        g.id DESC
        </script>
        """)
    Page<Game> searchPublished(Page<Game> page, @Param("keyword") String keyword,
                               @Param("categoryId") Long categoryId, @Param("tag") String tag,
                               @Param("platform") String platform, @Param("language") String language,
                               @Param("sort") String sort);
}
