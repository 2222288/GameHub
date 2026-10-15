package com.gamehub.auth;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTest {
    private final JwtService jwt=mock(JwtService.class);
    private final AdminUserDetailsService users=mock(AdminUserDetailsService.class);
    private final JwtAuthenticationFilter filter=new JwtAuthenticationFilter(jwt,users);
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @Test void publicRequestsAvoidAdminDatabaseLookups() throws Exception {
        var request=new MockHttpServletRequest();request.setServletPath("/api/v1/games");request.addHeader("Authorization","Bearer token");
        filter.doFilter(request,new MockHttpServletResponse(),mock(FilterChain.class));
        verifyNoInteractions(jwt,users);
    }
    @Test void disabledAccountsCannotReuseAnExistingJwt() throws Exception {
        var request=new MockHttpServletRequest();request.setServletPath("/api/v1/admin/games");request.addHeader("Authorization","Bearer token");
        when(jwt.subject("token")).thenReturn("admin");
        when(users.loadUserByUsername("admin")).thenReturn(User.withUsername("admin").password("hash").roles("ADMIN").disabled(true).build());
        filter.doFilter(request,new MockHttpServletResponse(),mock(FilterChain.class));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
    @Test void enabledAdminIsAuthenticated() throws Exception {
        var request=new MockHttpServletRequest();request.setServletPath("/api/v1/admin/games");request.addHeader("Authorization","Bearer token");
        when(jwt.subject("token")).thenReturn("admin");when(users.loadUserByUsername("admin")).thenReturn(User.withUsername("admin").password("hash").roles("ADMIN").build());
        filter.doFilter(request,new MockHttpServletResponse(),mock(FilterChain.class));
        assertEquals("admin",SecurityContextHolder.getContext().getAuthentication().getName());
    }
}
