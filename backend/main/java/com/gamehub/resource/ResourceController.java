package com.gamehub.resource;

import com.gamehub.common.ApiResponse;
import com.gamehub.resource.dto.ReportRequest;
import com.gamehub.resource.vo.PublicResourceLinkVO;
import com.gamehub.resource.vo.ResourceRedirectVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class ResourceController {
    private final ResourceService service;

    public ResourceController(ResourceService service) {
        this.service = service;
    }

    @GetMapping("/games/{id}/resource-links")
    public ApiResponse<List<PublicResourceLinkVO>> links(@PathVariable Long id) {
        return ApiResponse.ok(service.publicLinks(id));
    }

    @PostMapping("/resource-links/{id}/click")
    public ApiResponse<ResourceRedirectVO> click(@PathVariable Long id) {
        return ApiResponse.ok(service.click(id));
    }

    @PostMapping("/resource-links/{id}/report")
    public ApiResponse<Void> report(@PathVariable Long id, @Valid @RequestBody ReportRequest body, HttpServletRequest req) {
        String ip = req.getHeader("X-Real-IP");
        if (ip == null || ip.isBlank()) ip = req.getRemoteAddr();
        service.report(id, body, ip, req.getHeader("User-Agent"));
        return ApiResponse.ok();
    }
}
