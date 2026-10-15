ALTER TABLE game
  ADD COLUMN cover_hue DOUBLE NULL AFTER banner_url,
  ADD COLUMN cover_chroma DOUBLE NULL AFTER cover_hue,
  ADD COLUMN cover_lightness DOUBLE NULL AFTER cover_chroma,
  ADD COLUMN cover_accent CHAR(7) NULL AFTER cover_lightness,
  ADD COLUMN cover_color_confidence DOUBLE NULL AFTER cover_accent,
  ADD COLUMN cover_hue_override DOUBLE NULL AFTER cover_color_confidence,
  ADD COLUMN wall_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER cover_hue_override;

CREATE INDEX idx_game_wall
  ON game(status, deleted_at, wall_enabled, updated_at, id);
