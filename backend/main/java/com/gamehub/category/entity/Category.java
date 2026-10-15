package com.gamehub.category.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.LocalDateTime;
@Data @TableName("category") public class Category { @TableId(type=IdType.AUTO) private Long id; private String name; private String slug; private String icon; private String description; private Integer sortOrder; private Boolean enabled; private LocalDateTime createdAt; private LocalDateTime updatedAt; }
