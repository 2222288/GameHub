package com.gamehub.admin.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.LocalDateTime;
@Data @TableName("admin_user") public class AdminUser { @TableId(type=IdType.AUTO) private Long id; private String username; private String passwordHash; private Boolean enabled; private LocalDateTime createdAt; private LocalDateTime updatedAt; }
