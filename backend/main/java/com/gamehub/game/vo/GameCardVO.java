package com.gamehub.game.vo;

import java.time.LocalDateTime;
import java.util.List;

public record GameCardVO(
        Long id,
        String name,
        String englishName,
        String slug,
        String summary,
        String coverUrl,
        String bannerUrl,
        String category,
        String currentVersion,
        String status,
        Long viewCount,
        Long resourceClickCount,
        LocalDateTime updatedAt,
        LocalDateTime publishedAt,
        List<String> tags,
        List<String> platforms,
        List<String> languages
) {}
