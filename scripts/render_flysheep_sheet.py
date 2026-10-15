#!/usr/bin/env python3
"""把 assets/flysheep/covers 的色调分桶结果拼成一张校验图，方便肉眼确认裁切与归类。

用法：python scripts/render_flysheep_sheet.py --per-tone 6 --out .scrape/flysheep/sheet.png
"""

from __future__ import annotations

import argparse
import collections
import json
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "flysheep", "manifest.json")

TILE_W, TILE_H = 180, 270          # 2:3
HEADER_H, FOOTER_H, GAP = 46, 26, 14


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-tone", type=int, default=6)
    ap.add_argument("--out", default=os.path.join(ROOT, ".scrape", "flysheep", "sheet.png"))
    args = ap.parse_args()

    data = json.load(open(MANIFEST, encoding="utf-8"))
    buckets = collections.defaultdict(list)
    for game in data["games"]:
        buckets[int(game["bucket"])].append(game)

    cols = max(len([b for b in buckets.values() if b]), 1)
    rows = args.per_tone
    width = GAP + cols * (GAP + TILE_W)
    height = GAP + HEADER_H + rows * (TILE_H + FOOTER_H) + GAP
    canvas = Image.new("RGB", (width, height), "#0f1219")
    draw = ImageDraw.Draw(canvas)

    for col, bucket in enumerate(sorted(buckets)):
        games = buckets[bucket][: rows * 4]
        meta = data["tone_buckets"][bucket]
        x = GAP + col * (GAP + TILE_W)
        accent = games[0]["accent"] if games else "#888888"
        draw.rectangle([x, GAP, x + TILE_W, GAP + HEADER_H - 8], fill=accent)
        draw.text((x + 8, GAP + 8), f"{meta['folder']}", fill="white")
        draw.text((x + 8, GAP + 26), f"hue {meta['hue_range']} · {meta['count']}", fill="#f2f2f2")
        for row in range(rows):
            if row >= len(games):
                break
            game = games[row]
            path = os.path.join(ROOT, game["cover"])
            y = GAP + HEADER_H + row * (TILE_H + FOOTER_H)
            try:
                with Image.open(path) as im:
                    im = im.convert("RGB")
                    ratio = im.size[0] / im.size[1]
                    im.thumbnail((TILE_W, TILE_H))
                    canvas.paste(im, (x, y))
            except Exception as exc:  # 缺图时留灰块，便于定位问题
                draw.rectangle([x, y, x + TILE_W, y + TILE_H], fill="#2a2f3a")
                draw.text((x + 6, y + 6), f"ERR {exc}"[:28], fill="#ff8080")
                continue
            draw.text((x + 2, y + TILE_H + 4), game["name"][:14], fill="#c9d1e0")
            draw.text((x + 2, y + TILE_H + 14), f"h{game['hue']:.0f} c{game['chroma']:.2f}",
                      fill="#7f8aa0")
            draw.rectangle([x, y, x + TILE_W - 1, y + TILE_H - 1], outline="#242a35")
            if abs(ratio - 2 / 3) > 0.01:
                draw.line([x, y, x + TILE_W, y + TILE_H], fill="#ff4d4d", width=3)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    canvas.save(args.out)
    print(f"sheet -> {args.out}  ({width}x{height}, {cols} 个色桶)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
