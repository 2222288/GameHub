package com.gamehub.game.vo;

public record WallGameVO(
        Long id,
        String name,
        String slug,
        String coverUrl,
        Double hue,
        Double chroma,
        Double lightness,
        String accentColor,
        Double colorConfidence
) {}
