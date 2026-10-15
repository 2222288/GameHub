#!/usr/bin/env python3
"""离线复现首页背景墙：直接读 /api/v1/games/wall，按 CoverWall.tsx 的分列算法排版。

用途是校验「色调分桶 -> 背景墙列」这条链路在真实接口数据上的结果，
不依赖浏览器，也不改动前端代码。

用法：python scripts/render_wall_preview.py --width 1440 --height 810
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.request
from collections import defaultdict

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEUTRAL = 12


def column_count(width: int) -> int:
    """与 CoverWall.tsx columnCount() 一致。"""
    if width < 520:
        return 4
    if width < 760:
        return 5
    if width < 1100:
        return 7
    if width < 1500:
        return 9
    return 11


def bucket_for(game: dict) -> int:
    chroma = game.get("chroma")
    if chroma is None or chroma < 0.025:
        return NEUTRAL
    return int(((game.get("hue") or 0) + 360) % 360 // 30)


def circular_distance(a: int, b: int) -> int:
    if a == NEUTRAL or b == NEUTRAL:
        return 0 if a == b else 6
    return min(abs(a - b), 12 - abs(a - b))


def build_columns(games: list[dict], requested: int) -> list[dict]:
    """CoverWall.tsx buildWallColumns() 的等价实现。"""
    count = max(3, min(requested, 11))
    if not games:
        return []
    grouped: dict[int, list[dict]] = defaultdict(list)
    for game in games:
        grouped[bucket_for(game)].append(game)
    groups = [{"bucket": b, "items": list(v)} for b, v in sorted(grouped.items())]

    while len(groups) > count:
        smallest = min(groups, key=lambda g: len(g["items"]))
        target = min((g for g in groups if g is not smallest),
                     key=lambda g: circular_distance(g["bucket"], smallest["bucket"]))
        target["items"].extend(smallest["items"])
        groups = [g for g in groups if g is not smallest]

    alloc = {g["bucket"]: 1 for g in groups}
    while sum(alloc.values()) < count:
        best = max(groups, key=lambda g: len(g["items"]) / alloc[g["bucket"]])
        alloc[best["bucket"]] += 1

    max_size = max(len(g["items"]) for g in groups)
    lanes = []
    for group in groups:
        n = alloc[group["bucket"]]
        for lane in range(n):
            seed = [g for i, g in enumerate(group["items"]) if i % n == lane] or group["items"]
            offset = lane % len(seed)
            rotated = seed[offset:] + seed[:offset]
            items = [rotated[i % len(rotated)] for i in range(max(6, len(rotated)))]
            lanes.append({"bucket": group["bucket"], "density": len(group["items"]) / max_size,
                          "items": items, "lane": lane})
    lanes.sort(key=lambda l: (-l["density"], l["bucket"], l["lane"]))

    middle = (len(lanes) - 1) / 2
    order = sorted(range(len(lanes)), key=lambda i: (abs(i - middle), i))
    positioned = [None] * len(lanes)
    for slot, idx in enumerate(order):
        positioned[slot] = lanes[idx]

    out = []
    for index, lane in enumerate(positioned):
        edge = abs(index - middle) / middle if middle else 0
        wave_bucket = 6 if lane["bucket"] == NEUTRAL else lane["bucket"]
        wave = (__import__("math").sin(wave_bucket / 12 * __import__("math").pi * 4) + 1) * 2.2
        out.append({"bucket": lane["bucket"], "items": lane["items"], "edge": edge,
                    "duration": round(56 - lane["density"] * 24 + edge * 10 + wave)})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8080")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=810)
    ap.add_argument("--out", default=os.path.join(ROOT, ".scrape", "flysheep", "wall-preview.png"))
    ap.add_argument("--dump", default=os.path.join(ROOT, ".scrape", "flysheep", "wall-api.json"))
    args = ap.parse_args()

    req = urllib.request.Request(f"{args.api}/api/v1/games/wall?size=120",
                                 headers={"User-Agent": "Mozilla/5.0"})
    payload = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
    games = payload["data"]
    json.dump(payload, open(args.dump, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    cols = column_count(args.width)
    columns = build_columns(games, cols)
    if not columns:
        print("接口没有返回可上墙数据（游戏需要 PUBLISHED + 有封面 + wall_enabled）")
        return 1

    tile_w = max(1, args.width // len(columns))
    tile_h = int(tile_w * 1.5)
    canvas = Image.new("RGB", (tile_w * len(columns), args.height), "#171b27")
    draw = ImageDraw.Draw(canvas)
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    buckets = defaultdict(int)
    missing = [0]
    for game in games:
        buckets[bucket_for(game)] += 1

    for index, column in enumerate(columns):
        x = index * tile_w
        y = -(tile_h // 3) if index % 2 else 0          # 相邻列反向，取一个静态切片
        for game in column["items"]:
            path = lookup(game["slug"])
            if path:
                try:
                    with Image.open(path) as im:
                        canvas.paste(im.convert("RGB").resize((tile_w, tile_h), Image.LANCZOS), (x, y))
                except Exception:
                    draw.rectangle([x, y, x + tile_w, y + tile_h], fill="#222835")
            else:
                draw.rectangle([x, y, x + tile_w, y + tile_h], fill="#222835")
                missing[0] += 1
            # 边缘暗化必须是半透明叠加，CSS 里是 gradient + opacity
            alpha = int(255 * column["edge"] * 0.45)
            if alpha:
                top, bottom = max(0, y), min(canvas.height, y + tile_h)
                odraw.rectangle([x, top, x + tile_w, bottom], fill=(16, 18, 28, alpha))
            y += tile_h
            if y > canvas.height:
                break

    canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    summary = "  ".join(f"{b}:{buckets[b]}" for b in sorted(buckets))
    draw.rectangle([0, 0, canvas.width, 26], fill=(8, 10, 16))
    draw.text((10, 7), f"wall preview  cols={len(columns)} (css={cols})  items={len(games)}  "
                       f"bucket counts -> {summary}", fill="#dfe6f2")
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    canvas.save(args.out)
    print(f"preview -> {args.out}  ({canvas.width}x{canvas.height})")
    print(f"接口返回 {len(games)} 条，色桶分布 {dict(sorted(buckets.items()))}，"
          f"贴图缺失 {missing[0]} 张")
    return 0


INDEX: dict[str, str] = {}


def lookup(slug: str) -> str | None:
    """按 slug 在 assets/flysheep/covers/* 里定位成品封面。"""
    global INDEX
    if not INDEX:
        base = os.path.join(ROOT, "assets", "flysheep", "covers")
        for folder in os.listdir(base) if os.path.isdir(base) else []:
            path = os.path.join(base, folder)
            if not os.path.isdir(path):
                continue
            for name in os.listdir(path):
                if name.endswith(".jpg"):
                    INDEX[name[:-4]] = os.path.join(path, name)
    return INDEX.get(slug)


if __name__ == "__main__":
    raise SystemExit(main())
