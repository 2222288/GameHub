# GameHub 15.1 优化与验证记录

## 查询与加载

| 位置 | 原行为 | 优化后的行为 |
| --- | --- | --- |
| 游戏列表、最近更新、后台列表、搜索结果卡片 | 每款游戏分别读取分类、标签、平台和语言 | 每页最多 5 次关联查询，结果保持输入顺序 |
| 分类统计 | 每个分类各执行一次计数查询 | 一次分组计数加一次分类列表查询 |
| 游戏筛选 | 先把筛选对应的全部游戏 ID 读到内存，再查询列表 | 参数化 EXISTS 条件直接交给数据库处理 |
| 搜索异常降级 | 全量读取已发布游戏并逐条组装、过滤、排序 | 数据库过滤、排序、计数与分页 |
| Redis 统计同步 | KEYS 枚举全部匹配键 | 分批 SCAN，保留 GETDEL 和数据库失败后的计数回填 |
| 前端分类 | 筛选或分页时重复请求 | 共享 5 分钟分类缓存 |
| 快速筛选与详情切换 | 旧请求可能覆盖新数据 | 独立查询键和 AbortSignal 取消；详情按 slug 隔离 |
| 前端路由 | 启动时加载所有页面 | 公共页与管理页按路由加载；Markdown 与图片弹窗在详情页加载 |

20 款均有标签的游戏，原实现最多会产生 100 次卡片关联查询；优化后为 5 次。这是源码调用数量对比，批量次数已用回归测试验证，不代表吞吐量或响应时间基准测试。

搜索的 SQL 降级仍然属于包含匹配，不是全文检索。Elasticsearch 继续负责正常搜索的相关度排序。

## 界面与可靠性

- 合并重复的首页入口，游戏列表、更新区与排行使用接口数据。
- 移除写死的编辑推荐与玩家讨论；未实现的社区页面显示即将开放状态。
- 整理重复的历史 CSS，采用统一深色配色；卡片信息始终显示，减少悬停导致的布局变化。
- 搜索框与 URL 关键词同步，规范分页、排序和每页数量参数。
- 加入移动端导航、筛选标签、分页 aria-current、跳过导航入口和减少动效偏好支持。
- 图片加载失败后能够尝试新的 URL；封面按需加载，首页重点封面优先加载。
- 图片弹窗提供焦点管理、左右方向键与 Escape 关闭；资源反馈改为页面内状态提示。
- 401 清除 Zustand 与本地保存的登录状态；403 保留登录状态，公开请求不携带管理员 token。
- 服务端验证管理员启用状态，公开接口跳过管理员 JWT 数据库查询。
- 后台表单空日期转为 null，保存失败显示错误；创建与编辑之间切换时按记录隔离查询与表单。
- 上传媒体改用 /media 路径，避免与 Vite 的 /assets 静态文件冲突。
- 补齐依赖、构建入口、环境示例、随机凭据生成脚本、开发代理和部署文件。

## 本次验证

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| 前端 TypeScript 与生产构建 | 通过 | 全部源码与按路由分块产物 |
| 前端 Vitest | 20 项通过 | 请求竞态、分类故障隔离、权限状态、分页输入、空日期、图片重试及弹窗键盘/焦点 |
| 后端 Maven package | 通过 | Java 编译、10 项测试、Spring Boot JAR 打包 |
| 后端数据库查询测试 | 4 项通过 | H2 MySQL 模式下的过滤组合、分页排序、字面字符、参数化输入、分类统计 |
| 后端服务与鉴权测试 | 6 项通过 | 批量次数、空页无关联查询、禁用管理员、公开请求跳过 JWT、Redis 失败回填 |
| npm audit | 0 个已知漏洞 | 当前锁文件包含开发和运行依赖；不是完整安全审计 |
| YAML / XML 配置解析 | 通过 | Compose、Spring 配置与 Maven POM 的语法 |
| Playwright 浏览器冒烟 | 未完成 | 已附 3 个用例；当前环境 Chromium 启动失败 |
| Docker 和真实服务端到端联调 | 未执行 | 当前环境未提供 Docker |

数据库查询测试不覆盖 MySQL 的真实执行计划和排序规则。生产配置仍需在自己的 MySQL、Redis、Elasticsearch、RabbitMQ 与 MinIO 环境验证。

## 主要文件

| 文件 | 用途 |
| --- | --- |
| backend/main/java/com/gamehub/game/GameService.java | 批量组装游戏卡片 |
| backend/main/java/com/gamehub/game/repository/GameRepository.java | 筛选与搜索降级的参数化分页 SQL |
| backend/main/java/com/gamehub/category/CategoryService.java | 分类分组统计 |
| backend/main/java/com/gamehub/statistics/CounterSyncJob.java | SCAN 统计同步 |
| frontend/src/components/CatalogPage.tsx | 共享游戏列表与搜索状态管理 |
| frontend/src/api/queries.ts | 查询缓存配置 |
| frontend/src/pages/HomePage.tsx | 数据化首页 |
| database/migration_15_1_indexes.sql | 已有数据库的索引迁移 |
| compose.yml | 本地部署配置 |

实现参考：[MyBatis-Plus 安装说明](https://baomidou.com/en/getting-started/install/)、[Redis SCAN](https://redis.io/docs/latest/commands/scan/)、[Tailwind Vite 集成](https://tailwindcss.com/docs/installation/using-vite)。
