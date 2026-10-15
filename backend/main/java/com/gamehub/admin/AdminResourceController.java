package com.gamehub.admin;

import com.gamehub.common.ApiResponse;
import com.gamehub.resource.ResourceService;
import com.gamehub.resource.dto.ResourceLinkRequest;
import com.gamehub.resource.entity.ResourceLink;
import com.gamehub.resource.vo.AdminResourceLinkVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminResourceController {
    private final ResourceService service;

    public AdminResourceController(ResourceService service) { this.service = service; }

    @GetMapping("/resource-links")
    public ApiResponse<List<AdminResourceLinkVO>> list(@RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String q) {
        return ApiResponse.ok(service.adminLinks(status, q));
    }

    @GetMapping("/games/{gameId}/resource-links")
    public ApiResponse<List<AdminResourceLinkVO>> listByGame(@PathVariable Long gameId) {
        return ApiResponse.ok(service.adminLinksByGame(gameId));
    }

    @PostMapping("/games/{gameId}/resource-links")
    public ApiResponse<ResourceLink> add(@PathVariable Long gameId, @Valid @RequestBody ResourceLinkRequest r) {
        return ApiResponse.ok(service.add(gameId, r));
    }

    @PutMapping("/resource-links/{id}")
    public ApiResponse<ResourceLink> update(@PathVariable Long id, @Valid @RequestBody ResourceLinkRequest r) {
        return ApiResponse.ok(service.update(id, r));
    }

    @DeleteMapping("/resource-links/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok();
    }
}
