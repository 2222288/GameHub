package com.gamehub.category;
import com.gamehub.category.entity.Category;
import com.gamehub.category.vo.CategoryVO;
import com.gamehub.common.*;
import com.gamehub.game.GameService;
import com.gamehub.game.vo.GameCardVO;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/v1/categories") public class CategoryController {
 private final CategoryService categories; private final GameService games;
 public CategoryController(CategoryService categories,GameService games){this.categories=categories;this.games=games;}
 @GetMapping public ApiResponse<List<CategoryVO>>list(){return ApiResponse.ok(categories.publicList());}
 @GetMapping("/{slug}/games") public ApiResponse<PageResult<GameCardVO>>games(@PathVariable String slug,@RequestParam(defaultValue="1")long page,@RequestParam(defaultValue="20")long size){Category c=categories.getBySlug(slug);return ApiResponse.ok(games.listFiltered(page,size,c.getId(),null,null,null,"updated"));}
}
