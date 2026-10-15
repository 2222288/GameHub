package com.gamehub.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CategoryRequest(
        @NotBlank @Size(max = 64) String name,
        @NotBlank @Size(max = 64) @Pattern(regexp = "^[a-z0-9-]+$") String slug,
        @Size(max = 64) String icon,
        @Size(max = 255) String description,
        @NotNull Integer sortOrder,
        @NotNull Boolean enabled
) {}
