package com.gamehub.tag.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.LocalDateTime;
@Data @TableName("tag") public class Tag { @TableId(type=IdType.AUTO) private Long id; private String name; private String slug; private LocalDateTime createdAt; private LocalDateTime updatedAt; }
