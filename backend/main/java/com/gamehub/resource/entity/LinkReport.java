package com.gamehub.resource.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.LocalDateTime;
@Data @TableName("link_report") public class LinkReport { @TableId(type=IdType.AUTO) private Long id; private Long resourceLinkId; private String reason; private String ipHash; private String userAgent; private String status; private LocalDateTime createdAt; private LocalDateTime processedAt; }
