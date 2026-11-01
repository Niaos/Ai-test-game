import math, os
from PIL import Image, ImageDraw, ImageFilter

S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 深空背景圆角方
bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(bg)
bd.rounded_rectangle([0, 0, S - 1, S - 1], radius=96, fill=(10, 16, 32, 255))
img.alpha_composite(bg)

# 星点
import random
random.seed(7)
for _ in range(90):
    x, y = random.randint(20, S - 20), random.randint(20, S - 20)
    r = random.choice([1, 1, 1, 2])
    a = random.randint(60, 170)
    d.ellipse([x - r, y - r, x + r, y + r], fill=(180, 210, 255, a))

CX, CY, R = S // 2, S // 2 + 6, 128

# 光晕
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for i in range(14, 0, -1):
    rr = R + i * 9
    a = int(30 * (1 - i / 15))
    gd.ellipse([CX - rr, CY - rr, CX + rr, CY + rr], fill=(60, 150, 255, a))
img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))

# 星球本体（径向渐变球）
planet = Image.new('RGBA', (S, S), (0, 0, 0, 0))
pd = ImageDraw.Draw(planet)
for r in range(R, 0, -1):
    t = r / R
    # 从边缘深蓝到左上亮青
    col = (
        int(30 + 70 * (1 - t)),
        int(110 + 110 * (1 - t)),
        int(190 + 60 * (1 - t)),
        255,
    )
    pd.ellipse([CX - r, CY - r, CX + r, CY + r], fill=col)
img.alpha_composite(planet)

# 左上高光
hi = Image.new('RGBA', (S, S), (0, 0, 0, 0))
hd = ImageDraw.Draw(hi)
hd.ellipse([CX - R * 0.75, CY - R * 0.85, CX + R * 0.1, CY - R * 0.05], fill=(190, 235, 255, 90))
img.alpha_composite(hi.filter(ImageFilter.GaussianBlur(18)))

# 轨道环
ring = Image.new('RGBA', (S, S), (0, 0, 0, 0))
rd = ImageDraw.Draw(ring)
rd.ellipse([CX - R * 1.55, CY - R * 0.55, CX + R * 1.55, CY + R * 0.55],
           outline=(120, 210, 255, 210), width=9)
ring = ring.rotate(-18, resample=Image.BICUBIC, center=(CX, CY))
img.alpha_composite(ring)

# 三颗卫星（对应游戏三方夺地）
for ang, rad, col in [(-150, 1.62, (78, 224, 168)), (25, 1.72, (255, 138, 156)), (110, 1.55, (255, 209, 102))]:
    a = math.radians(ang - 18)
    x = CX + int(math.cos(a) * R * rad)
    y = CY + int(math.sin(a) * R * rad * 0.42)
    rr = 17
    d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=col + (255,))

img = img.resize((256, 256), Image.LANCZOS)
os.makedirs('build', exist_ok=True)
img.save('build/icon.png')
img.save('build/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('icon written', os.path.getsize('build/icon.ico'), 'bytes')
