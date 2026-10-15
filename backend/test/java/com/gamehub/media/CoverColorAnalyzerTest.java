package com.gamehub.media;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;

import static org.assertj.core.api.Assertions.assertThat;

class CoverColorAnalyzerTest {
    private final CoverColorAnalyzer analyzer = new CoverColorAnalyzer();

    @Test
    void saturatedAccentWinsOverLargeBlackBackground() {
        BufferedImage image = new BufferedImage(60, 90, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(Color.BLACK);
        graphics.fillRect(0, 0, 60, 90);
        graphics.setColor(new Color(220, 28, 38));
        graphics.fillRect(10, 20, 40, 45);
        graphics.dispose();

        CoverColorAnalyzer.ColorProfile profile = analyzer.profile(image);

        assertThat(profile).isNotNull();
        assertThat(profile.hue()).isBetween(15.0, 35.0);
        assertThat(profile.chroma()).isGreaterThan(0.15);
        assertThat(profile.accentColor()).startsWith("#");
    }

    @Test
    void grayscaleCoverProducesNeutralProfile() {
        BufferedImage image = new BufferedImage(40, 60, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(58, 61, 66));
        graphics.fillRect(0, 0, 40, 60);
        graphics.dispose();

        CoverColorAnalyzer.ColorProfile profile = analyzer.profile(image);

        assertThat(profile).isNotNull();
        assertThat(profile.chroma()).isLessThan(0.025);
        assertThat(profile.lightness()).isBetween(0.3, 0.5);
    }
}
