package com.gamehub.game.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.time.LocalDate;
import java.util.List;

public record GameUpsertRequest(
        @NotBlank @Size(max = 128) String name,
        @Size(max = 128) String englishName,
        @NotBlank @Size(max = 160) @Pattern(regexp = "^[a-z0-9-]+$") String slug,
        @Size(max = 500) String aliases,
        @NotBlank @Size(max = 500) String summary,
        @Size(max = 60000) String description,
        @Size(max = 128) String developer,
        @Size(max = 128) String publisher,
        LocalDate releaseDate,
        @NotNull @Positive Long categoryId,
        @Size(max = 500) String coverUrl,
        @Size(max = 500) String bannerUrl,
        @DecimalMin("0.0") @DecimalMax("359.9999") Double coverHueOverride,
        Boolean wallEnabled,
        @Size(max = 64) String currentVersion,
        @Size(max = 64) String fileSize,
        LocalDate versionUpdateDate,
        @Size(max = 60000) String versionNotes,
        @Size(max = 100) List<Long> tagIds,
        @Size(max = 10) List<String> platforms,
        @Size(max = 10) List<String> languages,
        @Size(max = 2) List<@Valid RequirementRequest> requirements
) {}
