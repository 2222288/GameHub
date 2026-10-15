#!/usr/bin/env python3
"""用后端 CoverColorAnalyzer 的返回值校正封面文件夹归属。

采集端只做第一遍粗分桶；真正决定背景墙列号的是服务端算出的 cover_hue / cover_chroma
（它分析的是入库后重编码的 JPEG，与本地原图存在 0~15 度的边界抖动）。
本脚本把每个封面搬到服务端色桶对应的目录，并同步 manifest，使
「文件夹编号 == 背景墙列号」这条不变量在数据层面严格成立。

用法：python scripts/resync_flysheep_tones.py
"""

from __future__ import annotations

import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "flysheep", "manifest.json")
COLORS = os.path.join(ROOT, ".scrape", "flysheep", "server-colors.json")
COVERS = os.path.join(ROOT, "assets", "flysheep", "covers")

TONES = [
    "00-crimson", "01-ember", "02-amber", "03-gold", "04-lime", "05-green",
    "06-emerald", "07-teal", "08-azure", "09-indigo", "10-violet", "11-magenta",
    "12-neutral",
]
LABELS = ["绯红", "赤橙", "琥珀", "金黄", "黄绿", "森绿", "青翠",
          "青蓝", "湛蓝", "靛蓝", "紫罗兰", "品红", "中性"]
RANGES = ["0-30", "30-60", "60-90", "90-120", "120-150", "150-180", "180-210",
          "210-240", "240-270", "270-300", "300-330", "330-360", "低彩度"]


def bucket_of(hue: float | None, chroma: float | None) -> int:
    """与 CoverWall.tsx bucketFor() 完全一致。"""
    if chroma is None or hue is None:
        return 12
    if chroma < 0.025:
        return 12
    return int(((hue + 360) % 360) // 30)


def main() -> int:
    if not os.path.exists(COLORS):
        print("还没有 server-colors.json，请先跑 import_flysheep_covers.py")
        return 2

    server = {row["slug"]: row for row in json.load(open(COLORS, encoding="utf-8"))}
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    games = manifest["games"]

    moved = matched = pending = 0
    for game in games:
        row = server.get(game["slug"])
        if not row or row.get("hue") is None:
            pending += 1
            continue
        matched += 1
        target = bucket_of(row["hue"], row["chroma"])
        # 服务端色值成为唯一真值
        game.update({
            "hue": round(float(row["hue"]), 4),
            "chroma": round(float(row["chroma"]), 4),
            "accent": row.get("accent") or game.get("accent"),
            "server_bucket": target,
        })
        if target == int(game["bucket"]):
            continue
        old_rel = game["cover"]
        old_abs = os.path.join(ROOT, old_rel.replace("/", os.sep))
        new_folder = os.path.join(COVERS, TONES[target])
        os.makedirs(new_folder, exist_ok=True)
        new_abs = os.path.join(new_folder, os.path.basename(old_rel))
        if os.path.exists(old_abs):
            shutil.move(old_abs, new_abs)
            moved += 1
        game["bucket"] = target
        game["tone"] = TONES[target]
        game["tone_cn"] = LABELS[target]
        game["cover"] = f"assets/flysheep/covers/{TONES[target]}/{os.path.basename(old_rel)}"

    # 重新排背景墙轮转序（按校正后的桶）
    lanes: dict[int, list[dict]] = {}
    for game in games:
        lanes.setdefault(int(game["bucket"]), []).append(game)
    ranked, depth = [], 0
    while any(len(v) > depth for v in lanes.values()):
        for bucket in sorted(lanes):
            if depth < len(lanes[bucket]):
                ranked.append(lanes[bucket][depth])
        depth += 1
    for rank, game in enumerate(ranked):
        game["wall_rank"] = rank

    counts = {i: sum(1 for g in games if int(g["bucket"]) == i) for i in range(13)}

    # 采集按批推进，超出 --limit 的尾巴会留下多余文件；以 manifest 为准清理孤儿封面。
    # manifest 存的是仓库相对路径，磁盘遍历拿到的是绝对路径，必须先归一再比。
    expected = {os.path.normpath(os.path.join(ROOT, g["cover"])).lower() for g in games}
    on_disk = []
    for folder in sorted(os.listdir(COVERS)) if os.path.isdir(COVERS) else []:
        path = os.path.join(COVERS, folder)
        if not os.path.isdir(path):
            continue
        on_disk += [os.path.normpath(os.path.join(path, name))
                    for name in os.listdir(path) if name.lower().endswith(".jpg")]
    orphans = [p for p in on_disk if p.lower() not in expected]
    # 路径比对一旦写错就会把整批成品判成孤儿，超过一成就不动手，只报告
    if len(orphans) > max(64, len(on_disk) // 10):
        print(f"疑似比对异常：{len(orphans)}/{len(on_disk)} 个文件不在清单内，跳过清理")
    else:
        for path in orphans:
            os.remove(path)
        print(f"清理批处理尾巴留下的多余封面 {len(orphans)} 个")

    manifest["tone_buckets"] = [
        {"bucket": i, "folder": TONES[i], "hue_range": RANGES[i],
         "label": LABELS[i], "count": counts[i]} for i in range(13)
    ]
    manifest["total"] = len(games)
    manifest["color_source"] = "backend CoverColorAnalyzer"
    manifest["games"] = sorted(ranked, key=lambda g: g["cover"])
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)

    print(f"服务端色值覆盖 {matched}/{len(games)} 条，搬迁 {moved} 个封面，待导入 {pending} 条")
    for i, folder in enumerate(TONES):
        actual = len([f for f in os.listdir(os.path.join(COVERS, folder))
                      if f.endswith(".jpg")]) if os.path.isdir(os.path.join(COVERS, folder)) else 0
        flag = "" if actual == counts[i] else f"   <== 目录 {actual} 与清单 {counts[i]} 不一致"
        print(f"  {folder:<14} {counts[i]:>5}{flag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
