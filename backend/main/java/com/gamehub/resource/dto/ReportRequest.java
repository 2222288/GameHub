package com.gamehub.resource.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ReportRequest(
        @NotBlank
        @Pattern(regexp = "LINK_BROKEN|PASSWORD_WRONG|CONTENT_WRONG|OTHER")
        String reason
) {}
