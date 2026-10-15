package com.gamehub.admin.entity;
import com.baomidou.mybatisplus.annotation.*;import lombok.Data;import java.time.LocalDateTime;
@Data @TableName("operation_log") public class OperationLog { @TableId(type=IdType.AUTO) private Long id; private Long adminId; private String operation; private String targetType; private Long targetId; private String ip; private LocalDateTime createdAt; }
