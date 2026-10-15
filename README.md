# GameHub 16.0 · 首页视觉更新版

沿用 React / TypeScript、Spring Boot、MySQL、Redis、Elasticsearch、RabbitMQ 和 MinIO，在原动态封面墙版上更新首页视觉和最近更新轮播。

## 当前首页视觉更新（第二轮）

- 背景墙完整覆盖首屏 `100svh`，首屏仅保留半透明毛玻璃搜索框与向下提示；删除 Logo、标语和悬浮封面标题。
- 将衔接效果移到首屏外：同一面动态墙继续向下延伸，再通过渐进模糊、暗部遮罩和暖纸色透明渐变接到正文。导航在滚过第一屏后显示。
- 背景墙根据实际容器高度补齐循环素材，避免窄屏长屏、旋转和过渡延伸时出现空段。
- 最近更新保留单幅大横幅、内嵌箭头与底部圆点；增加深色展台、外围留边与轻投影，白色信息卡不再与页面混在一起。
- 热门下载改为参考图的海报卡片：自然比例封面、日期、朱砂红标题、简介和底部分类/访问/浏览数据。桌面三列、平板两列、手机一列。
- 删除首页最下方的“按分类探索”，导航分类保留。
- 正文背景改为暖纸色，加上低对比度网格、坐标十字和等高线；背景墙保持独立，正文卡片保持白色。
- 上一轮 `bannerUrl` 接入与图片回退保留，本轮无需数据库变更。

详细改动、配色和验证说明见 [VISUAL-UPDATE.md](VISUAL-UPDATE.md)。

## 原动态封面墙版功能

- 首页改为全屏动态封面墙与居中搜索框；封面按色调分列，素材较多的色桶分配更多中心列，并按素材密度生成不同流速。
- 首页首屏隐藏导航，进入内容区后显示“最新 / 热门 / 分类 / 搜索”；分类菜单与首页继续复用同一分类接口。
- 首页游戏展示和热门下载复用现有 API；热门下载按已有资源访问计数 `resource_click_count` 排序。
- 封面上传时提取 OKLCH 代表色并保存，公共背景墙接口只返回轻量颜色元数据；浏览器不执行图片取色。
- 增加键盘焦点暂停、页面离开暂停以及 `prefers-reduced-motion` 静态降级。
- 补齐 Vite、TypeScript、Maven、依赖锁文件和 Docker Compose 配置。
- 游戏卡片的分类、标签、平台和语言改为按页批量查询；分类统计改为一次分组查询。
- 搜索降级时由数据库执行过滤与分页，避免读取全部游戏及其关联记录。
- 前端采用请求取消、分类缓存与路由按需加载，修复筛选竞态和详情切换残留数据。
- 首页的游戏展示和排行读取 API，完善搜索、分页、图片预览与资源反馈。
- 修复空日期保存、401 登录状态不同步、403 误退出、禁用管理员继续使用 JWT、上传图片路径与前端 assets 路径冲突。

动态墙算法、颜色字段及交互说明见 [IMPLEMENTATION-16.0.md](IMPLEMENTATION-16.0.md)，既有性能优化与验证范围见 [OPTIMIZATION.md](OPTIMIZATION.md)。历史说明保留在 README-14.0.md / README-15.0.md。

## Docker 启动

本项目提供部署配置；本次没有在 Docker 环境完成实际启动验证。

安装 Python 3 与 Docker Compose 后，在项目根目录执行：

```bash
python3 scripts/setup_env.py
docker compose up -d --build
```

访问 http://localhost:8088；后台入口为 http://localhost:8088/admin/login。

管理员用户名默认为 `admin`，密码见生成的 `.env` 文件中的 `ADMIN_PASSWORD`。脚本为数据库、消息队列、对象存储、JWT 和管理员生成各自的随机凭据，不覆盖已有 `.env`。

MySQL 首次启动时会导入 `database/gamehub_init.sql`。原始初始化数据中的游戏图片与部分资源链接为示例，需要在后台替换为实际内容。

## 本地开发

要求 Node.js 22.12+、Java 17+、Maven 3.9+。先生成 `.env`，并启动依赖服务：

```bash
python3 scripts/setup_env.py
docker compose up -d mysql redis elasticsearch rabbitmq minio
```

在 Bash 中，从项目根目录启动后端：

```bash
set -a
. ./.env
set +a
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

另开终端启动前端：

```bash
cd frontend
npm ci
npm run dev
```

访问 http://localhost:5173。开发服务器将 `/api` 代理到后端，将 `/media` 代理到 MinIO。需要调整地址时，参考 `frontend/.env.example`。

后端沿用原始 `backend/main/java` 和 `backend/main/resources` 目录；`backend/pom.xml` 已配置对应构建路径。

## 已有数据库升级

已有 15.1 数据库只运行 `database/migration_16_0_dynamic_wall.sql`，不要重复执行初始化脚本。仍停留在 15.0 的数据库应先执行 `database/migration_15_1_indexes.sql`，再执行 16.0 迁移。新数据库的初始化脚本已经包含全部字段和索引。

迁移完成后，新上传的 JPG / PNG 封面会自动生成颜色信息。既有封面仍可正常出现在背景墙中，并使用稳定的后备色相；站内 MinIO 封面可在后台点击“重新分析当前封面色调”补写准确数据，也可以直接重新上传。

新增图片 URL 使用 `/media/<bucket>/games/...`。开发代理与 Nginx 保留了原有默认 bucket 的 `/assets/games/...` 图片路径兼容。

## 验证命令

前端：

```bash
cd frontend
npm ci
npm run build
npm run test
npm audit
```

后端：

```bash
cd backend
mvn package
```

已附 3 个 Playwright 浏览器冒烟用例，使用模拟 API 响应验证前端交互：

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

本次 Chromium 在执行环境中无法启动，这 3 个浏览器用例未通过实际运行验证。它们也不替代与真实后端的端到端联调。


## 历史：首页视觉调整（2026-10-14）

- 首屏封面墙按整列铺满可视宽度；去掉卡片间隙、圆角、边框、白色聚光和底部泛白遮罩。
- 悬停或键盘聚焦封面时，仅当前列平滑减速暂停；离开后同位置平滑加速恢复，不重启动画；页面隐藏时仍全局暂停以节省资源。
- “最新更新”改为独立的横向卡片轨道：桌面同时显示 3 张，平板 2 张，手机 1 张，支持滑动、箭头、分页指示和自动滚动。
- 此为旧版实现记录；本次已根据两张参考图改为单幅大横幅，以上旧版卡片轨道样式已被替换。

## 封面采集与色调背景墙（2026-10-14 第二轮）

参考站 `flysheep6.com` 的卡片封面实测宽/高 = 0.6671，与 `frontend/src/index.css` 中 `.wall-cover { aspect-ratio: 2 / 3 }` 一致，因此统一按 **2:3** 生产封面素材，共 1000 张。

### 采集与分桶

```bash
python scripts/crawl_flysheep_covers.py --limit 1000 --workers 18 --fresh
python scripts/render_flysheep_sheet.py --per-tone 6          # 目视校验图
```

- 条目来自站点开放的 WordPress REST（`/wp-json/wp/v2/posts?_embed`，全站 3318 篇），一次拿到标题、正文、特色图、分类，不再解析列表 HTML。
- 封面源按预期画质排序：站点竖版特色图（760×1140）→ Steam `library_600x900` 胶囊图 → 小尺寸竖图 → 实机截图裁切。横版 header（460×215）裁成 2:3 只剩 143px，直接弃用。
- 裁切用梯度能量 + 中心先验选窗口，横图转竖图时保住主体；输出尺寸不超过原图，避免放大。
- 取色是 `CoverColorAnalyzer.java` 的等价实现（OKLCH、24 区间、黑/白/低彩度降权 0.12），并且**在 JPEG 落盘之后**再分析，保证与后端读到的像素同源。
- 文件夹编号即背景墙列号：`assets/flysheep/covers/<00..12>/*`，规则是 `CoverWall.tsx` 的 `bucketFor()`（彩度 < 0.025 进 `12-neutral`，否则 `floor(hue / 30)`）。

### 入库与真值校正

```bash
python scripts/import_flysheep_covers.py --limit 1000 --workers 6 --shots 3 --balance-wall
python scripts/resync_flysheep_tones.py
```

- 导入走后台真实链路（登录 → 建游戏 → 上传 COVER/BANNER/SCREENSHOT → 写网盘链接 → 发布），封面文件按采集端原样上传，服务端 `CoverColorAnalyzer` 重新取色并回写 `cover_hue / cover_chroma / cover_accent`。
- `resync_flysheep_tones.py` 以后端返回值为准搬迁文件夹并同步 `manifest.json`，使「目录 == 背景墙列」在数据层面严格成立；同时清理批量收尾留下的多余文件。搬迁 0 且孤儿 0 即为对齐完成。
- `--balance-wall` 生成 `database/seed_flysheep_wall_order.sql`：背景墙只取 `updated_at` 最新的 120 条，按色桶轮转排 rank，保证 13 个色桶在 11 列里都有素材。**任何一次 `PUT /admin/games/{id}` 都会刷新 `updated_at`，之后必须重跑这个 SQL。**
- 详情文本可选富化：`enrich_flysheep_steam.py` 按 appid 批量取 Steam 官方长简介（`--budget` 控时长，Steam 会限流），`refine_flysheep_names.py` 用最新标题规则重算中文主名 / 版本后缀，最后 `import_flysheep_covers.py --update-only` 推回。`--update-only` 会原样回传 `coverUrl / bannerUrl`，否则后端会判定封面变更并清空色调。
- 离线校验：`render_wall_preview.py` 直接读 `/api/v1/games/wall` 并复刻 `buildWallColumns()` 的分列算法出图，不需要浏览器。

- 详情页参考该站结构重绘：深色信息带按封面 `coverAccent` 染色、2:3 封面、面包屑、游戏介绍 / 截图 / 配置需求 / 下载资源分区，右侧粘性信息栏含快速选路，底部按分类推荐同类游戏。

