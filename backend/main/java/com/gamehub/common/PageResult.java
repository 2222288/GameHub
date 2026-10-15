package com.gamehub.common;
import java.util.List;
public record PageResult<T>(List<T> items, long total, long page, long size, long pages) {}
