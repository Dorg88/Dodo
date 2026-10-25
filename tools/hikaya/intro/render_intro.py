#!/usr/bin/env python3
"""Render the HIKAYA launch intro (HyperFrames) and install it in the app.

1. Put the three ORIGINAL logo files in tools/hikaya/intro/logos_original/:
       section.(png|jpg)   شعبة البحوث والدراسات — قسم الشؤون الدينية
       shrine.(png|jpg)    الأمانة العامة للعتبة الحسينية المقدسة
       hikaya.(png|jpg)    حكايا
2. python3 tools/hikaya/intro/render_intro.py

The script removes only the white background that touches the image edges
(white details inside a logo are kept), trims the margins, renders
index.html with `npx hyperframes render`, and writes:
    storybook/assets/brand/intro.mp4          the motion graphic played at launch
    storybook/assets/brand/logo_*.png         prepared logos (transparent)
Originals are never modified.

Needs: Node 22+, ffmpeg, Pillow, numpy, scipy. On a Mac: brew install node ffmpeg ;
pip3 install pillow numpy scipy. HyperFrames downloads its own headless Chrome
on first use (or set PRODUCER_HEADLESS_SHELL_PATH).
"""

import argparse
import glob
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
BRAND = os.path.join(REPO, "storybook", "assets", "brand")
NAMES = {"section": "logo_section.png", "shrine": "logo_shrine.png", "hikaya": "logo_hikaya.png"}


def find_original(folder, key):
    hits = sorted(glob.glob(os.path.join(folder, f"{key}.*")))
    return hits[0] if hits else None


def prepare_logo(src, dst, white=236, pad=0.04):
    """Make the edge-connected near-white background transparent, feather
    the edge, trim, and save as PNG."""
    im = Image.open(src).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3]
    near_white = rgb.min(axis=2) >= white
    labels, _ = ndimage.label(near_white)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    background = np.isin(labels, list(border))
    # soft edge: pixels next to the background fade by how close to white they are
    edge = ndimage.binary_dilation(background, iterations=2) & ~background
    whiteness = (rgb.min(axis=2) - 200) / 55.0
    alpha = a[..., 3].copy()
    alpha[background] = 0
    alpha[edge] = np.clip(255 * (1 - whiteness[edge]), 0, 255)
    a[..., 3] = alpha
    out = Image.fromarray(a.astype(np.uint8), "RGBA")
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    w, h = out.size
    p = int(max(w, h) * pad)
    canvas = Image.new("RGBA", (w + 2 * p, h + 2 * p), (0, 0, 0, 0))
    canvas.paste(out, (p, p))
    canvas.save(dst, optimize=True)
    return canvas.size


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--originals", default=os.path.join(HERE, "logos_original"))
    ap.add_argument("--quality", default="delivery", choices=["draft", "looks", "delivery"])
    ap.add_argument("--no-install", action="store_true", help="render only; do not copy into the app")
    args = ap.parse_args()

    missing = [k for k in NAMES if not find_original(args.originals, k)]
    if missing:
        sys.exit(f"missing original logo(s) in {args.originals}: {', '.join(k + '.png/.jpg' for k in missing)}")

    work = tempfile.mkdtemp(prefix="hikaya_intro_")
    project = os.path.join(work, "intro")
    shutil.copytree(HERE, project, ignore=shutil.ignore_patterns("logos_original", "out", "node_modules", "*.py"))
    os.makedirs(os.path.join(project, "logos"), exist_ok=True)
    for key, name in NAMES.items():
        size = prepare_logo(find_original(args.originals, key), os.path.join(project, "logos", name))
        print(f"prepared {key}: {size[0]}x{size[1]}")

    raw = os.path.join(project, "out", "intro_raw.mp4")
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    env = {**os.environ, "HYPERFRAMES_SKIP_SKILLS": "1", "DO_NOT_TRACK": "1"}
    subprocess.run(["npx", "--yes", "hyperframes@0.8.199", "render", "-o", raw, "-q", args.quality, "-f", "30"],
                   cwd=project, env=env, check=True)

    final = os.path.join(project, "out", "intro.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-an", "-c:v", "libx264", "-profile:v", "high",
                    "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "slow", "-movflags", "+faststart", final],
                   check=True)
    print(f"rendered {final} ({os.path.getsize(final) / 1e6:.1f} MB)")

    if not args.no_install:
        os.makedirs(BRAND, exist_ok=True)
        shutil.copy(final, os.path.join(BRAND, "intro.mp4"))
        for name in NAMES.values():
            shutil.copy(os.path.join(project, "logos", name), os.path.join(BRAND, name))
        print(f"installed into {BRAND}")
    print(f"work folder: {work}")


if __name__ == "__main__":
    main()
