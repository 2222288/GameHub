package com.gamehub.resource.vo;

import java.time.LocalDateTime;

public record AdminResourceLinkVO(
        Long id,
        Long gameId,
        Long gameVersionId,
        String gameName,
        String provider,
        String url,
        String password,
        String version,
        String status,
        Integer sortOrder,
        long reportCount,
        LocalDateTime lastCheckedAt,
        LocalDateTime updatedAt
) {}
