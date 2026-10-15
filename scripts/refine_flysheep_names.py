#!/usr/bin/env python3
"""用最新的 split_title 规则重算清单里的中文主名 / 英文名 / 版本后缀。

只改文本，不重新选集、不重新下载，所以已经和后端对齐好的 1000 张封面与色桶不受影响。
改完再跑 `import_flysheep_covers.py --update-only` 推回数据库。
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets", "flysheep", "manifest.json")

spec = importlib.util.spec_from_file_location(
    "crawler", os.path.join(ROOT, "scripts", "crawl_flysheep_covers.py"))
crawler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crawler)


def main() -> int:
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    changed = 0
    samples = []
    for game in manifest["games"]:
        title = game.get("title") or game.get("name")
        name, english, tail = crawler.split_title(title)
        before = (game.get("name"), game.get("english_name"), game.get("version_tag"))
        if not name:
            continue
        game["name"] = name
        game["english_name"] = english or game.get("english_name")
        game["version_tag"] = tail or game.get("version_tag")
        if before != (game["name"], game["english_name"], game["version_tag"]):
            changed += 1
            if len(samples) < 8:
                samples.append(f"  {before[0]!r} -> {name!r}  (版本 {tail!r})")
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print(f"重算 {len(manifest['games'])} 条，改名 {changed} 条")
    print("\n".join(samples))
    return 0


if __name__ == "__main__":
    sys.exit(main())
