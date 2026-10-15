#!/usr/bin/env python3
"""flysheep6.com 游戏封面采集管线。

流程：
  1. collect  通过 WordPress REST (`/wp-json/wp/v2/posts?_embed`) 枚举全站文章，
     解析标题 / 英文名 / 摘要 / 正文 / 配置需求 / 截图 / 网盘下载链接。
  2. fetch    为每篇文章挑选 2:3 竖版封面源（优先 Steam library_600x900 胶囊图），
     下载 -> 智能裁剪到 2:3 -> 归一化 -> OKLCH 取色 -> 按色调写入分桶文件夹。
  3. report   输出 manifest.json 与色调统计。

色调分桶与后端保持一致：CoverColorAnalyzer.java 用 24 个 OKLCH 区间挑出强调色，
CoverWall.tsx 再用 `chroma < 0.025 -> 中性桶 12`、`floor(hue / 30)` 决定列，
所以这里落盘的文件夹编号就是背景墙的列编号。
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import hashlib
import html
import json
import math
import os
import random
import re
import shutil
import struct
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageOps

BASE = "https://www.flysheep6.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, ".scrape", "flysheep")
RAW = os.path.join(WORK, "raw")
OUT = os.path.join(ROOT, "assets", "flysheep")
COVERS = os.path.join(OUT, "covers")

TARGET_RATIO = 2 / 3          # 图一实测 0.6671，与 .wall-cover 的 2/3 对齐
MAX_EDGE = 800                # 800x1200 上限，小图不放大
NEUTRAL_CHROMA = 0.025        # CoverWall.tsx NEUTRAL_BUCKET 判定阈值

# 12 个色相桶（每 30 度）+ 1 个中性桶，编号即背景墙列号
TONES = [
    ("00-crimson", "0-30", "绯红"),
    ("01-ember", "30-60", "赤橙"),
    ("02-amber", "60-90", "琥珀"),
    ("03-gold", "90-120", "金黄"),
    ("04-lime", "120-150", "黄绿"),
    ("05-green", "150-180", "森绿"),
    ("06-emerald", "180-210", "青翠"),
    ("07-teal", "210-240", "青蓝"),
    ("08-azure", "240-270", "湛蓝"),
    ("09-indigo", "270-300", "靛蓝"),
    ("10-violet", "300-330", "紫罗兰"),
    ("11-magenta", "330-360", "品红"),
    ("12-neutral", "低彩度", "中性"),
]

# 站点分类 -> GameHub category slug
CATEGORY_MAP = {
    "pc%e5%8d%95%e6%9c%ba%e5%a4%a7%e4%bd%9c": "pc",
    "%e5%b0%8f%e6%b8%b8%e6%88%8f-%e7%8b%ac%e7%ab%8b%e6%b8%b8%e6%88%8f": "indie",
    "vr%e6%b8%b8%e6%88%8f": "vr",
    "%e6%a8%a1%e6%8b%9f%e5%99%a8%e6%95%b4%e5%90%88%e6%b8%b8%e6%88%8f": "emulator",
}

MAIN_CATEGORIES = {
    "pc%e5%8d%95%e6%9c%ba%e5%a4%a7%e4%bd%9c": "PC单机大作",
    "%e5%b0%8f%e6%b8%b8%e6%88%8f-%e7%8b%ac%e7%ab%8b%e6%b8%b8%e6%88%8f": "小游戏/独立游戏",
    "vr%e6%b8%b8%e6%88%8f": "VR游戏",
    "%e6%a8%a1%e6%8b%9f%e5%99%a8%e6%95%b4%e5%90%88%e6%b8%b8%e6%88%8f": "模拟器整合游戏",
}

VERSION_TAGS = [
    "免安装中文版", "免安装豪华中文版", "免安装中文版", "豪华中文版", "中文版", "中文版本",
    "官方中文版", "完整中文版", "绿色中文版", "破解版", "精装版", "典藏版", "年度版",
    "完全版", "重制版", "学习版", "单机版", "全DLC", "含全DLC", "全解锁版", "全解锁",
    "解锁版", "集成版", "硬解版",
]
# v1.1.11 / V0.57 这类版本号在中文标题里常紧跟汉字，没有空格边界
VERSION_TOKEN = r"(?:(?<=\s)|^|(?<=[\u4e00-\u9fff]))(v\d[\w.\-]*)"
CRACK_GROUPS = ["RUNE", "TENOKE", "FLT", "CODEX", "EMPRESS", "PLAZA", "SKIDROW",
                "CPY", "VBS", "STEAMAPI", " Goldberg", "DevBreak", "ACRP", "FLT"]

THREAD_LOCAL = threading.local()
STATS = {"downloaded": 0, "cache": 0, "failed": 0}
SEEN_IMAGES: set[str] = set()
ERRORS: list[str] = []
lock = threading.Lock()


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------- HTTP ------

def http_get(url: str, timeout: float = 25.0, referer: bool = False,
             retries: int = 2) -> bytes | None:
    """GET 二进制。imgdb.cn 一类图床带 Referer 会 403，所以默认不发 Referer。"""
    for attempt in range(retries + 1):
        headers = {"User-Agent": UA, "Accept": "*/*", "Accept-Language": "zh-CN,zh;q=0.9"}
        if referer:
            headers["Referer"] = BASE + "/"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 429) and not referer:
                return http_get(url, timeout, True, 0)
            if exc.code in (404, 410, 451):
                return None
            if attempt >= retries:
                return None
        except Exception:
            if attempt >= retries:
                return None
        time.sleep(0.4 * (attempt + 1) + random.random() * 0.3)
    return None


def http_json(url: str) -> tuple[object, dict]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=40) as resp:
            return json.loads(resp.read().decode("utf-8")), dict(resp.headers)
    except Exception as exc:
        log(f"  ! json {url} -> {exc}")
        return None, {}


# ------------------------------------------------------------- collect ------

def clean_text(fragment: str) -> str:
    text = re.sub(r"<[^>]+>", " ", fragment or "")
    text = html.unescape(text)
    text = text.replace("\u00a0", " ").replace("[…]", "").replace("[&hellip;]", "")
    return re.sub(r"\s+", " ", text).strip()


def first_group(pattern: str, text: str) -> str | None:
    """返回第一个命中的非空捕获组，用于 file_size / developer / publisher。"""
    m = re.search(pattern, text or "", re.I)
    if not m:
        return None
    for value in m.groups():
        if value:
            return re.sub(r"\s+", " ", value).strip()[:200] or None
    return None


def parse_requirements(content: str) -> list[dict]:
    """正文里的『最低配置 / 推荐配置』段落 -> game_requirement 结构。"""
    out = []
    for label, kind in (("最低配置", "MINIMUM"), ("推荐配置", "RECOMMENDED")):
        m = re.search(re.escape(label) + r"\s*[:：]?\s*</strong>(.*?)(?=</p>|$)", content, re.S)
        if not m:
            continue
        block = re.sub(r"<[^>]+>", "\n", m.group(1))
        block = html.unescape(block)
        rows = {}

        def grab(*keys):
            for line in block.splitlines():
                line = line.strip()
                for key in keys:
                    if line.startswith(key):
                        value = re.sub(r"^" + re.escape(key) + r"\s*[:：]?", "", line).strip()
                        if value:
                            return value
            return None

        os_name = grab("操作系统")
        cpu = grab("处理器", "CPU")
        gpu = grab("显卡", "GPU")
        mem = grab("内存")
        storage = grab("存储空间", "硬盘")
        for line in block.splitlines():
            if "64 位" in line and not os_name:
                os_name = "64 位处理器和操作系统"
        rows.update({"type": kind, "os": os_name, "cpu": cpu, "gpu": gpu,
                     "memory": mem, "storage": storage})
        if any(rows.get(k) for k in ("os", "cpu", "gpu", "memory", "storage")):
            out.append(rows)
    return out


def parse_screenshots(content: str, limit: int = 6) -> list[str]:
    shots = []
    for src in re.findall(r'<img[^>]+src="([^"]+)"', content):
        low = src.lower()
        if "/ss_" in low or ".1920x1080" in low or ".600x338" in low:
            shots.append(src)
        elif "steam/apps" in low and "header" not in low and "capsule" not in low \
                and "library" not in low:
            shots.append(src)
    seen, uniq = set(), []
    for s in shots:
        if s not in seen:
            seen.add(s)
            uniq.append(s)
    return uniq[:limit]


PROVIDER_RULES = [
    ("夸克网盘", r"夸克|quark"),
    ("百度网盘", r"度盘|百度|pan\.baidu"),
    ("迅雷网盘", r"迅雷|xunlei"),
    ("115 网盘", r"115"),
    ("阿里云盘", r"阿里|alipan|aliyundrive"),
    ("蓝奏云", r"蓝奏|lanzou"),
    ("PikPak", r"pikpak"),
    ("磁力链接", r"magnet"),
    ("直连下载", r"点击下载|直接下载|下载"),
]


def parse_resource_links(content: str) -> list[dict]:
    """wp-block-button 里的下载按钮 + 正文裸链接 -> resource_link 结构。"""
    links, seen = [], set()
    for href, label in re.findall(
            r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', content, re.S):
        text = clean_text(label)
        href = html.unescape(href.strip())
        if not href.startswith(("http", "magnet")):
            continue
        if any(bad in href for bad in ("flysheep6.com", "hdslb.com", "baidu.com/link",
                                       "pan.xunlei.com/s/VP2Iki7RfYxc1E0jpco3ZjJSA1")):
            continue
        provider = None
        for name, pattern in PROVIDER_RULES:
            if re.search(pattern, text, re.I) or re.search(pattern, href, re.I):
                provider = name
                break
        if not provider:
            continue
        key = (provider, href.split("#")[0])
        if key in seen:
            continue
        seen.add(key)
        pwd = None
        m = re.search(r"[?&](?:pwd|password)=([A-Za-z0-9]+)", href)
        if m:
            pwd = m.group(1)
        else:
            m = re.search(r"提取码[:：\s]*([A-Za-z0-9]{4,8})", text)
            if m:
                pwd = m.group(1)
        links.append({"provider": provider, "url": href[:1000], "password": pwd,
                      "status": "UNKNOWN"})
        if len(links) >= 8:
            break
    return links


TITLE_PAREN = re.compile(r"[（(]([^（）()]*[A-Za-z][^（）()]*)[）)]")


def split_title(raw_title: str) -> tuple[str, str | None, str | None]:
    """`黑纱掠袭（Raiders of Blackveil）免安装中文版` -> (主名, 英文名, 版本后缀)"""
    title = clean_text(raw_title)
    title = re.sub(r"^【[^】]*】", "", title).strip()
    english = None
    m = TITLE_PAREN.search(title)
    if m:
        inner = m.group(1).strip()
        if re.search(r"[A-Za-z]", inner) and len(inner) <= 90:
            english = re.sub(r"\s+", " ", inner)
    primary = TITLE_PAREN.sub("", title, count=1 if english else 0).strip(" -—·、，,")

    # 取最先出现的版本标记（v1.7.106 / RUNE / 免安装中文版…），整段留给 currentVersion
    markers = [tag for tag in CRACK_GROUPS + VERSION_TAGS if tag.strip()]
    hits = [(primary.lower().find(tag.lower()), tag) for tag in markers]
    hits += [(m.start(1), m.group(1)) for m in re.finditer(VERSION_TOKEN, primary, re.I)]
    hits = [(i, t) for i, t in hits if i > 0]
    tail = None
    if hits:
        idx = min(i for i, _ in hits)
        tail = primary[idx:].strip()
        primary = primary[:idx].strip(" -—·，,")
    if not primary:
        primary = title[:60]
    return primary[:128], (english[:128] if english else None), (tail[:64] if tail else None)


def ascii_slug(english: str | None, primary: str, post_id: int) -> str:
    seed = (english or primary or "").lower()
    seed = re.sub(r"[^a-z0-9]+", "-", seed).strip("-")
    if len(seed) < 3:
        seed = ""
    tail = f"fs{post_id}"
    return ((seed + "-" if seed else "") + tail)[:160]


def description_from_content(content: str) -> str:
    """正文 -> 精简 Markdown：保留段落 / 小标题 / 引用，图片交给截图区。"""
    body = re.sub(r"<(script|style|iframe)[^>]*>.*?</\1>", " ", content, flags=re.S | re.I)
    body = re.sub(r'<div class="mpv-shaka-wrapper".*?</div>\s*</div>', " ", body, flags=re.S)
    parts = []
    for tag, attr, text in re.findall(r"<(h[2-4]|p|li|blockquote)([^>]*)>(.*?)</\1>",
                                      body, re.S | re.I):
        if "wp-block-button" in attr or "element-button" in attr:
            continue
        text = re.sub(r"<br\s*/?>", "\n", text)
        text = re.sub(r"<strong>(.*?)</strong>", r"**\1**", text, flags=re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = html.unescape(text)
        text = re.sub(r"[ \t]+", " ", text).strip()
        text = re.sub(r"\n{2,}", "\n", text)
        if not text or len(text) < 4:
            continue
        if text.startswith(("https://", "http://")) and len(text) > 60:
            continue
        # 配置需求与站点宣传语在详情页有专门区块，正文里剔除避免重复
        if re.match(r"^(\*\*)?(最低配置|推荐配置|需要 64 位|UP测试|更多游戏)", text) \
                or "游戏请放在全英文路径" in text or "常用游戏软件安装运行方法" in text:
            continue
        prefix = "## " if tag.lower().startswith("h") else ("- " if tag.lower() == "li" else "> ")
        parts.append(prefix + text.replace("\n", "  \n" if prefix == "> " else "\n"))
    merged, dedup = [], set()
    for p in parts:
        key = p[:80]
        if key in dedup:
            continue
        dedup.add(key)
        merged.append(p)
    text = "\n\n".join(merged)
    return re.sub(r"\n{3,}", "\n\n", text)[:20000]


def as_int(value) -> int:
    """WP REST 的尺寸字段有时是字符串，统一转 int 免得后面做比例运算炸掉。"""
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def collect(pages: int | None, per_page: int = 100) -> list[dict]:
    """枚举全站文章。总页数取自第一页真实响应的 X-WP-TotalPages，避免探测请求丢头。"""
    posts: list[dict] = []
    data, headers = http_json(f"{BASE}/wp-json/wp/v2/posts?per_page={per_page}&page=1&_embed")
    if not data:
        log("首页枚举失败，放弃")
        return posts
    total = int(headers.get("X-WP-Total") or 0)
    total_pages = int(headers.get("X-WP-TotalPages") or 1)
    if pages:
        total_pages = min(total_pages, pages)
    log(f"站点文章总数 {total}，枚举 {total_pages} 页 x {per_page}")
    posts.extend(normalize_post(p) for p in data)
    log(f"  page 1/{total_pages} 累计 {len(posts)}")

    for page in range(2, total_pages + 1):
        for attempt in range(3):
            data, _ = http_json(f"{BASE}/wp-json/wp/v2/posts?per_page={per_page}&page={page}&_embed")
            if data:
                break
            time.sleep(1.5 * (attempt + 1))
        if not data:
            log(f"  page {page} 连续失败，跳过")
            continue
        posts.extend(normalize_post(p) for p in data)
        if page % 5 == 0 or page == total_pages:
            log(f"  page {page}/{total_pages} 累计 {len(posts)}")
        time.sleep(0.25 + random.random() * 0.25)
    return posts


def normalize_post(p: dict) -> dict:
    emb = p.get("_embedded") or {}
    media = (emb.get("wp:featuredmedia") or [{}])[0] or {}
    md = media.get("media_details") or {}
    terms = [t for group in emb.get("wp:term") or [] for t in (group or [])]
    cats = [t for t in terms if t.get("taxonomy") == "category"]
    content = html.unescape(p.get("content", {}).get("rendered", "") or "")
    title_raw = clean_text(p.get("title", {}).get("rendered", ""))
    primary, english, tail = split_title(title_raw)

    steam_ids = re.findall(r"steam/apps/(\d+)/", content)
    featured = media.get("source_url")
    if featured:
        steam_ids = re.findall(r"steam/apps/(\d+)/", featured) + steam_ids
    steam_app = steam_ids[0] if steam_ids else None

    slug_terms = {c.get("slug", "") for c in cats}
    category = "pc"
    if slug_terms & set(CATEGORY_MAP):
        for s in slug_terms:
            if s in CATEGORY_MAP:
                category = CATEGORY_MAP[s]
                break
    names = [c.get("name", "") for c in cats if c.get("name")]
    subcats = [n for n in names if n not in MAIN_CATEGORIES.values()
               and not n.startswith(("需更新", "订阅号", "已更新"))]

    plain = clean_text(content)
    return {
        "id": p["id"],
        "link": p.get("link"),
        "date": p.get("date"),
        "modified": p.get("modified"),
        "title": title_raw,
        "name": primary,
        "english_name": english,
        "version_tag": tail,
        "summary": clean_text(p.get("excerpt", {}).get("rendered", ""))[:500],
        "description": description_from_content(content),
        "featured_url": featured,
        "featured_w": as_int(md.get("width")),
        "featured_h": as_int(md.get("height")),
        "steam_app": steam_app,
        "category": category,
        "categories": names,
        "subcategories": subcats[:6],
        "screenshots": parse_screenshots(content),
        "requirements": parse_requirements(content),
        "resource_links": parse_resource_links(content),
        "file_size": first_group(
            r"(?:文件大小|游戏大小|安装大小)\s*[:：]?\s*([\d.]+\s*[KMGT]B?)|([\d.]+\s*(?:GB|MB|G|M)\b)", plain),
        "developer": first_group(r"开发(?:商|组)\s*[:：]\s*([^\n<]{2,120})", plain),
        "publisher": first_group(r"发行(?:商|行商)\s*[:：]\s*([^\n<]{2,120})", plain),
        "slug": ascii_slug(english, primary, p["id"]),
    }


# -------------------------------------------------------------- imaging -----

def decode_image(blob: bytes) -> Image.Image | None:
    import io
    try:
        im = Image.open(io.BytesIO(blob))
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            background = Image.new("RGBA", im.size, (18, 18, 27, 255))
            im = Image.alpha_composite(background, im)
        return im.convert("RGB")
    except Exception:
        return None


def energy_profile(im: Image.Image, axis: str, samples: int = 256) -> np.ndarray:
    """梯度能量 + 中心先验，用于把横图智能裁成竖图时保住主体。"""
    w, h = im.size
    if axis == "x":
        size = (samples, max(8, int(samples * h / max(w, 1))))
    else:
        size = (max(8, int(samples * w / max(h, 1))), samples)
    small = im.resize(size, Image.BOX).convert("L")
    a = np.asarray(small, dtype=np.float32) / 255.0
    gx = np.abs(np.diff(a, axis=1)).sum(0) if a.shape[1] > 1 else np.zeros(a.shape[1])
    gy = np.abs(np.diff(a, axis=0)).sum(1) if a.shape[0] > 1 else np.zeros(a.shape[0])
    profile = gx if axis == "x" else gy
    n = len(profile)
    if axis == "x":
        profile = np.convolve(profile, np.ones(3) / 3, mode="same")
    else:
        profile = np.convolve(profile, np.ones(3) / 3, mode="same")
    center = (n - 1) / 2
    sigma = max(1.0, n / 3.2)
    prior = np.exp(-((np.arange(n) - center) ** 2) / (2 * sigma * sigma))
    return profile * (0.45 + 0.55 * prior)


def pick_window(profile: np.ndarray, span: float) -> int:
    n = len(profile)
    take = max(1, int(round(n * span)))
    if take >= n:
        return 0
    csum = np.concatenate([[0.0], np.cumsum(profile, dtype=np.float64)])
    window = csum[take:] - csum[:-take]
    best = int(np.argmax(window))
    return best / max(1, (n - take))


def crop_to_ratio(im: Image.Image, ratio: float = TARGET_RATIO) -> Image.Image:
    w, h = im.size
    cur = w / h
    if abs(cur - ratio) < 0.01:
        return im
    if cur > ratio:                       # 太宽：裁掉左右
        cw = int(round(h * ratio))
        span = cw / w
        start = pick_window(energy_profile(im, "x"), span)
        x0 = int(round(start * (w - cw)))
        x0 = max(0, min(w - cw, x0))
        return im.crop((x0, 0, x0 + cw, h))
    ch = int(round(w / ratio))            # 太高：裁掉上下
    span = ch / h
    start = pick_window(energy_profile(im, "y"), span)
    y0 = int(round(start * (h - ch)))
    y0 = max(0, min(h - ch, y0))
    return im.crop((0, y0, w, y0 + ch))


def normalize_cover(im: Image.Image) -> tuple[Image.Image, int, int]:
    cropped = crop_to_ratio(im)
    src_w, src_h = cropped.size
    out_w = min(src_w, MAX_EDGE)
    out_w -= out_w % 2
    out_h = int(round(out_w * 3 / 2))
    if out_h > src_h:                     # 不放大：以源高度为准反推
        out_h = src_h - (src_h % 2)
        out_w = int(round(out_h * 2 / 3))
        out_w -= out_w % 2
    if out_w < 240 or out_h < 360:
        return cropped, 0, 0
    return cropped.resize((out_w, out_h), Image.LANCZOS), out_w, out_h


# ------------------------------------------------------- oklch analysis -----

def _linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def analyze_profile(im: Image.Image) -> dict | None:
    """CoverColorAnalyzer.java 的等价实现（24 桶 + 中性降权 0.12）。"""
    w, h = im.size
    step = max(1, max(w, h) // 96)
    # 与 Java 的 ImageReadParam.setSourceSubsampling(step, step, 0, 0) 对齐：
    # 按固定步长取样，而不是 resize 的最近邻重映射，否则两边挑出的像素集合不同，
    # 色相会漂移到最多一个 30 度桶。
    arr = np.asarray(im, dtype=np.float32)[::step, ::step, :3] / 255.0
    sh, sw = arr.shape[0], arr.shape[1]
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    rl, gl, bl = _linear(r), _linear(g), _linear(b)
    l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
    m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
    s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl
    lr, mr, sr = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    L = 0.2104542553 * lr + 0.7936177850 * mr - 0.0040720468 * sr
    A = 1.9779984951 * lr - 2.4285922050 * mr + 0.4505937099 * sr
    B = 0.0259040371 * lr + 0.7827717662 * mr - 0.8086757660 * sr
    C = np.sqrt(A * A + B * B)
    H = np.degrees(np.arctan2(B, A)) % 360.0

    xs = np.arange(sw)[None, :]
    ys = np.arange(sh)[:, None]
    edge_x = np.minimum(xs + 1.0, sw - xs) / (sw / 2.0)
    edge_y = np.minimum(ys + 1.0, sh - ys) / (sh / 2.0)
    pos = 0.72 + 0.28 * np.minimum(1.0, np.minimum(edge_x, edge_y))

    neutral_mask = (L < 0.04) | (L > 0.98) | (C < NEUTRAL_CHROMA)
    colourful = ~neutral_mask
    weight_n = pos * 0.12
    n_w = float(weight_n[neutral_mask].sum())
    n_c = float((C[neutral_mask] * weight_n[neutral_mask]).sum())
    n_l = float((L[neutral_mask] * weight_n[neutral_mask]).sum())
    n_rgb = [float((ch[neutral_mask] * weight_n[neutral_mask]).sum()) for ch in (r, g, b)]

    sat_w = np.minimum(1.0, C / 0.18)
    light_w = np.maximum(0.2, 1.0 - np.abs(L - 0.56) * 1.35)
    weight_c = (0.2 + 0.8 * sat_w) * light_w * pos

    idx = np.minimum(23, np.floor(H / 15.0)).astype(np.int64)
    acc_w = np.zeros(24)
    acc_sin = np.zeros(24)
    acc_cos = np.zeros(24)
    acc_c = np.zeros(24)
    acc_l = np.zeros(24)
    acc_rgb = np.zeros((24, 3))
    rad = np.radians(H)
    flat = idx[colourful].ravel()
    def add(dst, vals):
        np.add.at(dst, flat, vals[colourful].ravel())
    add(acc_w, weight_c)
    add(acc_sin, np.sin(rad) * weight_c)
    add(acc_cos, np.cos(rad) * weight_c)
    add(acc_c, C * weight_c)
    add(acc_l, L * weight_c)
    for k, ch in enumerate((r, g, b)):
        add(acc_rgb[:, k], ch * weight_c)

    colourful_weight = float(acc_w.sum())
    best = int(np.argmax(acc_w))
    if acc_w[best] == 0 and n_w == 0:
        return None

    def hexof(vec):
        rr, gg, bb = [max(0, min(255, int(round(255 * v)))) for v in vec]
        return f"#{rr:02x}{gg:02x}{bb:02x}"

    if acc_w[best] == 0 or n_w > acc_w[best]:
        return {"hue": 0.0, "chroma": round(n_c / n_w, 4), "lightness": round(n_l / n_w, 4),
                "accent": hexof([v / n_w for v in n_rgb]),
                "confidence": round(n_w / (n_w + colourful_weight), 4)}

    hue = math.degrees(math.atan2(acc_sin[best] / acc_w[best], acc_cos[best] / acc_w[best])) % 360.0
    return {"hue": round(hue, 4), "chroma": round(acc_c[best] / acc_w[best], 4),
            "lightness": round(acc_l[best] / acc_w[best], 4),
            "accent": hexof(acc_rgb[best] / acc_w[best]),
            "confidence": round(float(acc_w[best]) / colourful_weight, 4)}


def wall_bucket(profile: dict) -> int:
    if profile["chroma"] < NEUTRAL_CHROMA:
        return 12
    return int(((profile["hue"] + 360) % 360) // 30)


# ---------------------------------------------------------------- fetch -----

def cover_candidates(post: dict) -> list[str]:
    """按预期画质排出封面源优先级。

    站点自己的竖版特色图（760x1140）最好；Steam 胶囊图分 600x900 和 300x450 两档；
    横图（460x215）裁成 2:3 会只剩 143px，所以横版游戏改用实机截图裁切兜底。
    """
    urls: list[str] = []
    feat = post.get("featured_url")
    fw, fh = as_int(post.get("featured_w")), as_int(post.get("featured_h"))
    portrait = bool(feat) and (not fw or not fh or fw / fh <= 0.86)

    if portrait and fw >= 480:
        urls.append(feat)
    app = post.get("steam_app")
    if app:
        urls.append(f"https://shared.cdn.queniuqe.com/store_item_assets/steam/apps/{app}/library_600x900.jpg")
        urls.append(f"https://cdn.cloudflare.steamstatic.com/steam/apps/{app}/library_600x900.jpg")
    if portrait and 0 < fw < 480:
        urls.append(feat)
    if feat and not portrait and fw >= 1000:
        urls.append(feat)
    urls.extend((post.get("screenshots") or [])[:3])
    if portrait and not fw:
        urls.append(feat)
    return [u for u in dict.fromkeys(u for u in urls if u) if u.startswith("http")]


def cache_path(url: str) -> str:
    return os.path.join(RAW, hashlib.md5(url.encode()).hexdigest() + ".img")


def fetch_bytes(url: str) -> bytes | None:
    path = cache_path(url)
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        STATS["cache"] += 1
        with open(path, "rb") as fh:
            return fh.read()
    blob = http_get(url)
    if not blob or len(blob) < 1024:
        blob = blob or b""
        if blob:
            STATS["failed"] += 1
        return None
    head = blob[:16]
    if not (head.startswith(b"\xff\xd8\xff") or head.startswith(b"\x89PNG")
            or (head[:4] == b"RIFF" and head[8:12] == b"WEBP")):
        STATS["failed"] += 1
        return None
    STATS["downloaded"] += 1
    os.makedirs(RAW, exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(blob)
    return blob


def process_post(post: dict) -> dict | None:
    for url in cover_candidates(post):
        blob = fetch_bytes(url)
        if not blob:
            continue
        im = decode_image(blob)
        if im is None:
            continue
        if min(im.size) < 200:
            continue
        norm, out_w, out_h = normalize_cover(im)
        if out_w == 0:
            continue
        fingerprint = hashlib.sha1(norm.tobytes()).hexdigest()[:16]
        with lock:
            if fingerprint in SEEN_IMAGES:
                return None
            SEEN_IMAGES.add(fingerprint)
        profile = analyze_profile(norm)
        if profile is None:
            continue
        bucket = wall_bucket(profile)
        tone = TONES[bucket][0]
        folder = os.path.join(COVERS, tone)
        os.makedirs(folder, exist_ok=True)
        rel = f"assets/flysheep/covers/{tone}/{post['slug']}.jpg"
        abs_path = os.path.join(ROOT, rel)
        norm.save(abs_path, "JPEG", quality=84, optimize=True, progressive=True)

        # 取色必须发生在编码之后：后端 CoverColorAnalyzer 读的是入库的那份 JPEG，
        # 用编码前的内存图分析会在色相边界上漂出整桶误差。
        with Image.open(abs_path) as saved:
            profile = analyze_profile(saved.convert("RGB")) or profile
            bucket = wall_bucket(profile)
            tone = TONES[bucket][0]
            if os.path.dirname(abs_path) != os.path.join(COVERS, tone):
                target_dir = os.path.join(COVERS, tone)
                os.makedirs(target_dir, exist_ok=True)
                moved = os.path.join(target_dir, os.path.basename(rel))
                shutil.move(abs_path, moved)
                rel = f"assets/flysheep/covers/{tone}/{post['slug']}.jpg"

        record = dict(post)
        record.update({
            "cover": rel,
            "cover_w": out_w,
            "cover_h": out_h,
            "cover_source": url,
            "tone": tone,
            "tone_cn": TONES[bucket][2],
            "bucket": bucket,
            **profile,
        })
        return record
    return None


def run(limit: int, workers: int, pages: int | None, resume: bool) -> None:
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(COVERS, exist_ok=True)
    index_file = os.path.join(WORK, "posts.json")
    os.makedirs(WORK, exist_ok=True)

    if resume and os.path.exists(index_file):
        posts = json.load(open(index_file, encoding="utf-8"))
        log(f"复用已缓存条目 {len(posts)} 条")
    else:
        posts = collect(pages)
        json.dump(posts, open(index_file, "w", encoding="utf-8"), ensure_ascii=False)
        log(f"条目落盘 {index_file} ({len(posts)})")

    manifest_path = os.path.join(OUT, "manifest.json")
    done: dict[str, dict] = {}
    if resume and os.path.exists(manifest_path):
        for row in json.load(open(manifest_path, encoding="utf-8"))["games"]:
            done[row["slug"]] = row
        log(f"已处理 {len(done)} 个封面，继续补齐")

    # 去重：同一 Steam 子应用 / 同名游戏只保留最新一条
    seen_app, seen_name, queue = set(), set(), []
    for post in posts:
        app = post.get("steam_app")
        name_key = (post.get("english_name") or post.get("name") or "").lower().strip()
        if app in seen_app or (name_key and name_key in seen_name):
            continue
        if app:
            seen_app.add(app)
        if name_key:
            seen_name.add(name_key)
        queue.append(post)

    results: list[dict] = [done[p["slug"]] for p in queue if p["slug"] in done]
    pending = [p for p in queue if p["slug"] not in done]
    log(f"去重后候选 {len(queue)}，待抓取 {len(pending)}")

    lock = threading.Lock()
    counter = {"ok": len(results)}

    def work(post: dict):
        try:
            rec = process_post(post)
        except Exception as exc:
            rec = None
            with lock:
                ERRORS.append(f"{post.get('slug')}: {type(exc).__name__}: {exc}")
        with lock:
            if rec:
                results.append(rec)
                counter["ok"] += 1
                if counter["ok"] % 50 == 0:
                    log(f"  完成 {counter['ok']}/{limit}  "
                        f"下载{STATS['downloaded']} 缓存{STATS['cache']} 失败{STATS['failed']}")
        return rec

    batch = 64
    for start in range(0, len(pending), batch):
        if len(results) >= limit:
            break
        chunk = pending[start:start + batch]
        with cf.ThreadPoolExecutor(max_workers=workers) as pool:
            list(pool.map(work, chunk))

    extras = results[limit:]
    results = results[:limit]
    for extra in extras:                      # 批量收尾会多写几张，保持磁盘与清单一致
        try:
            os.remove(os.path.join(ROOT, extra["cover"].replace("/", os.sep)))
        except OSError:
            pass
    write_manifest(results)
    report(results)
    if ERRORS:
        log(f"\n处理异常 {len(ERRORS)} 条，样例：")
        for line in ERRORS[:5]:
            log("  " + line)


def write_manifest(games: list[dict]) -> None:
    buckets = {}
    for g in games:
        buckets.setdefault(g["bucket"], 0)
        buckets[g["bucket"]] += 1
    lanes: dict[int, list[dict]] = {}
    for g in games:
        lanes.setdefault(g["bucket"], []).append(g)
    ranked, depth = [], 0
    while any(len(v) > depth for v in lanes.values()):
        for bucket in sorted(lanes):
            if depth < len(lanes[bucket]):
                ranked.append(lanes[bucket][depth])
        depth += 1
    for rank, g in enumerate(ranked):
        g["wall_rank"] = rank
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "source": BASE,
        "ratio": "2:3",
        "ratio_value": round(TARGET_RATIO, 4),
        "total": len(ranked),
        "tone_buckets": [
            {"bucket": i, "folder": TONES[i][0], "hue_range": TONES[i][1],
             "label": TONES[i][2], "count": sum(1 for g in ranked if g["bucket"] == i)}
            for i in range(len(TONES))
        ],
        "games": sorted(ranked, key=lambda g: g["cover"]),
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    write_readme(ranked)


def write_readme(games: list[dict]) -> None:
    """在封面根目录留下分桶说明，让文件夹本身就是背景墙的列定义。"""
    lines = [
        "# 游戏封面色调分桶",
        "",
        f"来源：{BASE}（WordPress REST 全站枚举），共 {len(games)} 张，统一比例 **2:3**"
        f"（参考站卡片实测宽/高 = {round(TARGET_RATIO, 4)}，与 `frontend/src/index.css` 里"
        " `.wall-cover { aspect-ratio: 2 / 3 }` 一致）。",
        "",
        "分桶规则与线上渲染完全对齐，文件夹编号即背景墙列编号：",
        "",
        "- 取色：`CoverColorAnalyzer.java` 的等价实现（OKLCH、24 个色相区间、"
        "纯黑/纯白/低彩度像素降权 0.12）。",
        "- 入桶：`CoverWall.tsx` 的 `bucketFor()` —— 彩度 < 0.025 进中性桶，否则 `floor(hue / 30)`。",
        "",
        "| 目录 | OKLCH 色相 | 色桶 | 数量 | 代表色 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for bucket, (folder, rng, label) in enumerate(TONES):
        members = [g for g in games if int(g["bucket"]) == bucket]
        accent = members[0]["accent"] if members else "-"
        lines.append(f"| `{folder}/` | {rng} | {label} | {len(members)} | {accent} |")
    lines += [
        "",
        "重新生成：",
        "",
        "```bash",
        "python scripts/crawl_flysheep_covers.py --limit 1000 --workers 18 --fresh",
        "python scripts/render_flysheep_sheet.py --per-tone 6",
        "```",
        "",
    ]
    with open(os.path.join(COVERS, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def report(games: list[dict]) -> None:
    log("\n色调分桶结果：")
    for i, (folder, rng, label) in enumerate(TONES):
        n = sum(1 for g in games if g["bucket"] == i)
        log(f"  {folder:<14} hue {rng:<8} {label:<4} {n:>5}  {'#' * min(60, n // 2)}")
    log(f"\n合计 {len(games)} 张 2:3 封面 -> {COVERS}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--pages", type=int, default=0, help="只枚举前 N 页（0=全站）")
    ap.add_argument("--fresh", action="store_true", help="忽略缓存重新枚举")
    args = ap.parse_args()
    run(args.limit, args.workers, args.pages or None, resume=not args.fresh)
    return 0


if __name__ == "__main__":
    sys.exit(main())
