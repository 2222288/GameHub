# -*- coding: utf-8 -*-
"""把 GameHub 前后端源码摊平成带文件路径头的纯文本分卷包, 供网页端 AI 分卷上传。

用法:
    py scripts/build_web_ai_pack.py [输出目录] [每卷字节预算]
默认输出到 下载目录\\GameHub-web-ai-pack, 每卷约 110KB。
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (分组前缀, 说明, [相对路径]) — 目录会递归展开
GROUPS = [
    ("01-docs-config", "根目录配置与文档", [
        "README.md", "VISUAL-UPDATE.md", "IMPLEMENTATION-16.0.md", "OPTIMIZATION.md",
        "compose.yml", ".env.example", ".gitignore", ".prettierrc.json",
    ]),
    ("02-frontend", "前端 (React + TypeScript)", [
        "frontend/package.json", "frontend/tsconfig.json",
        "frontend/vite.config.ts", "frontend/vitest.config.ts",
        "frontend/playwright.config.ts", "frontend/index.html",
        "frontend/Dockerfile", "frontend/nginx.conf",
        "frontend/src", "frontend/tests",
    ], ["node_modules", "dist"]),
    ("03-backend", "后端 (Spring Boot / Java 17)", ["backend"], ["target", ".idea", ".mvn"]),
    ("04-database", "数据库 SQL (初始化/迁移/种子)", ["database"]),
    ("05-scripts", "辅助脚本 (Python)", ["scripts"], ["__pycache__", "build_web_ai_pack.py"]),
]

SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2",
             ".ttf", ".eot", ".mp4", ".zip", ".jar", ".war", ".exe", ".pdf"}


def collect(rel):
    """返回该相对路径下应收录的文件(排序后)."""
    full = os.path.join(ROOT, rel.replace("/", os.sep))
    if os.path.isfile(full):
        return [rel]
    out = []
    for dirpath, dirnames, filenames in os.walk(full):
        dirnames[:] = sorted(d for d in dirnames if d not in (".git",))
        for name in sorted(filenames):
            ext = os.path.splitext(name)[1].lower()
            if ext in SKIP_EXT:
                continue
            out.append(os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, "/"))
    return out


def read_text(path):
    with open(path, "rb") as f:
        data = f.read()
    if b"\x00" in data[:4096]:
        return None
    for enc in ("utf-8", "gbk"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def build(out_dir, budget):
    os.makedirs(out_dir, exist_ok=True)
    manifest_rows = []  # (part文件名, 分组说明, [文件, ...])
    for entry in GROUPS:
        prefix, desc, rels = entry[0], entry[1], entry[2]
        excludes = entry[3] if len(entry) > 3 else []
        files = []
        for rel in rels:
            if not os.path.exists(os.path.join(ROOT, rel.replace("/", os.sep))):
                continue
            for f in collect(rel):
                if any(x in f.split("/") for x in excludes):
                    continue
                files.append(f)
        part, cur, cur_size, cur_files = 1, [], 0, []

        def flush():
            nonlocal part, cur, cur_size, cur_files
            if not cur:
                return
            name = f"{prefix}-part{part}.md"
            body = (f"# GameHub 源码包 {prefix} part{part} — {desc}\n\n"
                    + "\n".join(cur))
            with open(os.path.join(out_dir, name), "w", encoding="utf-8", newline="\n") as f:
                f.write(body)
            manifest_rows.append((name, desc, cur_files, len(body)))
            part += 1
            cur, cur_size, cur_files = [], 0, []

        for rel in files:
            text = read_text(os.path.join(ROOT, rel.replace("/", os.sep)))
            if text is None:
                continue
            n_lines = text.count("\n") + 1
            block = (f"\n\n===== FILE: {rel} ({n_lines} 行) =====\n\n"
                     + text.rstrip("\n") + "\n")
            if cur and cur_size + len(block.encode("utf-8")) > budget:
                flush()
            cur.append(block)
            cur_size += len(block.encode("utf-8"))
            cur_files.append((rel, len(block.encode("utf-8"))))
        flush()
    write_manifest(out_dir, manifest_rows)
    total = sum(r[3] for r in manifest_rows)
    print(f"parts={len(manifest_rows)} total={total/1024:.0f}KB -> {out_dir}")


def write_manifest(out_dir, rows):
    lines = [
        "# GameHub 源码上下文包 — 清单与使用说明",
        "",
        "**项目**: GameHub 16.0 游戏资源站。前端 React 19 + TypeScript + Vite；"
        "后端 Spring Boot (Java 17)；存储 MySQL + Redis + Elasticsearch + RabbitMQ + MinIO；"
        "Docker Compose 部署。",
        "",
        "**格式约定**: 每个分卷是纯文本 Markdown；每个文件以",
        "`===== FILE: 相对路径 (行数) =====` 行开头, 之后是该文件完整内容。",
        "上传给网页端 AI 时, 直接把整卷作为附件或粘贴即可, AI 能凭 FILE 头识别文件边界。",
        "",
        "## 如何喂给网页端 AI",
        "",
        "1. 全量超出大多数模型的上下文(约 1MB 文本), 按任务只上传相关分卷:",
        "   - UI/前端问题 → `02-frontend-*` + `01-docs-config-part1`",
        "   - 接口/后端问题 → `03-backend-*` + `01-docs-config-part1`",
        "   - 数据库/搜索问题 → `04-database-*` + 相关后端卷",
        "   - 部署/运维问题 → `01-docs-config` (含 compose.yml)",
        "   - 爬虫/数据导入 → `05-scripts-*`",
        "2. 先上传本清单(或粘贴'分卷目录'), 再上传正文分卷, AI 能建立全局结构认知。",
        "3. `frontend/package-lock.json` 和 `node_modules/`、`dist/`、图片资源均未收录,",
        "   需要依赖版本时让 AI 参考 `package.json` 即可。",
        "4. 代码变更后重新生成: `py scripts/build_web_ai_pack.py`",
        "",
        "## 分卷目录",
        "",
    ]
    for name, desc, files, size in rows:
        lines.append(f"### {name} — {desc}  ({size/1024:.0f} KB, {len(files)} 个文件)")
        for rel, fsize in files:
            lines.append(f"- {rel} ({fsize/1024:.1f} KB)")
        lines.append("")
    with open(os.path.join(out_dir, "00-MANIFEST.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    default_out = os.path.join(os.path.expanduser("~"), "Downloads", "GameHub-web-ai-pack")
    out = sys.argv[1] if len(sys.argv) > 1 else default_out
    budget = int(sys.argv[2]) if len(sys.argv) > 2 else 110_000
    build(out, budget)


if __name__ == "__main__":
    default_out = os.path.join(os.path.expanduser("~"), "Downloads", "GameHub-web-ai-pack")
    out_dir = sys.argv[1] if len(sys.argv) > 1 else default_out
    budget = int(sys.argv[2]) if len(sys.argv) > 2 else 110_000
    build(out_dir, budget)
