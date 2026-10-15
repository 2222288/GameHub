package com.gamehub.game.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RequirementRequest(
        @Pattern(regexp = "MINIMUM|RECOMMENDED") String type,
        @Size(max = 128) String os,
        @Size(max = 255) String cpu,
        @Size(max = 255) String gpu,
        @Size(max = 64) String memory,
        @Size(max = 64) String storage
) {}
