package com.gamehub.tag.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;
@Data @TableName("game_tag") public class GameTag { private Long gameId; private Long tagId; }
