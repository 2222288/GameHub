package com.gamehub.game.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;
@Data @TableName("game_requirement") public class GameRequirement { @TableId(type=IdType.AUTO) private Long id; private Long gameId; private String type; private String os; private String cpu; private String gpu; private String memory; private String storage; }
