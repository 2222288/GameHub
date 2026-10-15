package com.gamehub.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.gamehub.admin.entity.AdminUser;
import com.gamehub.admin.entity.OperationLog;
import com.gamehub.admin.repository.AdminUserRepository;
import com.gamehub.admin.repository.OperationLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.LocalDateTime;

@Component
public class AdminOperationLogInterceptor implements HandlerInterceptor {
    private final AdminUserRepository admins;
    private final OperationLogRepository logs;

    public AdminOperationLogInterceptor(AdminUserRepository admins, OperationLogRepository logs) {
        this.admins = admins;
        this.logs = logs;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (ex != null || response.getStatus() >= 400 || "GET".equalsIgnoreCase(request.getMethod())) return;
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return;
            AdminUser admin = admins.selectOne(new LambdaQueryWrapper<AdminUser>().eq(AdminUser::getUsername, auth.getName()));
            OperationLog log = new OperationLog();
            log.setAdminId(admin == null ? null : admin.getId());
            log.setOperation(request.getMethod() + " " + request.getRequestURI());
            String[] parts = request.getRequestURI().split("/");
            log.setTargetType(parts.length > 4 ? parts[4] : "admin");
            log.setTargetId(lastNumericSegment(parts));
            String ip = request.getHeader("X-Real-IP");
            log.setIp(ip == null || ip.isBlank() ? request.getRemoteAddr() : ip);
            log.setCreatedAt(LocalDateTime.now());
            logs.insert(log);
        } catch (Exception ignored) {
            // Audit logging must never break the admin operation that has already succeeded.
        }
    }

    private Long lastNumericSegment(String[] parts) {
        for (int i = parts.length - 1; i >= 0; i--) {
            try { return Long.valueOf(parts[i]); }
            catch (NumberFormatException ignored) { }
        }
        return null;
    }
}
