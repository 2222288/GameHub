package com.gamehub.resource.vo;
import java.time.LocalDateTime;
public record AdminReportVO(Long id,Long resourceLinkId,Long gameId,String gameName,String provider,String reason,String status,LocalDateTime createdAt,LocalDateTime processedAt) {}
