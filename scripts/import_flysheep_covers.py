#!/usr/bin/env python3
"""把采集到的 2:3 封面与详情数据导入 GameHub。

走的是后台真实链路，不是直接写库：
  登录 -> 建游戏 -> 上传 COVER/BANNER/SCREENSHOT（服务端 CoverColorAnalyzer 重新取色）
       -> 写网盘资源链接 -> 发布
这样背景墙的色调字段由后端自己算出来，可以和采集脚本的 Python 实现互相校验。

用法：
  python scripts/import_flysheep_covers.py --api http://127.0.0.1:8080 --limit 1000
  python scripts/import_flysheep_covers.py --balance-wall   # 额外生成背景墙排序 SQL
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import io
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "flysheep", "manifest.json")
PREP = os.path.join(ROOT, ".scrape", "flysheep", "prep")

CATEGORY_BY_SLUG = {"pc": 1, "indie": 2, "vr": 3, "emulator": 4, "tools": 5}
ALLOWED_PLATFORMS = {"Windows", "macOS", "Linux", "VR", "Emulator"}
ALLOWED_LANGUAGES = {"简体中文", "繁体中文", "English", "日文", "韩文", "多语言"}
MAX_TAGS = 24

lock = threading.Lock()
STATE = {"created": 0, "skipped": 0, "failed": 0, "hue_max_delta": 0.0}
ERRORS: list[str] = []
COLORS: list[dict] = []


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------- client ----

class Api:
    def __init__(self, base: str, username: str, password: str):
        self.base = base.rstrip("/") + "/api/v1"
        self.token: str | None = None
        payload = json.dumps({"username": username, "password": password}).encode()
        data = self._request("POST", "/auth/login", body=payload,
                             headers={"Content-Type": "application/json"}, auth=False)
        self.token = data["data"]["token"]

    def _request(self, method, path, body=None, headers=None, auth=True, timeout=90):
        url = self.base + path
        req = urllib.request.Request(url, data=body, method=method)
        for key, value in (headers or {}).items():
            req.add_header(key, value)
        if auth and self.token:
            req.add_header("Authorization", "Bearer " + self.token)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                return json.loads(raw.decode("utf-8")) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            try:
                return json.loads(raw.decode("utf-8"))
            except Exception:
                return {"code": exc.code, "message": raw[:200].decode("utf-8", "replace")}

    def get(self, path):
        return self._request("GET", path)

    def post(self, path, payload):
        return self._request("POST", path, json.dumps(payload).encode("utf-8"),
                             {"Content-Type": "application/json"})

    def upload(self, game_id: int, media_type: str, filename: str, blob: bytes,
               sort: int | None = None):
        boundary = "----gamehub" + hashlib.md5(filename.encode()).hexdigest()[:16]
        fields = {"gameId": str(game_id), "type": media_type}
        if sort is not None:
            fields["sortOrder"] = str(sort)
        out = bytearray()
        for key, value in fields.items():
            out += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{key}\"\r\n\r\n{value}\r\n".encode()
        out += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
                f"filename=\"{filename}\"\r\nContent-Type: image/jpeg\r\n\r\n").encode()
        out += blob
        out += f"\r\n--{boundary}--\r\n".encode()
        return self._request("POST", "/admin/media/upload", bytes(out),
                             {"Content-Type": f"multipart/form-data; boundary={boundary}"},
                             timeout=120)


# ------------------------------------------------------------- transforms ---

def limit(value: str | None, size: int) -> str | None:
    if not value:
        return None
    value = re.sub(r"\s+", " ", str(value)).strip()
    return value[:size] or None


def is_transient(result: dict) -> bool:
    """MySQL 并发插入会偶发死锁（50000），这类错误重试即可，不是数据问题。"""
    message = str(result.get("message") or "").lower()
    return result.get("code") in (50000, 50012, 50013) or "deadlock" in message or "lock wait" in message


def prepare_image(path: str, max_edge: int, quality: int) -> bytes:
    with Image.open(path) as im:
        im = im.convert("RGB")
        if max(im.size) > max_edge:
            scale = max_edge / max(im.size)
            im = im.resize((int(im.size[0] * scale), int(im.size[1] * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True)
        return buf.getvalue()


def remote_shot(url: str, index: int, slug: str) -> bytes | None:
    """下载实机截图并压到 1280 宽，作为详情页图库素材。"""
    os.makedirs(PREP, exist_ok=True)
    key = hashlib.md5(url.encode()).hexdigest()[:12]
    cache = os.path.join(PREP, f"{key}.jpg")
    if os.path.exists(cache) and os.path.getsize(cache) > 2048:
        with open(cache, "rb") as fh:
            return fh.read()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as resp:
            blob = resp.read()
    except Exception:
        return None
    if len(blob) < 2048:
        return None
    try:
        with Image.open(io.BytesIO(blob)) as im:
            im = im.convert("RGB")
            if im.size[0] > 1280:
                im = im.resize((1280, int(im.size[1] * 1280 / im.size[0])), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=78, optimize=True)
            data = buf.getvalue()
    except Exception:
        return None
    with open(cache, "wb") as fh:
        fh.write(data)
    return data


def first_release_date(game: dict) -> str | None:
    """站点正文里的『发行日期』才是游戏发售日，正文没有就留空，不要拿收录时间冒充。"""
    text = " ".join(filter(None, [game.get("title") or "", game.get("description") or ""]))
    m = re.search(r"发行日期\s*[:：]?\s*(\d{4})\s*[年/-]\s*(\d{1,2})\s*[月/-]?\s*(\d{1,2})?", text)
    if not m:
        return None
    year, month, day = m.group(1), int(m.group(2)), int(m.group(3) or 1)
    if not 1980 <= int(year) <= 2030 or not 1 <= month <= 12 or not 1 <= day <= 31:
        return None
    return f"{int(year):04d}-{month:02d}-{day:02d}"


def build_payload(game: dict, category_id: int, tag_ids: list[int]) -> dict:
    title = game.get("title") or game.get("name") or game["slug"]
    summary = limit(game.get("summary"), 500) or limit(f"{title} 中文下载与详细介绍", 500)
    text = " ".join(filter(None, [game.get("title"), game.get("english_name"),
                                  " ".join(game.get("categories") or [])]))
    requirements = []
    for req in (game.get("requirements") or [])[:2]:
        requirements.append({
            "type": req["type"],
            "os": limit(req.get("os"), 128),
            "cpu": limit(req.get("cpu"), 255),
            "gpu": limit(req.get("gpu"), 255),
            "memory": limit(req.get("memory"), 64),
            "storage": limit(req.get("storage"), 64),
        })
    platforms = ["VR"] if game.get("category") == "vr" else (
        ["Emulator"] if game.get("category") == "emulator" else ["Windows"])
    text_all = " ".join(filter(None, [game.get("title") or "", (game.get("description") or "")[:600]]))
    languages = ["简体中文"] if "中文" in text_all else ["多语言"]
    release = first_release_date(game)
    modified = (game.get("modified") or "")[:10]
    return {
        "name": limit(game.get("name") or title, 128),
        "englishName": limit(game.get("english_name"), 128),
        "slug": game["slug"],
        "aliases": limit(game.get("title"), 500),
        "summary": summary,
        "description": limit(game.get("description"), 60000),
        "developer": limit(game.get("developer"), 128),
        "publisher": limit(game.get("publisher"), 128),
        "releaseDate": release or None,
        "categoryId": category_id,
        "wallEnabled": True,
        "currentVersion": limit(game.get("version_tag"), 64),
        "fileSize": limit(game.get("file_size"), 64),
        "versionUpdateDate": modified or None,
        "versionNotes": None,
        "tagIds": tag_ids,
        "platforms": [p for p in platforms if p in ALLOWED_PLATFORMS],
        "languages": [l for l in languages if l in ALLOWED_LANGUAGES],
        "requirements": requirements,
    }


def ensure_tags(api: Api, games: list[dict]) -> dict[str, int]:
    """把站点子分类映射成站内标签，最多 MAX_TAGS 个，避免标签云爆炸。"""
    counts: dict[str, int] = {}
    for game in games:
        for name in game.get("subcategories") or []:
            counts[name] = counts.get(name, 0) + 1
    existing = {t["name"]: t["id"] for t in (api.get("/admin/tags").get("data") or [])}
    mapping = dict(existing)
    for name, _ in sorted(counts.items(), key=lambda kv: -kv[1]):
        if len([k for k in mapping if k not in existing]) >= MAX_TAGS:
            break
        if name in existing or len(mapping) >= 40:
            continue
        slug = "fs-" + hashlib.md5(name.encode()).hexdigest()[:10]
        created = api.post("/admin/tags", {"name": name[:64], "slug": slug})
        if created.get("data"):
            mapping[name] = created["data"]["id"]
    return mapping


# ------------------------------------------------------------------ import --

def update_only(api: Api, game: dict, category_id: int, tag_map: dict[str, int]) -> None:
    """只更新文本字段，不碰媒体。

    注意两处后端行为：apply() 会用请求里的 coverUrl 覆盖现值，一旦不同就 clearCoverProfile
    把服务端算好的色调清空；update() 还会刷新 updated_at，背景墙排序要重跑一次。
    """
    current = api.get("/games/" + urllib.parse.quote(game["slug"]))
    if not current.get("data"):
        raise RuntimeError(f"游戏不存在，无法更新：{game['slug']}")
    record = current["data"]
    payload = build_payload(game, category_id,
                            [tag_map[n] for n in (game.get("subcategories") or []) if n in tag_map][:5])
    payload["coverUrl"] = record.get("coverUrl")          # 原样回传，避免触发清色
    payload["bannerUrl"] = record.get("bannerUrl")
    payload["wallEnabled"] = True
    for attempt in range(4):
        result = api._request("PUT", f"/admin/games/{record['id']}",
                              json.dumps(payload).encode("utf-8"),
                              {"Content-Type": "application/json"})
        if result.get("data") or not is_transient(result):
            break
        time.sleep(0.6 * (attempt + 1))
    if not result.get("data"):
        raise RuntimeError(f"update failed: {result.get('code')} {result.get('message')}")
    with lock:
        STATE["created"] += 1
        if STATE["created"] % 100 == 0:
            log(f"  已更新 {STATE['created']}")


def refresh_cover(api: Api, game: dict) -> dict | None:
    """只重传封面并回读服务端色值：用于让『本地分桶 == 服务端分桶』严格对齐。"""
    existing = api.get("/games/" + urllib.parse.quote(game["slug"]))
    if not existing.get("data"):
        raise RuntimeError(f"游戏不存在，无法刷新封面：{game['slug']}")
    game_id = existing["data"]["id"]
    with open(os.path.join(ROOT, game["cover"]), "rb") as fh:
        blob = fh.read()
    api.upload(game_id, "COVER", f"{game['slug']}-cover.jpg", blob)
    profile = api.get(f"/admin/games/{game_id}").get("data") or {}
    server = {"slug": game["slug"], "id": game_id, "hue": profile.get("coverHue"),
              "chroma": profile.get("coverChroma"), "accent": profile.get("coverAccent")}
    if server["hue"] is not None:
        with lock:
            STATE["created"] += 1
            if STATE["created"] % 100 == 0:
                log(f"  已刷新 {STATE['created']}")
    return server


def import_one(api: Api, game: dict, category_id: int, tag_map: dict[str, int],
               shots: int) -> dict | None:
    payload = build_payload(game, category_id,
                            [tag_map[n] for n in (game.get("subcategories") or []) if n in tag_map][:5])
    game_id = None
    for attempt in range(4):
        result = api.post("/admin/games", payload)
        data = result.get("data")
        if data:
            game_id = data["id"]
            break
        if result.get("code") == 40901:                 # slug 已存在：补媒体即可
            existing = api.get("/games/" + urllib.parse.quote(game["slug"]))
            if existing.get("data"):
                game_id = existing["data"]["id"]
                STATE["skipped"] += 1
                break
            raise RuntimeError(f"slug 冲突但公开详情查不到：{game['slug']}")
        if is_transient(result) and attempt < 3:        # 并发死锁，退避重试
            time.sleep(0.6 * (attempt + 1))
            continue
        raise RuntimeError(f"create failed: {result.get('code')} {result.get('message')}")
    if game_id is None:
        raise RuntimeError("create exhausted retries")

    # 封面按原样上传：采集端就是在这份 JPEG 上取的色，服务端再分析同一份字节，
    # 两边结果才会落在同一个 30 度桶里（缩放/重编码会让边界样本翻桶）。
    with open(os.path.join(ROOT, game["cover"]), "rb") as fh:
        cover_blob = fh.read()
    api.upload(game_id, "COVER", f"{game['slug']}-cover.jpg", cover_blob)

    profile = api.get(f"/admin/games/{game_id}").get("data") or {}
    server = {"slug": game["slug"], "id": game_id, "hue": profile.get("coverHue"),
              "chroma": profile.get("coverChroma"), "accent": profile.get("coverAccent")}
    if server["hue"] is not None:
        delta = min(abs(server["hue"] - game["hue"]), 360 - abs(server["hue"] - game["hue"]))
        with lock:
            STATE["hue_max_delta"] = max(STATE["hue_max_delta"], delta)

    urls = (game.get("screenshots") or [])[:shots]
    banner_done = False
    for index, url in enumerate(urls):
        blob = remote_shot(url, index, game["slug"])
        if not blob:
            continue
        api.upload(game_id, "SCREENSHOT", f"{game['slug']}-ss{index}.jpg", blob, index)
        if not banner_done:
            api.upload(game_id, "BANNER", f"{game['slug']}-banner.jpg", blob)
            banner_done = True

    order = 0
    for link in (game.get("resource_links") or [])[:6]:
        url = link.get("url") or ""
        if not url.startswith("http"):
            continue
        body = {"provider": limit(link["provider"], 64), "url": url[:1000],
                "password": limit(link.get("password"), 64), "status": "UNKNOWN",
                "sortOrder": order}
        for attempt in range(3):
            created = api.post(f"/admin/games/{game_id}/resource-links", body)
            if created.get("data") or not is_transient(created):
                break
            time.sleep(0.5 * (attempt + 1))
        order += 1

    api.post(f"/admin/games/{game_id}/publish", {})
    with lock:
        STATE["created"] += 1
        if STATE["created"] % 25 == 0:
            log(f"  已导入 {STATE['created']}  跳过{STATE['skipped']}  "
                f"hue最大偏差 {STATE['hue_max_delta']:.2f}")
    return server


def balance_wall_sql(games: list[dict], out_path: str) -> None:
    """背景墙只取 updated_at 最新的 120 条：按色调轮转排 rank，保证每列都有素材。"""
    lanes: dict[int, list[dict]] = {}
    for game in games:
        lanes.setdefault(int(game["bucket"]), []).append(game)
    ranked, depth = [], 0
    while any(len(v) > depth for v in lanes.values()):
        for bucket in sorted(lanes):
            if depth < len(lanes[bucket]):
                ranked.append(lanes[bucket][depth])
        depth += 1
    rows = ",\n".join(f"('{g['slug']}',{i})" for i, g in enumerate(ranked))
    sql = (
        "USE gamehub;\n"
        "DROP TABLE IF EXISTS wall_rank_seed;\n"
        "CREATE TABLE wall_rank_seed (slug VARCHAR(160) PRIMARY KEY, rk INT NOT NULL);\n"
        f"INSERT INTO wall_rank_seed (slug, rk) VALUES\n{rows};\n"
        "UPDATE game g JOIN wall_rank_seed s ON g.slug = s.slug\n"
        "  SET g.updated_at = DATE_SUB(NOW(), INTERVAL s.rk MINUTE);\n"
        "DROP TABLE wall_rank_seed;\n"
    )
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(sql)
    log(f"背景墙排序 SQL -> {out_path}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8080")
    ap.add_argument("--user", default=os.environ.get("ADMIN_USERNAME", "admin"))
    ap.add_argument("--password", default=os.environ.get("ADMIN_PASSWORD", ""))
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--shots", type=int, default=3)
    ap.add_argument("--balance-wall", action="store_true")
    ap.add_argument("--covers-only", action="store_true",
                    help="只重传封面并回读服务端色值，不重复建游戏")
    ap.add_argument("--update-only", action="store_true",
                    help="只 PUT 文本字段（配合 enrich_flysheep_steam.py），不动媒体")
    ap.add_argument("--only", default="", help="只处理这些 slug（逗号分隔），用于补齐增量")
    args = ap.parse_args()

    if not args.password:
        env = os.path.join(ROOT, ".env")
        if os.path.exists(env):
            for line in open(env, encoding="utf-8"):
                if line.startswith("ADMIN_PASSWORD="):
                    args.password = line.strip().split("=", 1)[1]
    if not args.password:
        log("缺少 ADMIN_PASSWORD")
        return 2

    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    games = manifest["games"][args.start:]
    if args.only:
        wanted = {s.strip() for s in args.only.split(",") if s.strip()}
        games = [g for g in games if g["slug"] in wanted]
        log(f"按 --only 过滤后 {len(games)} 条（请求 {len(wanted)} 个 slug）")
    log(f"清单 {len(manifest['games'])} 条，本次处理 {min(args.limit, len(games))} 条")

    api = Api(args.api, args.user, args.password)
    log("后台登录成功")

    cats = api.get("/categories").get("data") or []
    id_by_slug = {c["slug"]: c["id"] for c in cats}
    for key, value in CATEGORY_BY_SLUG.items():
        id_by_slug.setdefault(key, value)
    tag_map = ensure_tags(api, games)
    log(f"分类 {id_by_slug} 标签 {len(tag_map)} 个")

    def job(game: dict):
        try:
            if args.update_only:
                update_only(api, game, id_by_slug.get(game.get("category"), 1), tag_map)
                return
            if args.covers_only:
                server = refresh_cover(api, game)
            else:
                server = import_one(api, game, id_by_slug.get(game.get("category"), 1),
                                    tag_map, args.shots)
            if server:
                with lock:
                    COLORS.append(server)
        except Exception as exc:
            with lock:
                STATE["failed"] += 1
                ERRORS.append(f"{game.get('slug')}: {type(exc).__name__}: {exc}")

    with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
        pool.map(job, games[:args.limit])

    log(f"\n{'封面刷新' if args.covers_only else '导入完成'} {STATE['created']}，"
        f"跳过 {STATE['skipped']}，失败 {STATE['failed']}")
    log(f"服务端/采集端色调最大偏差 {STATE['hue_max_delta']:.2f} 度")
    if COLORS:
        path = os.path.join(ROOT, ".scrape", "flysheep", "server-colors.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        merged: dict[str, dict] = {}
        if os.path.exists(path):
            for row in json.load(open(path, encoding="utf-8")):
                merged[row["slug"]] = row
        for row in COLORS:
            merged[row["slug"]] = row
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(list(merged.values()), fh, ensure_ascii=False)
        log(f"服务端取色回写 -> {path}（累计 {len(merged)} 条）")
    for line in ERRORS[:8]:
        log("  ! " + line)
    if args.balance_wall:
        balance_wall_sql(json.load(open(MANIFEST, encoding="utf-8"))["games"],
                         os.path.join(ROOT, "database", "seed_flysheep_wall_order.sql"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
