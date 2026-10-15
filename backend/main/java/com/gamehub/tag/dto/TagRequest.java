package com.gamehub.tag.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record TagRequest(
        @NotBlank @Size(max = 64) String name,
        @NotBlank @Size(max = 64) @Pattern(regexp = "^[a-z0-9-]+$") String slug
) {}
