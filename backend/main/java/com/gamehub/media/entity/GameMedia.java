package com.gamehub.media.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.LocalDateTime;
@Data @TableName("game_media") public class GameMedia { @TableId(type=IdType.AUTO) private Long id; private Long gameId; private String type; private String url; private Integer sortOrder; private LocalDateTime createdAt; }
