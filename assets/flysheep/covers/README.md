# 游戏封面色调分桶

来源：https://www.flysheep6.com（WordPress REST 全站枚举），共 1000 张，统一比例 **2:3**（参考站卡片实测宽/高 = 0.6667，与 `frontend/src/index.css` 里 `.wall-cover { aspect-ratio: 2 / 3 }` 一致）。

分桶规则与线上渲染完全对齐，文件夹编号即背景墙列编号：

- 取色：`CoverColorAnalyzer.java` 的等价实现（OKLCH、24 个色相区间、纯黑/纯白/低彩度像素降权 0.12）。
- 入桶：`CoverWall.tsx` 的 `bucketFor()` —— 彩度 < 0.025 进中性桶，否则 `floor(hue / 30)`。

| 目录 | OKLCH 色相 | 色桶 | 数量 | 代表色 |
| --- | --- | --- | --- | --- |
| `00-crimson/` | 0-30 | 绯红 | 104 | #b32225 |
| `01-ember/` | 30-60 | 赤橙 | 133 | #865335 |
| `02-amber/` | 60-90 | 琥珀 | 84 | #987a40 |
| `03-gold/` | 90-120 | 金黄 | 37 | #e0cc77 |
| `04-lime/` | 120-150 | 黄绿 | 63 | #4e5e3c |
| `05-green/` | 150-180 | 森绿 | 23 | #276f4b |
| `06-emerald/` | 180-210 | 青翠 | 23 | #4e726e |
| `07-teal/` | 210-240 | 青蓝 | 49 | #63808f |
| `08-azure/` | 240-270 | 湛蓝 | 133 | #094879 |
| `09-indigo/` | 270-300 | 靛蓝 | 59 | #3e3c4e |
| `10-violet/` | 300-330 | 紫罗兰 | 23 | #714b76 |
| `11-magenta/` | 330-360 | 品红 | 14 | #914881 |
| `12-neutral/` | 低彩度 | 中性 | 255 | #464343 |

重新生成：

```bash
python scripts/crawl_flysheep_covers.py --limit 1000 --workers 18 --fresh
python scripts/render_flysheep_sheet.py --per-tone 6
```
