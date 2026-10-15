package com.gamehub.resource.vo;
import java.time.LocalDateTime;
public record PublicResourceLinkVO(Long id,String provider,String password,String version,String status,Integer sortOrder,LocalDateTime lastCheckedAt,LocalDateTime updatedAt) {}
