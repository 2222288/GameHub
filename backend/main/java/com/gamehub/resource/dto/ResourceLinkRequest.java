package com.gamehub.resource.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

public record ResourceLinkRequest(
        @NotBlank @Size(max = 64) String provider,
        @NotBlank @Size(max = 1000) @URL String url,
        @Size(max = 64) String password,
        @Size(max = 64) String version,
        @NotBlank @Pattern(regexp = "ACTIVE|UNKNOWN|BROKEN|DISABLED") String status,
        Integer sortOrder,
        Long gameVersionId
) {}
