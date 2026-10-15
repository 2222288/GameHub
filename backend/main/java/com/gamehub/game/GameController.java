package com.gamehub.game;

import com.gamehub.common.ApiResponse;
import com.gamehub.common.PageResult;
import com.gamehub.game.vo.GameCardVO;
import com.gamehub.game.vo.GameDetailVO;
import com.gamehub.game.vo.WallGameVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/games")
public class GameController {
    private final GameService service;

    public GameController(GameService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<PageResult<GameCardVO>> list(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "20") long size,
            @RequestParam(required = false) Long category,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String platform,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String sort) {
        return ApiResponse.ok(service.listFiltered(page, Math.min(size, 60), category, tag, platform, language, sort));
    }

    @GetMapping("/latest")
    public ApiResponse<List<GameCardVO>> latest() {
        return ApiResponse.ok(service.latest());
    }

    @GetMapping("/wall")
    public ApiResponse<List<WallGameVO>> wall(@RequestParam(defaultValue = "80") int size) {
        return ApiResponse.ok(service.wall(size));
    }

    @GetMapping("/{slug}")
    public ApiResponse<GameDetailVO> detail(@PathVariable String slug) {
        return ApiResponse.ok(service.detailBySlug(slug));
    }
}
