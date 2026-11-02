#!/usr/bin/env python3
"""Converts the rendered PNG sprites in game/img/sprites to compact WebP (keeps transparency)."""
import os
from PIL import Image

D = os.path.join(os.path.dirname(__file__), '..', 'img', 'sprites')
total = 0
for f in sorted(os.listdir(D)):
    if not f.endswith('.png') or f.startswith('_'):
        continue
    src = os.path.join(D, f)
    im = Image.open(src)
    if f == 'bg-game.png':
        im = im.convert('RGB').resize((720, 1280), Image.LANCZOS)
        out = src[:-4] + '.webp'
        im.save(out, 'WEBP', quality=78, method=6)
    else:
        im = im.convert('RGBA').resize((192, 192), Image.LANCZOS)
        out = src[:-4] + '.webp'
        im.save(out, 'WEBP', quality=90, method=6)
    os.remove(src)
    total += os.path.getsize(out)
    print(f'{os.path.basename(out):22s} {os.path.getsize(out) // 1024:4d} KB')
print(f'total {total // 1024} KB')
