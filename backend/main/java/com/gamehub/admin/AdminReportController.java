package com.gamehub.admin;

import com.gamehub.common.ApiResponse;
import com.gamehub.resource.ResourceService;
import com.gamehub.resource.vo.AdminReportVO;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/reports")
public class AdminReportController {
    private final ResourceService service;

    public AdminReportController(ResourceService service) { this.service = service; }

    @GetMapping
    public ApiResponse<List<AdminReportVO>> list(@RequestParam(required = false) String status) {
        return ApiResponse.ok(service.adminReports(status));
    }

    @PostMapping("/{id}/process")
    public ApiResponse<Void> process(@PathVariable Long id) {
        service.processReport(id);
        return ApiResponse.ok();
    }

    @PostMapping("/{id}/resource-status")
    public ApiResponse<Void> resourceStatus(@PathVariable Long id, @RequestParam String status) {
        service.setReportedLinkStatus(id, status);
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}/resource-link")
    public ApiResponse<Void> deleteResource(@PathVariable Long id) {
        service.deleteReportedLink(id);
        return ApiResponse.ok();
    }
}
