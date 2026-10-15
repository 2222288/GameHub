package com.gamehub.game.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;
@Data @TableName("game_platform") public class GamePlatform { @TableId(type=IdType.AUTO) private Long id; private Long gameId; private String platform; }
