#!/usr/bin/env python3
"""用 Steam 官方接口富化详情字段（开发商 / 发行商 / 发售日 / 长简介）。

参考站正文本身就是从 Steam 搬的一段短介绍，中位数只有 119 字，直接建详情页会偏空。
这里按条目里已解析出的 steam_app 调 `store.steampowered.com/api/appdetails?l=schinese`，
把官方 detailed_description / developers / publishers / release_date 补回 manifest，
再用 import_flysheep_covers.py --update-only 推回数据库。

响应按 appid 缓存到 .scrape/flysheep/steam/，重跑不再打网络。
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import html
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "flysheep", "manifest.json")
# v2：v1 用了 filters=basic,description，Steam 会裁掉 developers / publishers / release_date。
# 换请求参数时必须换缓存目录，否则旧条目会被当成已完成而永不补全。
CACHE = os.path.join(ROOT, ".scrape", "flysheep", "steam", "v2")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9"}
lock = threading.Lock()
STATS = {"ok": 0, "miss": 0, "fail": 0, "cache": 0, "skip": 0}


def log(msg: str) -> None:
    print(msg, flush=True)


def strip_html(fragment: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", fragment or "")
    text = re.sub(r"</(p|div|li|h[1-6])>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_release(raw: str | None) -> str | None:
    """Steam 的 release_date.date 是人读串：'2026 年 10 月 8 日' / 'Oct 8, 2026' / 'Coming soon'。"""
    if not raw:
        return None
    text = raw.strip()
    m = re.search(r"(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})", text)
    if not m:
        m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", text)
        if m:
            months = {mm: i + 1 for i, mm in enumerate(
                ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
            month = months.get(m.group(1)[:3])
            if month:
                return f"{int(m.group(3)):04d}-{month:02d}-{int(m.group(2)):02d}"
            return None
        return None
    year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not 1980 <= year <= 2030 or not 1 <= month <= 12 or not 1 <= day <= 31:
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def join_list(value) -> str | None:
    if isinstance(value, list):
        text = ", ".join(str(v).strip() for v in value if str(v).strip())
        return text[:128] or None
    return None


def fetch(app: str, deadline: float = 0.0) -> dict | None:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{app}.json")
    if os.path.exists(path):
        with lock:
            STATS["cache"] += 1
        raw = open(path, encoding="utf-8").read()
        return json.loads(raw) if raw.strip() else None
    if deadline and time.time() > deadline:
        with lock:
            STATS["skip"] += 1
        return None
    data = None
    # Steam 对高频 appdetails 会限流并挂住连接，所以短超时 + 单次重试，
    # 拿不到就留给下一轮（本轮由 --budget 控制总时长），不无限等。
    for attempt in range(2):
        try:
            url = f"https://store.steampowered.com/api/appdetails?appids={app}&l=schinese"
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=9) as resp:
                payload = json.loads(resp.read().decode("utf-8", "replace"))
            entry = (payload or {}).get(app) or {}
            data = entry.get("data") if entry.get("success") else {}
            break
        except Exception:
            if attempt == 0 and not deadline:
                time.sleep(0.8)
            elif attempt == 0:
                time.sleep(0.4)
            else:
                with lock:
                    STATS["fail"] += 1
                return None
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data or {}, fh, ensure_ascii=False)
    with lock:
        STATS["ok"] += 1
        if STATS["ok"] % 100 == 0:
            log(f"  Steam {STATS['ok']} 命中 / {STATS['fail']} 失败 / {STATS['cache']} 缓存")
    return data or {}


def enrich_game(game: dict, info: dict) -> int:
    """把 Steam 字段并入清单条目，返回改动的字段数。"""
    changed = 0
    developers = join_list(info.get("developers"))
    publishers = join_list(info.get("publishers"))
    if developers and not game.get("developer"):
        game["developer"] = developers
        changed += 1
    if publishers and not game.get("publisher"):
        game["publisher"] = publishers
        changed += 1
    release = parse_release((info.get("release_date") or {}).get("date"))
    if release and not game.get("release_date"):
        game["release_date"] = release
        changed += 1

    detail = strip_html(info.get("detailed_description") or "")
    detail = re.sub(r"\n?\[\?view=.*?\]", "", detail)          # 去掉 Steam 的“查看更多”锚
    detail = re.sub(r"\n?\[h\]|\[/h\]", "\n## ", detail)
    detail = re.sub(r"\n?\[b\](.*?)\[/b\]", r"**\1**", detail, flags=re.S)
    detail = re.sub(r"\n?\[i\](.*?)\[/i\]", r"*\1*", detail, flags=re.S)
    detail = re.sub(r"\n?\[list\[\*\]\](.*?)(?:\[/list\]|$)",
                    lambda m: "\n".join(f"- {line.strip()}" for line in m.group(1).split("[*]") if line.strip()),
                    detail, flags=re.S)
    detail = re.sub(r"\[[a-z/=\[\]-]+\]", "", detail, flags=re.I)
    detail = re.sub(r"\n{3,}", "\n\n", detail).strip()
    current = (game.get("description") or "").strip()
    if len(detail) > len(current) + 40:
        game["description"] = detail[:20000]
        changed += 1
    short = strip_html(info.get("short_description") or "")
    if short and len(short) > len(game.get("summary") or ""):
        game["summary"] = short[:500]
        changed += 1
    return changed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--budget", type=int, default=600,
                    help="本轮最多花多少秒打 Steam（0=不限，Steam 限流时不建议）")
    args = ap.parse_args()

    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    games = manifest["games"]
    todo = [g for g in games if g.get("steam_app")][: args.limit]
    deadline = time.time() + args.budget if args.budget else 0.0
    log(f"清单 {len(games)} 条，含 steam_app {len(todo)} 条，"
        f"已缓存 {len(os.listdir(CACHE)) if os.path.isdir(CACHE) else 0} 条"
        + (f"，本轮预算 {args.budget}s" if args.budget else "，不限时"))

    def job(game: dict):
        info = fetch(game["steam_app"], deadline)
        if not info:
            with lock:
                STATS["miss"] += 1
            return 0
        with lock:
            return enrich_game(game, info)

    touched = 0
    with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for delta in pool.map(job, todo):
            touched += delta

    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)

    have_dev = sum(1 for g in games if g.get("developer"))
    have_rel = sum(1 for g in games if g.get("release_date"))
    lens = [len(g.get("description") or "") for g in games]
    log(f"\n字段更新 {touched} 处；开发商 {have_dev}/{len(games)}，发售日 {have_rel}/{len(games)}")
    log(f"简介长度中位数 {sorted(lens)[len(lens)//2]}，>600 字 {sum(1 for l in lens if l > 600)} 条")
    log(f"Steam 命中 {STATS['ok']}，缓存 {STATS['cache']}，失败 {STATS['fail']}，"
        f"空/超预算 {STATS['miss']}（其中超预算跳过 {STATS['skip']}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
