#!/usr/bin/env python3
"""يركّب رسومات tools/art/out (من render-art.js) إلى صور اللعبة في img/:
   - القاعة: إسقاط الجدران والأرضية والسقف بالمنظور، الفوانيس والنباتات، توهّج (bloom)، تدرّج لوني، عمق ميدان.
   - الصحن الخارجي: طبقات منفصلة مقصوصة + ملف مواضعها (لتُرمَّم كلٌّ على حدة).
   - القطع والواجهة: تصغير وتحويل إلى WebP.
   التشغيل: python3 tools/post-art.py [hall] [home] [tiles] [ui]"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'art', 'out')
GAME = os.path.dirname(HERE)
ART = os.path.join(GAME, 'img', 'art')
SPR = os.path.join(GAME, 'img', 'sprites')
UI = os.path.join(GAME, 'img', 'ui')
for d in (ART, SPR, UI):
    os.makedirs(d, exist_ok=True)

W, H = 1080, 1920


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def homography(src, dst):
    """معاملات PIL (من نقطة الإخراج إلى نقطة المصدر) لأربع نقاط متقابلة"""
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()


def warp(tex, quad, size, ss):
    """يسقط النسيج على رباعي (أعلى-يسار، أعلى-يمين، أسفل-يمين، أسفل-يسار) في لوحة بحجم size×ss"""
    w, h = tex.size
    c = homography([(0, 0), (w, 0), (w, h), (0, h)], [(x * ss, y * ss) for x, y in quad])
    return tex.transform((size[0] * ss, size[1] * ss), Image.PERSPECTIVE, c, resample=Image.BICUBIC)


def mip(tex, k):
    """نسخة مصغّرة ثم مكبّرة (تقلل التموّج في الأجزاء البعيدة)"""
    w, h = tex.size
    return tex.resize((max(1, w // k), max(1, h // k)), Image.LANCZOS).resize((w, h), Image.BICUBIC)


def warp_depth(tex, quad, size, ss, axis, far_at_start):
    """إسقاط مع تنعيم حسب العمق: الجزء البعيد من نسخة ناعمة"""
    sharp = warp(tex, quad, size, ss)
    soft = warp(mip(tex, 3), quad, size, ss)
    w, h = tex.size
    grad = np.linspace(0, 1, w if axis == 'u' else h, dtype=np.float32)
    if not far_at_start:
        grad = grad[::-1]
    g = np.clip((1 - grad) * 1.6 - 0.3, 0, 1)  # 1 = بعيد
    if axis == 'u':
        m = np.tile(g[None, :], (h, 1))
    else:
        m = np.tile(g[:, None], (1, w))
    mask = Image.fromarray((m * 255).astype(np.uint8), 'L')
    mask_w = warp(Image.merge('RGBA', (mask, mask, mask, mask)), quad, size, ss).split()[0]
    return Image.composite(soft, sharp, mask_w)


def bloom(img, threshold=0.72, radius=28, strength=0.55):
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    m = np.clip((lum - threshold) / (1 - threshold), 0, 1)[..., None]
    bright = Image.fromarray((a * m * 255).astype(np.uint8))
    glow = np.asarray(bright.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255
    glow2 = np.asarray(bright.filter(ImageFilter.GaussianBlur(radius * 2.5)), dtype=np.float32) / 255
    out = 1 - (1 - a) * (1 - np.clip((glow + glow2 * 0.6) * strength, 0, 1))
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def grade(img, warm=0.06, contrast=1.08, sat=1.12, lift=0.0):
    a = np.asarray(img.convert('RGB'), dtype=np.float32) / 255
    lum = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    a = lum + (a - lum) * sat
    a = (a - 0.5) * contrast + 0.5 + lift
    hi = np.clip(lum - 0.45, 0, 1) * 2
    a = a + hi * np.array([warm, warm * 0.45, -warm * 0.6], np.float32)
    lo = np.clip(0.45 - lum, 0, 1) * 2
    a = a + lo * np.array([-0.02, 0.0, 0.05], np.float32)
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def vignette(img, strength=0.38, power=2.2):
    w, h = img.size
    y, x = np.ogrid[0:h, 0:w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h * 0.48) / (h / 2)) ** 2) / 1.25
    v = 1 - strength * np.clip(d, 0, 1) ** power
    a = np.asarray(img.convert('RGB'), dtype=np.float32) * v[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def grain(img, amount=4, seed=1):
    a = np.asarray(img.convert('RGB'), dtype=np.float32)
    n = np.random.default_rng(seed).normal(0, amount, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(a + n, 0, 255).astype(np.uint8))


def paste(canvas, sprite, x, y, w, ss, flip=False, opacity=1.0):
    sw, sh = sprite.size
    h = int(w * sh / sw)
    s = sprite.resize((int(w * ss), int(h * ss)), Image.LANCZOS)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    if opacity < 1:
        a = s.split()[3].point(lambda v: int(v * opacity))
        s.putalpha(a)
    canvas.alpha_composite(s, (int(x * ss), int(y * ss)))


def save_webp(img, path, q=80):
    img.save(path, 'WEBP', quality=q, method=6)
    print(f'{os.path.relpath(path, GAME):34s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} KB')


# ---------------------------------------------------------------- القاعة
def hall():
    ss = 2
    VP = (540, 800)
    far = (290, 260, 790, 1180)  # x0, y0, x1, y1
    k = 3.0
    nx0, nx1 = VP[0] + (far[0] - VP[0]) * k, VP[0] + (far[2] - VP[0]) * k
    ny0, ny1 = VP[1] + (far[1] - VP[1]) * k, VP[1] + (far[3] - VP[1]) * k
    size = (W, H)
    canvas = Image.new('RGBA', (W * ss, H * ss), (8, 14, 40, 255))
    ceil = load('hall-ceil.png')
    floor = load('hall-floor.png')
    wall = load('hall-wall.png')
    # السقف والأرضية: أعلى النسيج = البعيد
    canvas.alpha_composite(warp_depth(ceil, [(far[0], far[1]), (far[2], far[1]), (nx1, ny0), (nx0, ny0)], size, ss, 'v', True))
    canvas.alpha_composite(warp_depth(floor, [(far[0], far[3]), (far[2], far[3]), (nx1, ny1), (nx0, ny1)], size, ss, 'v', True))
    # الجداران: u=0 قريب
    canvas.alpha_composite(warp_depth(wall, [(nx0, ny0), (far[0], far[1]), (far[0], far[3]), (nx0, ny1)], size, ss, 'u', False))
    wr = wall.transpose(Image.FLIP_LEFT_RIGHT)
    canvas.alpha_composite(warp_depth(wr, [(far[2], far[1]), (nx1, ny0), (nx1, ny1), (far[2], far[3])], size, ss, 'u', True))
    # الجدار الأمامي
    fw = load('hall-far.png').resize(((far[2] - far[0]) * ss, (far[3] - far[1]) * ss), Image.LANCZOS)
    canvas.alpha_composite(fw, (far[0] * ss, far[1] * ss))
    # ظلال الزوايا (انسداد محيطي)
    ao = Image.new('L', (W * ss, H * ss), 0)
    d = ImageDraw.Draw(ao)
    for (x0, y0), (x1, y1) in [((far[0], far[1]), (nx0, ny0)), ((far[2], far[1]), (nx1, ny0)), ((far[0], far[3]), (nx0, ny1)), ((far[2], far[3]), (nx1, ny1))]:
        d.line([(x0 * ss, y0 * ss), (x1 * ss, y1 * ss)], fill=170, width=46 * ss)
    d.rectangle([far[0] * ss, far[1] * ss, far[2] * ss, far[3] * ss], outline=150, width=26 * ss)
    ao = ao.filter(ImageFilter.GaussianBlur(26 * ss))
    shade = Image.new('RGBA', canvas.size, (4, 8, 26, 255))
    shade.putalpha(ao)
    canvas.alpha_composite(shade)
    # ضوء دافئ من الباب البعيد
    glow = Image.new('L', (W * ss, H * ss), 0)
    ImageDraw.Draw(glow).ellipse([(540 - 420) * ss, (930 - 520) * ss, (540 + 420) * ss, (930 + 520) * ss], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(120 * ss))
    warm = Image.new('RGBA', canvas.size, (255, 214, 140, 255))
    warm.putalpha(glow)
    canvas.alpha_composite(warm)
    # الفوانيس والنباتات والأشعة
    lan = load('hall-lantern.png')
    paste(canvas, lan, 205, 300, 120, ss)
    paste(canvas, lan, 755, 300, 120, ss)
    paste(canvas, lan, -40, 150, 250, ss)
    paste(canvas, lan, 870, 150, 250, ss)
    pl = load('hall-plant.png')
    paste(canvas, pl, -110, 1440, 470, ss)
    paste(canvas, pl, 720, 1440, 470, ss, flip=True)
    rays = load('hall-rays.png').resize((W * ss, H * ss), Image.LANCZOS)
    canvas = Image.alpha_composite(canvas, rays)
    img = canvas.convert('RGB').resize((W, H), Image.LANCZOS)
    img = bloom(img, threshold=0.7, radius=26, strength=0.6)
    img = grade(img, warm=0.07, contrast=1.06, sat=1.15)
    img = img.filter(ImageFilter.GaussianBlur(1.1))
    img = vignette(img, 0.42)
    img = grain(img, 2.5)
    save_webp(img, os.path.join(ART, 'hall.webp'), 80)


# ---------------------------------------------------------------- الصحن
HOME_ORDER = ['sky', 'minarets', 'dome', 'facade', 'tiles', 'iwan', 'lanterns', 'floorbase', 'floor', 'fountain', 'garden', 'front']
HOME_ITEMS = {'dome', 'minarets', 'tiles', 'iwan', 'lanterns', 'floor', 'fountain', 'garden'}
GROUND, HORIZON = 1080, 880


def bloom_rgba(img, threshold=0.78, radius=12, strength=0.7):
    """توهّج لطبقة شفافة: يضيف هالة ضوء حول الأجزاء الساطعة"""
    a = np.asarray(img, dtype=np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:4]
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    m = np.clip((lum - threshold) / (1 - threshold), 0, 1)[..., None] * al
    bright = Image.fromarray((np.concatenate([rgb * m, m], -1) * 255).astype(np.uint8), 'RGBA')
    g = np.asarray(bright.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255
    grgb = g[..., :3] * strength
    ga = np.clip(g[..., 3:4] * strength * 1.4, 0, 1)
    out_a = al + ga * (1 - al)
    out_rgb = (rgb * al + grgb * (1 - al) + grgb * al * 0.5) / np.maximum(out_a, 1e-4)
    return Image.fromarray((np.clip(np.concatenate([out_rgb, out_a], -1), 0, 1) * 255).astype(np.uint8), 'RGBA')


def grade_rgba(img, **kw):
    rgb = grade(img.convert('RGB'), **kw)
    out = rgb.convert('RGBA')
    out.putalpha(img.split()[3])
    return out


def floor_quad():
    k = (1920 - HORIZON) / (GROUND - HORIZON)
    hw = 540 * k
    return [(0, GROUND), (W, GROUND), (540 + hw, 1920), (540 - hw, 1920)]


def home():
    ss = 2
    quad = floor_quad()
    manifest = []
    full = {}
    for name in HOME_ORDER:
        if name in ('floorbase', 'floor'):
            tex = load(f'home-{name}.png')
            layer = warp_depth(tex, quad, (W, H), ss, 'v', True).resize((W, H), Image.LANCZOS)
            if name == 'floorbase':
                fac = load('home-facade.png').crop((0, 600, W, GROUND))
                ref = fac.transpose(Image.FLIP_TOP_BOTTOM).resize((W, int((GROUND - 600) * 0.45)), Image.LANCZOS)
                ref = ref.filter(ImageFilter.GaussianBlur(5))
                ref.putalpha(ref.split()[3].point(lambda v: int(v * 0.2)))
                layer.alpha_composite(ref, (0, GROUND))
                sh = Image.new('L', (W, H), 0)
                d = ImageDraw.Draw(sh)
                for i in range(50):
                    d.line([(0, GROUND + i), (W, GROUND + i)], fill=int(120 * (1 - i / 50) ** 2))
                shade = Image.new('RGBA', (W, H), (40, 26, 10, 255))
                shade.putalpha(sh)
                layer.alpha_composite(shade)
                haze = Image.new('L', (W, H), 0)
                d = ImageDraw.Draw(haze)
                for i in range(260):
                    d.line([(0, GROUND + i), (W, GROUND + i)], fill=int(70 * (1 - i / 260)))
                hz = Image.new('RGBA', (W, H), (255, 236, 205, 255))
                hz.putalpha(haze)
                layer.alpha_composite(hz)
                m = Image.new('L', (W, H), 0)
                ImageDraw.Draw(m).rectangle([0, GROUND, W, H], fill=255)
                layer.putalpha(ImageChops.multiply(layer.split()[3], m))
        else:
            layer = load(f'home-{name}.png')
        if name in ('dome', 'minarets', 'iwan', 'lanterns', 'fountain'):
            layer = bloom_rgba(layer, threshold=0.8 if name != 'lanterns' else 0.7, radius=10 if name != 'lanterns' else 16, strength=0.6 if name != 'lanterns' else 1.0)
        if name == 'front':
            layer = layer.filter(ImageFilter.GaussianBlur(2.2))
            layer = grade_rgba(layer, warm=0.02, contrast=1.0, sat=1.05, lift=-0.05)
        elif name != 'sky':
            layer = grade_rgba(layer, warm=0.05, contrast=1.05, sat=1.12)
        else:
            layer = grade(layer, warm=0.04, contrast=1.02, sat=1.08).convert('RGBA')
        full[name] = layer
        if name == 'sky':
            save_webp(layer.convert('RGB'), os.path.join(ART, 'home-sky.webp'), 78)
            manifest.append({'id': name, 'x': 0, 'y': 0, 'w': W, 'h': H, 'item': False})
            continue
        bbox = layer.split()[3].point(lambda v: 255 if v > 3 else 0).getbbox()
        if not bbox:
            continue
        x0, y0, x1, y1 = bbox
        crop = layer.crop(bbox)
        save_webp(crop, os.path.join(ART, f'home-{name}.webp'), 84)
        manifest.append({'id': name, 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'item': name in HOME_ITEMS})
    with open(os.path.join(ART, 'home-layers.js'), 'w') as fp:
        fp.write('/* مولَّد بواسطة tools/post-art.py — مواضع طبقات مشهد الصحن (بكسل من 1080×1920) */\n')
        fp.write('(window.Noor = window.Noor || {}).HOME_LAYERS = ' + json.dumps({'w': W, 'h': H, 'layers': manifest}) + ';\n')
    print('home-layers.js', len(manifest), 'layers')
    # تركيب كامل (كل العناصر مرمّمة) لشاشة البداية وخلفية الخريطة
    comp = Image.new('RGBA', (W, H))
    for name in HOME_ORDER:
        if name in full:
            comp.alpha_composite(full[name])
    img = bloom(comp.convert('RGB'), threshold=0.78, radius=24, strength=0.45)
    img = vignette(img, 0.35)
    save_webp(img, os.path.join(ART, 'title.webp'), 80)
    small = img.resize((360, 640), Image.LANCZOS).filter(ImageFilter.GaussianBlur(5))
    save_webp(small, os.path.join(ART, 'blur.webp'), 70)


# ---------------------------------------------------------------- القطع والأيقونات
def tiles():
    for fn in sorted(os.listdir(SRC)):
        if not fn.startswith('sp-'):
            continue
        name = fn[3:-4]
        im = Image.open(os.path.join(SRC, fn)).convert('RGBA').resize((192, 192), Image.LANCZOS)
        save_webp(im, os.path.join(SPR, name + '.webp'), 90)


def ui():
    sizes = {'logo': (720, 336), 'cart': (420, 112)}
    for fn in sorted(os.listdir(SRC)):
        if not fn.startswith('ui-'):
            continue
        name = fn[3:-4]
        im = Image.open(os.path.join(SRC, fn)).convert('RGBA')
        im = im.resize(sizes.get(name, (160, 160)), Image.LANCZOS)
        save_webp(im, os.path.join(UI, name + '.webp'), 90)


if __name__ == '__main__':
    want = sys.argv[1:]
    on = lambda k: not want or k in want
    if on('hall'):
        hall()
    if on('home'):
        home()
    if on('tiles'):
        tiles()
    if on('ui'):
        ui()
