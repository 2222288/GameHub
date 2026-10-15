package com.gamehub.infrastructure;

import com.gamehub.admin.AdminOperationLogInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final AdminOperationLogInterceptor adminOperationLogInterceptor;

    public WebConfig(AdminOperationLogInterceptor adminOperationLogInterceptor) {
        this.adminOperationLogInterceptor = adminOperationLogInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminOperationLogInterceptor).addPathPatterns("/api/v1/admin/**");
    }
}
