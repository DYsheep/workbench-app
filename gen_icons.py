# 生成 PWA 图标：indigo 圆角方块 + 白色 W（矢量线条绘制）
from PIL import Image, ImageDraw
import os

OUT = r'C:\project\工作台\workbench-app\public'
BG = (79, 70, 229)      # indigo-600 #4f46e5
FG = (255, 255, 255)
RADIUS_RATIO = 0.22     # 圆角半径比例

def draw_w(d: ImageDraw, size: int, color=FG):
    """用 5 点折线画粗 W，线条圆头"""
    w = size
    pts = [(0.20, 0.80), (0.35, 0.26), (0.50, 0.56), (0.65, 0.26), (0.80, 0.80)]
    xy = [(x * w, y * w) for x, y in pts]
    lw = max(6, int(w * 0.085))
    d.line(xy, fill=color, width=lw, joint='curve')
    # 圆头：在线段端点画圆
    for p in xy:
        d.ellipse([p[0]-lw/2, p[1]-lw/2, p[0]+lw/2, p[1]+lw/2], fill=color)

def rounded_bg(size: int, radius: int):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
    return img, d

def make_icon(size: int, rounded: bool = True):
    radius = int(size * RADIUS_RATIO) if rounded else 0
    img, d = rounded_bg(size, radius) if rounded else (Image.new('RGBA', (size, size), BG), ImageDraw.Draw(Image.new('RGBA', (size, size), BG)))
    draw_w(d, size)
    return img

# 标准图标（圆角）
for s in (192, 512):
    make_icon(s, True).save(os.path.join(OUT, f'pwa-{s}x{s}.png'))
# maskable（铺满无圆角，留安全区——W 缩到 60%）
img = Image.new('RGBA', (512, 512), BG)
d = ImageDraw.Draw(img)
draw_w(d, 512)  # W 全尺寸但底色铺满，安全区由系统裁切
img.save(os.path.join(OUT, 'pwa-maskable-512.png'))
# iOS apple-touch-icon（180）
make_icon(180, True).save(os.path.join(OUT, 'apple-touch-icon.png'))

print('icons generated:')
for f in sorted(os.listdir(OUT)):
    if f.startswith('pwa-') or f == 'apple-touch-icon.png':
        print(' ', f, os.path.getsize(os.path.join(OUT, f)), 'bytes')
