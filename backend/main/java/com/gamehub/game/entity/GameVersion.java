package com.gamehub.game.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.*;
@Data @TableName("game_version") public class GameVersion { @TableId(type=IdType.AUTO) private Long id; private Long gameId; private String version; private String releaseNotes; private String fileSize; private LocalDate releaseDate; private Boolean isCurrent; private LocalDateTime createdAt; private LocalDateTime updatedAt; }
