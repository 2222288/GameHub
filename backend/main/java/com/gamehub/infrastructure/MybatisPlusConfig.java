package com.gamehub.infrastructure;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;import com.baomidou.mybatisplus.annotation.DbType;import org.springframework.context.annotation.*;
@Configuration public class MybatisPlusConfig {@Bean MybatisPlusInterceptor mybatisPlusInterceptor(){MybatisPlusInterceptor x=new MybatisPlusInterceptor();x.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));return x;}}
