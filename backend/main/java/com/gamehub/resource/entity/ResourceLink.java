package com.gamehub.resource.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.LocalDateTime;
@Data @TableName("resource_link") public class ResourceLink { @TableId(type=IdType.AUTO) private Long id; private Long gameId; private Long gameVersionId; private String provider; private String url; private String password; private String version; private String status; private Integer sortOrder; private LocalDateTime lastCheckedAt; private LocalDateTime createdAt; private LocalDateTime updatedAt; private LocalDateTime deletedAt; }
