-- Only for existing 15.0 databases. Run once; new databases already include these indexes.
ALTER TABLE game ADD INDEX idx_game_public_updated(status,deleted_at,updated_at,id), ADD INDEX idx_game_category_public(category_id,status,deleted_at,updated_at,id);
ALTER TABLE game_platform ADD INDEX idx_gp_filter(platform,game_id);
ALTER TABLE game_language ADD INDEX idx_gl_filter(language,game_id);
ALTER TABLE tag ADD INDEX idx_tag_name(name);
