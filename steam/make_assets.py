# -*- coding: utf-8 -*-
"""
沙场对决 · Steam 商店素材生成器
程序化绘制，无需外部美术资源。所有尺寸遵循 Steamworks 现行规范（2026）。

输出到 ./assets/
  required/   上架必填
  optional/   可选（成就图标等）
"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_REQ = os.path.join(HERE, 'assets', 'required')
OUT_OPT = os.path.join(HERE, 'assets', 'optional')
os.makedirs(OUT_REQ, exist_ok=True)
os.makedirs(OUT_OPT, exist_ok=True)

F_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
F_REG = 'C:/Windows/Fonts/msyh.ttc'
F_EN = 'C:/Windows/Fonts/segoeuib.ttf'

# 品牌色
C_SPACE = (10, 16, 32)
C_BLUE = (60, 150, 255)
C_GREEN = (78, 224, 168)   # 玩家
C_RED = (255, 84, 112)     # 敌方
C_GOLD = (255, 209, 102)   # 城池
C_TEXT = (232, 244, 255)


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def radial_glow(w, h, center=(0.5, 0.5), radius=1.0, color=(40, 110, 200), power=2.0):
    """低分辨率径向渐变 → 放大，快速且平滑"""
    sw, sh = 160, max(2, int(160 * h / w))
    g = Image.new('L', (sw, sh), 0)
    px = g.load()
    cx, cy = center[0] * sw, center[1] * sh
    maxd = math.hypot(sw, sh) * radius * 0.5
    for y in range(sh):
        for x in range(sw):
            d = math.hypot(x - cx, y - cy) / maxd
            v = 0 if d >= 1 else (1 - d) ** power
            px[x, y] = int(255 * v)
    g = g.resize((w, h), Image.BICUBIC)
    col = Image.new('RGB', (w, h), color)
    return col, g  # (色层, 蒙版)


def space_bg(w, h, seed=3, center=(0.66, 0.5), radius=1.15, color=(38, 104, 190),
             stars=True, nebula=True, vignette=0.55):
    img = Image.new('RGB', (w, h), C_SPACE)
    col, mask = radial_glow(w, h, center, radius, color, power=2.4)
    img = Image.composite(col, img, mask.point(lambda v: int(v * 0.72)))

    rnd = random.Random(seed)

    # 星云：几团模糊彩色
    if nebula:
        neb = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        nd = ImageDraw.Draw(neb)
        for _ in range(5):
            nw = rnd.randint(int(w * 0.12), int(w * 0.34))
            nh = rnd.randint(int(h * 0.10), int(h * 0.28))
            nx = rnd.randint(-int(w * 0.1), w - int(nw * 0.5))
            ny = rnd.randint(-int(h * 0.1), h - int(nh * 0.5))
            cc = rnd.choice([(60, 150, 255), (120, 90, 255), (40, 200, 200), (255, 110, 150)])
            nd.ellipse([nx, ny, nx + nw, ny + nh], fill=cc + (rnd.randint(14, 30),))
        img.paste(Image.alpha_composite(img.convert('RGBA'),
                                        neb.filter(ImageFilter.GaussianBlur(w / 40))).convert('RGB'), (0, 0))

    # 星点
    if stars:
        d = ImageDraw.Draw(img)
        n = int(w * h / 5200)
        for _ in range(n):
            x, y = rnd.randint(0, w - 1), rnd.randint(0, h - 1)
            r = rnd.choice([1, 1, 1, 1, 2])
            a = rnd.randint(55, 190)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(178, 208, 255, a))
        # 少量亮星带十字光
        for _ in range(max(3, int(n / 40))):
            x, y = rnd.randint(0, w - 1), rnd.randint(0, h - 1)
            L = rnd.randint(4, 9)
            d.line([x - L, y, x + L, y], fill=(200, 226, 255, 120), width=1)
            d.line([x, y - L, x, y + L], fill=(200, 226, 255, 120), width=1)
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 255, 210))

    # 暗角
    if vignette > 0:
        va, vm = radial_glow(w, h, (0.5, 0.5), 0.95, (0, 0, 0), power=1.6)
        vm = vm.point(lambda v: int((255 - v) * vignette))
        img = Image.composite(Image.new('RGB', (w, h), (0, 0, 0)), img, vm)
    return img.convert('RGBA')


def draw_planet(layer, cx, cy, R, tilt=-18, ring=True, satellites=True, hue='blue', detail=True):
    """在 layer 上绘制星球 + 轨道环 + 卫星"""
    w, h = layer.size

    # 光晕
    halo = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    for i in range(16, 0, -1):
        rr = R + i * R * 0.11
        hd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=C_BLUE + (int(26 * (1 - i / 17)),))
    layer.alpha_composite(halo.filter(ImageFilter.GaussianBlur(R * 0.09)))

    # 球体径向渐变
    pal = {
        'blue': lambda t: (int(24 + 66 * (1 - t)), int(92 + 118 * (1 - t)), int(168 + 80 * (1 - t))),
        'deep': lambda t: (int(18 + 40 * (1 - t)), int(60 + 90 * (1 - t)), int(120 + 110 * (1 - t))),
    }[hue]
    body = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    steps = int(max(48, min(R, 320)))
    for i in range(steps, 0, -1):
        r = int(R * i / steps)
        t = i / steps
        bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=pal(t) + (255,))
    layer.alpha_composite(body)

    # 表面纹理（经纬/地貌斑块，微弱）
    if detail:
        tex = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        td = ImageDraw.Draw(tex)
        rnd = random.Random(int(cx + cy))
        for _ in range(14):
            rr = R * rnd.uniform(0.12, 0.36)
            ox = cx + rnd.uniform(-R * 0.55, R * 0.55)
            oy = cy + rnd.uniform(-R * 0.55, R * 0.55)
            if math.hypot(ox - cx, oy - cy) + rr > R * 0.94:
                continue
            td.ellipse([ox - rr, oy - rr * 0.62, ox + rr, oy + rr * 0.62],
                       fill=(120, 200, 255, rnd.randint(12, 26)))
        tex = tex.filter(ImageFilter.GaussianBlur(R * 0.05))
        # 裁到球内
        clip = Image.new('L', (w, h), 0)
        ImageDraw.Draw(clip).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
        tex.putalpha(Image.composite(tex.getchannel('A'), Image.new('L', (w, h), 0), clip))
        layer.alpha_composite(tex)

    # 左上高光
    hi = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    hd2 = ImageDraw.Draw(hi)
    hd2.ellipse([cx - R * 0.74, cy - R * 0.86, cx + R * 0.12, cy - R * 0.04], fill=(186, 232, 255, 86))
    hi = hi.filter(ImageFilter.GaussianBlur(R * 0.14))
    clip = Image.new('L', (w, h), 0)
    ImageDraw.Draw(clip).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    hi.putalpha(Image.composite(hi.getchannel('A'), Image.new('L', (w, h), 0), clip))
    layer.alpha_composite(hi)

    # 右下边缘暗侧
    dark = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dark)
    dd.ellipse([cx - R * 0.2, cy - R * 0.05, cx + R * 1.25, cy + R * 1.25], fill=(2, 6, 18, 120))
    dark = dark.filter(ImageFilter.GaussianBlur(R * 0.22))
    dark.putalpha(Image.composite(dark.getchannel('A'), Image.new('L', (w, h), 0), clip))
    layer.alpha_composite(dark)

    # 轨道环
    if ring:
        rw = max(2, int(R * 0.055))
        ring_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        rd = ImageDraw.Draw(ring_img)
        rx, ry = R * 1.62, R * 0.50
        rd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(128, 208, 255, 205), width=rw)
        rd.ellipse([cx - rx * 1.06, cy - ry * 1.12, cx + rx * 1.06, cy + ry * 1.12],
                   outline=(90, 170, 240, 90), width=max(1, rw // 2))
        ring_img = ring_img.rotate(tilt, resample=Image.BICUBIC, center=(cx, cy))
        # 环在球前方的部分更亮：用球上半部区域裁切叠加
        layer.alpha_composite(ring_img)

    # 卫星（自动收缩轨道半径，保证完整落在画布内）
    if satellites:
        for ang, mult, col in [(-152, 1.60, C_GREEN), (22, 1.70, C_RED), (108, 1.52, C_GOLD)]:
            a = math.radians(ang + tilt)
            m = mult
            rr = max(3, R * 0.115)
            while m > 1.02:
                sx = cx + math.cos(a) * R * m
                sy = cy + math.sin(a) * R * m * 0.42
                marg = rr * 2.8
                if 0 <= sx - marg and sx + marg <= w and 0 <= sy - marg and sy + marg <= h:
                    break
                m -= 0.04
            sx = cx + math.cos(a) * R * m
            sy = cy + math.sin(a) * R * m * 0.42
            sg = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            sgd = ImageDraw.Draw(sg)
            for i in range(6, 0, -1):
                g_r = rr * (1 + i * 0.55)
                sgd.ellipse([sx - g_r, sy - g_r, sx + g_r, sy + g_r], fill=col + (int(46 * (1 - i / 7)),))
            sg = sg.filter(ImageFilter.GaussianBlur(rr * 0.5))
            layer.alpha_composite(sg)
            d2 = ImageDraw.Draw(layer)
            d2.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=col + (255,))
            d2.ellipse([sx - rr * 0.45, sy - rr * 0.5, sx + rr * 0.25, sy - rr * 0.05],
                       fill=(255, 255, 255, 120))


def draw_fleets(layer, cx, cy, R, n=4, seed=11):
    """几颗飞行中的小光点，暗示'出兵'"""
    rnd = random.Random(seed)
    d = ImageDraw.Draw(layer)
    w, h = layer.size
    for _ in range(n):
        for _try in range(16):
            a = rnd.uniform(-1.75, 1.75)  # ±100°：只绕星球右半圈，避开左侧文字区
            dist = R * rnd.uniform(1.25, 1.85)
            x = cx + math.cos(a) * dist
            y = cy + math.sin(a) * dist * 0.55
            rr = max(2, R * 0.045)
            if rr * 6 < x < w - rr * 6 and rr * 6 < y < h * 0.82:
                break
        else:
            continue
        col = rnd.choice([C_GREEN, C_RED])
        # 拖尾
        for k in range(6):
            t = k / 6
            dx = x - math.cos(a) * rr * 3.2 * t
            dy = y - math.sin(a) * rr * 3.2 * t
            d.ellipse([dx - rr * (1 - t * 0.6), dy - rr * (1 - t * 0.6),
                       dx + rr * (1 - t * 0.6), dy + rr * (1 - t * 0.6)],
                      fill=col + (int(150 * (1 - t)),))
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(255, 255, 255, 240))
        d.ellipse([x - rr * 2.1, y - rr * 2.1, x + rr * 2.1, y + rr * 2.1], outline=col + (110,), width=max(1, int(rr * 0.5)))


def text_glow(layer, xy, text, fnt, fill=C_TEXT, glow=None, blur=14, anchor='la', stroke=0,
              stroke_fill=None):
    x, y = xy
    if glow:
        gl = Image.new('RGBA', layer.size, (0, 0, 0, 0))
        ImageDraw.Draw(gl).text((x, y), text, font=fnt, fill=glow + (255,), anchor=anchor,
                                stroke_width=max(stroke, 2), stroke_fill=glow + (255,))
        layer.alpha_composite(gl.filter(ImageFilter.GaussianBlur(blur)))
    d = ImageDraw.Draw(layer)
    d.text((x, y), text, font=fnt, fill=fill, anchor=anchor,
           stroke_width=stroke, stroke_fill=stroke_fill)


def fit_font(path, text, max_w, size, min_size=10):
    """二分找最大可用字号"""
    lo, hi = min_size, size
    best = min_size
    while lo <= hi:
        mid = (lo + hi) // 2
        f = font(path, mid)
        w = ImageDraw.Draw(Image.new('RGB', (10, 10))).textbbox((0, 0), text, font=f)[2]
        if w <= max_w:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return font(path, best)


# ---------------- 各类模板 ----------------

def capsule_h(w, h, title='沙场对决', sub='SHACHANG SHOWDOWN', tag='可编程的星球领地攻防',
              planet_at=(0.70, 0.50), planet_r=0.40, show_tag=True, seed=3):
    """横版宣传图（header / main / small 共用）"""
    img = space_bg(w, h, seed=seed, center=(planet_at[0] - 0.05, planet_at[1]))
    cx, cy = planet_at[0] * w, planet_at[1] * h
    R = planet_r * h
    draw_fleets(img, cx, cy, R, n=3, seed=seed + 5)
    draw_planet(img, cx, cy, R, tilt=-16)

    # 左侧文字区
    pad = int(w * 0.055)
    title_size = int(h * 0.30)
    f_title = fit_font(F_BOLD, title, int(w * 0.52), title_size)
    f_sub = font(F_EN, max(11, int(h * 0.075)))
    f_tag = font(F_REG, max(10, int(h * 0.062)))

    total_h = 0
    bb_t = ImageDraw.Draw(img).textbbox((0, 0), title, font=f_title)
    th = bb_t[3] - bb_t[1]
    total_h += th
    if sub:
        total_h += int(h * 0.055)
    if show_tag:
        total_h += int(h * 0.115)
    ty = (h - total_h) // 2 - bb_t[1]

    text_glow(img, (pad, ty), title, f_title, fill=C_TEXT, glow=(40, 130, 255), blur=int(h * 0.045))
    cy2 = ty + bb_t[1] + th + int(h * 0.045)
    if sub:
        text_glow(img, (pad + 2, cy2), sub, f_sub, fill=(120, 196, 255, 255), glow=(30, 90, 200),
                  blur=max(4, int(h * 0.02)))
        cy2 += int(h * 0.058)
    if show_tag:
        text_glow(img, (pad + 2, cy2 + int(h * 0.02)), tag, f_tag, fill=(178, 205, 235, 255))

    # 底部一道细细的地平线光
    d = ImageDraw.Draw(img)
    d.rectangle([0, h - max(2, int(h * 0.008)), w, h], fill=(46, 120, 210, 255))
    return img


def capsule_v(w, h, title='沙场对决', sub='SHACHANG SHOWDOWN', tag='可编程的\n星球领地攻防'):
    img = space_bg(w, h, seed=13, center=(0.5, 0.34), radius=1.0)
    cx, cy = w * 0.5, h * 0.335
    R = w * 0.30
    draw_fleets(img, cx, cy, R, n=3, seed=21)
    draw_planet(img, cx, cy, R, tilt=-18)

    pad = int(w * 0.08)
    f_title = fit_font(F_BOLD, title, w - pad * 2, int(w * 0.26))
    bb = ImageDraw.Draw(img).textbbox((0, 0), title, font=f_title)
    ty = int(h * 0.60)
    text_glow(img, (w // 2, ty), title, f_title, fill=C_TEXT, glow=(40, 130, 255),
              blur=int(w * 0.035), anchor='ma')
    f_sub = font(F_EN, max(10, int(w * 0.052)))
    text_glow(img, (w // 2, ty + (bb[3] - bb[1]) + int(h * 0.035)), sub, f_sub,
              fill=(120, 196, 255, 255), glow=(30, 90, 200), blur=6, anchor='ma')
    if tag:
        f_tag = font(F_REG, max(10, int(w * 0.048)))
        text_glow(img, (w // 2, ty + (bb[3] - bb[1]) + int(h * 0.105)), tag, f_tag,
                  fill=(178, 205, 235, 255), anchor='ma', blur=0)
    d = ImageDraw.Draw(img)
    d.rectangle([0, h - max(2, int(h * 0.006)), w, h], fill=(46, 120, 210, 255))
    return img


def hero(w, h):
    """图书馆主图：纯美术，不放文字（Steam 会叠加 logo）"""
    img = space_bg(w, h, seed=31, center=(0.74, 0.46), radius=1.0, color=(34, 96, 180))
    cx, cy = w * 0.755, h * 0.47
    R = h * 0.30
    draw_fleets(img, cx, cy, R, n=5, seed=44)
    draw_planet(img, cx, cy, R, tilt=-16)
    # 左侧轻微压暗，给叠加的 logo 留呼吸空间
    col, mask = radial_glow(w, h, (0.16, 0.5), 1.5, (0, 0, 0), power=1.8)
    mask = mask.point(lambda v: int(v * 0.55))
    img = Image.composite(Image.new('RGB', (w, h), (4, 8, 20)).convert('RGBA'), img, mask)
    return img


def page_bg(w, h):
    """商店页背景：纯美术"""
    img = space_bg(w, h, seed=57, center=(0.5, 0.30), radius=1.25, color=(28, 84, 160))
    draw_planet(img, w * 0.5, h * 0.34, h * 0.20, tilt=-14, satellites=False, detail=False)
    # 顶部到下方的压暗过渡
    ov = Image.new('L', (w, h), 0)
    od = ImageDraw.Draw(ov)
    for y in range(h):
        od.line([0, y, w, y], fill=int(215 * (y / h) ** 1.30))
    img = Image.composite(Image.new('RGB', (w, h), (7, 11, 24)).convert('RGBA'), img, ov)
    return img


def library_logo(w, h):
    """图书馆 logo：透明底，只有字标"""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    f_title = fit_font(F_BOLD, '沙场对决', int(w * 0.80), int(h * 0.42))
    bb = ImageDraw.Draw(img).textbbox((0, 0), '沙场对决', font=f_title)
    th = bb[3] - bb[1]
    ty = (h - th) // 2 - bb[1] - int(h * 0.04)
    text_glow(img, (w // 2, ty), '沙场对决', f_title, fill=(255, 255, 255, 255),
              glow=(60, 150, 255), blur=int(h * 0.05), anchor='ma')
    f_sub = font(F_EN, max(12, int(h * 0.075)))
    text_glow(img, (w // 2, ty + th + int(h * 0.06)), 'SHACHANG  SHOWDOWN', f_sub,
              fill=(140, 205, 255, 255), glow=(40, 110, 220), blur=int(h * 0.02), anchor='ma')
    return img


def client_icon(size=256):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.20), fill=C_SPACE + (255,))
    draw_planet(img, size * 0.5, size * 0.52, size * 0.30, tilt=-18, detail=False)
    return img


def achievement_icon(size=64, hue='green', glyph='sword'):
    """成就图标（先做好，后补成就时直接用）"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cols = {'green': C_GREEN, 'red': C_RED, 'gold': C_GOLD, 'blue': C_BLUE}
    c = cols.get(hue, C_GREEN)
    d.rounded_rectangle([1, 1, size - 2, size - 2], radius=int(size * 0.18),
                        fill=(12, 20, 38, 255), outline=c + (255,), width=max(1, size // 22))
    cx, cy = size / 2, size / 2
    if glyph == 'sword':
        d.polygon([(cx, cy - size * 0.26), (cx + size * 0.07, cy - size * 0.14),
                   (cx + size * 0.07, cy + size * 0.14), (cx - size * 0.07, cy + size * 0.14),
                   (cx - size * 0.07, cy - size * 0.14)], fill=c + (255,))
        d.rectangle([cx - size * 0.16, cy + size * 0.14, cx + size * 0.16, cy + size * 0.20], fill=c + (200,))
    elif glyph == 'crown':
        d.polygon([(cx - size * 0.22, cy + size * 0.16), (cx - size * 0.22, cy - size * 0.12),
                   (cx - size * 0.09, cy + size * 0.02), (cx, cy - size * 0.20),
                   (cx + size * 0.09, cy + size * 0.02), (cx + size * 0.22, cy - size * 0.12),
                   (cx + size * 0.22, cy + size * 0.16)], fill=c + (255,))
    elif glyph == 'code':
        f = font(F_EN, int(size * 0.42))
        d.text((cx, cy), '</>', font=f, fill=c + (255,), anchor='mm')
    elif glyph == 'planet':
        d.ellipse([cx - size * 0.20, cy - size * 0.20, cx + size * 0.20, cy + size * 0.20], fill=c + (255,))
        d.ellipse([cx - size * 0.34, cy - size * 0.10, cx + size * 0.34, cy + size * 0.10],
                  outline=c + (180,), width=max(1, size // 26))
    return img


def save(img, name, mode='RGB', quality=None):
    p = os.path.join(OUT_REQ, name)
    if img.mode != mode:
        base = Image.new('RGB', img.size, C_SPACE) if mode == 'RGB' else img
        if mode == 'RGB':
            base.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = base
    img.save(p, quality=quality) if quality else img.save(p)
    print(f'  {name:34s} {img.size[0]}x{img.size[1]}  {os.path.getsize(p)/1024:.1f} KB')


if __name__ == '__main__':
    print('生成 Steam 商店素材 ...')
    # 必填：五张宣传图
    save(capsule_h(920, 430, planet_at=(0.71, 0.50), planet_r=0.42), 'header_capsule_920x430.jpg', quality=94)
    save(capsule_h(1232, 706, planet_at=(0.72, 0.50), planet_r=0.41, seed=5), 'main_capsule_1232x706.jpg', quality=94)
    save(capsule_h(462, 174, show_tag=False, planet_at=(0.76, 0.50), planet_r=0.46, seed=7),
         'small_capsule_462x174.jpg', quality=94)
    save(capsule_v(748, 896), 'vertical_capsule_748x896.jpg', quality=94)
    save(capsule_v(600, 900, tag='可编程的\n算法实验场'), 'library_capsule_600x900.jpg', quality=94)
    # 必填：纯美术
    save(hero(3840, 1240), 'library_hero_3840x1240.jpg', quality=92)
    save(page_bg(1438, 810), 'page_background_1438x810.jpg', quality=92)
    # 必填：透明 logo
    save(library_logo(1280, 720), 'library_logo_1280x720.png', mode='RGBA')
    # 客户端图标（Steam 需要 256x256 png 和 ico）
    ic = client_icon(256)
    ic.save(os.path.join(OUT_REQ, 'client_icon_256x256.png'))
    print(f'  {"client_icon_256x256.png":34s} 256x256  {os.path.getsize(os.path.join(OUT_REQ, "client_icon_256x256.png"))/1024:.1f} KB')
    ic.save(os.path.join(OUT_REQ, 'client_icon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f'  {"client_icon.ico":34s} multi')

    # 可选：成就图标（彩色 + 灰版，Steam 要求成就有 locked/unlocked 两版）
    print('生成成就图标 ...')
    ach = [('first_win', 'green', 'sword'), ('conqueror', 'gold', 'crown'),
           ('coder', 'blue', 'code'), ('dominator', 'red', 'planet')]
    for key, hue, glyph in ach:
        color = achievement_icon(64, hue, glyph)
        color.save(os.path.join(OUT_OPT, f'ach_{key}.png'))
        gray = color.convert('LA').convert('RGBA')
        px = gray.load()
        for y in range(gray.size[1]):
            for x in range(gray.size[0]):
                r, g, b, a = px[x, y]
                if a > 0:
                    v = int(0.36 * r + 0.42 * g + 0.22 * b)
                    px[x, y] = (v, v, v, a)
        gray.save(os.path.join(OUT_OPT, f'ach_{key}_locked.png'))
        print(f'  ach_{key}.png / _locked.png')
    print('完成 →', os.path.join(HERE, 'assets'))
