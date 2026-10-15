package com.gamehub.game.vo;

import com.gamehub.media.vo.GameMediaVO;
import com.gamehub.resource.vo.PublicResourceLinkVO;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record GameDetailVO(
        Long id,
        String name,
        String englishName,
        String slug,
        String aliases,
        String summary,
        String description,
        String developer,
        String publisher,
        LocalDate releaseDate,
        String category,
        Long categoryId,
        String coverUrl,
        String bannerUrl,
        Double coverHue,
        Double coverChroma,
        Double coverLightness,
        String coverAccent,
        Double coverColorConfidence,
        Double coverHueOverride,
        Boolean wallEnabled,
        String currentVersion,
        String fileSize,
        LocalDate versionUpdateDate,
        String versionNotes,
        String status,
        Long viewCount,
        Long resourceClickCount,
        LocalDateTime updatedAt,
        List<String> tags,
        List<Long> tagIds,
        List<String> platforms,
        List<String> languages,
        List<GameMediaVO> screenshots,
        List<GameRequirementVO> requirements,
        List<PublicResourceLinkVO> resourceLinks
) {}
