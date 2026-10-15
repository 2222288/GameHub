package com.gamehub.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gamehub.auth.JwtAuthenticationFilter;
import com.gamehub.common.ApiResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    SecurityFilterChain filter(HttpSecurity http, JwtAuthenticationFilter jwt, ObjectMapper objectMapper) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, error) ->
                                writeSecurityError(response, objectMapper, HttpStatus.UNAUTHORIZED, 40101, "authentication required"))
                        .accessDeniedHandler((request, response, error) ->
                                writeSecurityError(response, objectMapper, HttpStatus.FORBIDDEN, 40301, "access denied")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/login", "/error").permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/games", "/api/v1/games/**",
                                "/api/v1/categories", "/api/v1/categories/**",
                                "/api/v1/search", "/api/v1/search/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/resource-links/*/click", "/api/v1/resource-links/*/report").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().denyAll())
                .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    private void writeSecurityError(jakarta.servlet.http.HttpServletResponse response, ObjectMapper objectMapper,
                                    HttpStatus status, int code, String message) throws IOException {
        response.setStatus(status.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ApiResponse.error(code, message));
    }
}
