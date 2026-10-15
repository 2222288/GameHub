package com.gamehub.admin;

import com.gamehub.common.ApiResponse;
import com.gamehub.media.CoverColorAnalyzer;
import com.gamehub.media.MediaService;
import com.gamehub.media.entity.GameMedia;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/admin/media")
public class AdminMediaController {
    private final MediaService service;

    public AdminMediaController(MediaService service) {
        this.service = service;
    }

    @PostMapping("/upload")
    public ApiResponse<GameMedia> upload(@RequestParam Long gameId,
                                         @RequestParam String type,
                                         @RequestParam(required = false) Integer sortOrder,
                                         @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(service.upload(gameId, type, file, sortOrder));
    }

    @PostMapping("/cover/reanalyze")
    public ApiResponse<CoverColorAnalyzer.ColorProfile> reanalyzeCover(@RequestParam Long gameId) {
        return ApiResponse.ok(service.reanalyzeCover(gameId));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok();
    }
}
