package com.gamehub.media;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.util.Iterator;

/** Extracts a reusable perceptual accent colour when a cover is uploaded. */
@Component
public class CoverColorAnalyzer {
    private static final int HUE_BUCKETS = 24;
    private static final int TARGET_LONG_EDGE = 96;

    public ColorProfile analyze(MultipartFile file) {
        try {
            return analyze(file.getInputStream());
        } catch (Exception ignored) {
            return null;
        }
    }

    public ColorProfile analyze(InputStream source) {
        try (ImageInputStream input = ImageIO.createImageInputStream(source)) {
            if (input == null) return null;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) return null;
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                int sample = Math.max(1, Math.max(width, height) / TARGET_LONG_EDGE);
                ImageReadParam param = reader.getDefaultReadParam();
                param.setSourceSubsampling(sample, sample, 0, 0);
                BufferedImage image = reader.read(0, param);
                return image == null ? null : profile(image);
            } finally {
                reader.dispose();
            }
        } catch (Exception ignored) {
            // Unsupported formats still upload and receive a stable fallback hue.
            return null;
        }
    }

    ColorProfile profile(BufferedImage image) {
        Bucket[] buckets = new Bucket[HUE_BUCKETS];
        for (int i = 0; i < buckets.length; i++) buckets[i] = new Bucket();
        Bucket neutral = new Bucket();
        double colourfulWeight = 0;

        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int argb = image.getRGB(x, y);
                double alpha = ((argb >>> 24) & 0xff) / 255.0;
                if (alpha < 0.5) continue;
                double r = ((argb >>> 16) & 0xff) / 255.0;
                double g = ((argb >>> 8) & 0xff) / 255.0;
                double b = (argb & 0xff) / 255.0;
                Oklch colour = toOklch(r, g, b);
                double edgeX = Math.min(x + 1.0, image.getWidth() - x) / (image.getWidth() / 2.0);
                double edgeY = Math.min(y + 1.0, image.getHeight() - y) / (image.getHeight() / 2.0);
                double positionWeight = 0.72 + 0.28 * Math.min(1.0, Math.min(edgeX, edgeY));

                if (colour.lightness < 0.04 || colour.lightness > 0.98 || colour.chroma < 0.025) {
                    // Keep black, white and grey covers in a real neutral group, but damp their
                    // weight so a distinctive coloured subject still wins over a dark backdrop.
                    neutral.add(colour, r, g, b, alpha * positionWeight * 0.12);
                    continue;
                }

                double saturationWeight = Math.min(1.0, colour.chroma / 0.18);
                double lightnessWeight = Math.max(0.2, 1.0 - Math.abs(colour.lightness - 0.56) * 1.35);
                double weight = alpha * (0.2 + 0.8 * saturationWeight) * lightnessWeight * positionWeight;
                int index = Math.min(HUE_BUCKETS - 1, (int) Math.floor(colour.hue / (360.0 / HUE_BUCKETS)));
                buckets[index].add(colour, r, g, b, weight);
                colourfulWeight += weight;
            }
        }

        Bucket winner = buckets[0];
        for (Bucket bucket : buckets) if (bucket.weight > winner.weight) winner = bucket;
        if (winner.weight == 0 && neutral.weight == 0) return null;
        if (winner.weight == 0 || neutral.weight > winner.weight) {
            int red = (int) Math.round(255 * neutral.red / neutral.weight);
            int green = (int) Math.round(255 * neutral.green / neutral.weight);
            int blue = (int) Math.round(255 * neutral.blue / neutral.weight);
            String accent = String.format("#%02x%02x%02x", clamp(red), clamp(green), clamp(blue));
            return new ColorProfile(0, round(neutral.chroma / neutral.weight),
                    round(neutral.lightness / neutral.weight), accent,
                    round(neutral.weight / (neutral.weight + colourfulWeight)));
        }
        double hue = Math.toDegrees(Math.atan2(winner.sin / winner.weight, winner.cos / winner.weight));
        if (hue < 0) hue += 360;
        int red = (int) Math.round(255 * winner.red / winner.weight);
        int green = (int) Math.round(255 * winner.green / winner.weight);
        int blue = (int) Math.round(255 * winner.blue / winner.weight);
        String accent = String.format("#%02x%02x%02x", clamp(red), clamp(green), clamp(blue));
        return new ColorProfile(round(hue), round(winner.chroma / winner.weight),
                round(winner.lightness / winner.weight), accent, round(winner.weight / colourfulWeight));
    }

    private Oklch toOklch(double red, double green, double blue) {
        double r = linear(red), g = linear(green), b = linear(blue);
        double l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        double m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        double s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
        double lRoot = Math.cbrt(l), mRoot = Math.cbrt(m), sRoot = Math.cbrt(s);
        double lightness = 0.2104542553 * lRoot + 0.7936177850 * mRoot - 0.0040720468 * sRoot;
        double a = 1.9779984951 * lRoot - 2.4285922050 * mRoot + 0.4505937099 * sRoot;
        double bb = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.8086757660 * sRoot;
        double chroma = Math.sqrt(a * a + bb * bb);
        double hue = Math.toDegrees(Math.atan2(bb, a));
        if (hue < 0) hue += 360;
        return new Oklch(lightness, chroma, hue);
    }

    private double linear(double value) {
        return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(255, value));
    }

    private double round(double value) {
        return Math.round(value * 10_000.0) / 10_000.0;
    }

    public record ColorProfile(double hue, double chroma, double lightness,
                               String accentColor, double confidence) {}
    private record Oklch(double lightness, double chroma, double hue) {}

    private static final class Bucket {
        double weight;
        double sin;
        double cos;
        double chroma;
        double lightness;
        double red;
        double green;
        double blue;

        void add(Oklch colour, double r, double g, double b, double amount) {
            weight += amount;
            double angle = Math.toRadians(colour.hue);
            sin += Math.sin(angle) * amount;
            cos += Math.cos(angle) * amount;
            chroma += colour.chroma * amount;
            lightness += colour.lightness * amount;
            red += r * amount;
            green += g * amount;
            blue += b * amount;
        }
    }
}
