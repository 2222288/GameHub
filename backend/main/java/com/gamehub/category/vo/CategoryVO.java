package com.gamehub.category.vo;
public record CategoryVO(Long id,String name,String slug,String icon,String description,Integer sortOrder,Boolean enabled,Long gameCount) {}
