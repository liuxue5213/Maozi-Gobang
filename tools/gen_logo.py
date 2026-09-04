#!/usr/bin/env python3
"""
帽子五子棋 - App Logo 生成
纯五子棋元素：木质棋盘 + 黑白棋子（光泽质感）
2x 超采样抗锯齿，输出 1024x1024 PNG
"""
from PIL import Image, ImageDraw, ImageFilter
import math

S = 2048  # 超采样画布
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# ============ 圆角方形背景（木质渐变棋盘） ============
RADIUS = int(S * 0.22)

# 手动绘制垂直渐变的圆角矩形
def rounded_gradient(size, radius, top_rgb, bottom_rgb):
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / size
        r = int(top_rgb[0] + (bottom_rgb[0] - top_rgb[0]) * t)
        g = int(top_rgb[1] + (bottom_rgb[1] - top_rgb[1]) * t)
        b = int(top_rgb[2] + (bottom_rgb[2] - top_rgb[2]) * t)
        gd.line([(0, y), (size, y)], fill=(r, g, b, 255))
    # 圆角蒙版
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    base.paste(grad, (0, 0), mask)
    return base

img = rounded_gradient(S, RADIUS, (238, 200, 96), (210, 162, 48))
d = ImageDraw.Draw(img)

# 木纹纹理（横向波浪细纹）
rng = 42  # 固定种子效果
wood = Image.new("RGBA", (S, S), (0, 0, 0, 0))
wd = ImageDraw.Draw(wood)
for i in range(60):
    y = (i * 173) % S
    alpha = 14 + (i * 7) % 10
    wd.line([(0, y), (S, y)], fill=(139, 90, 43, alpha), width=3)
# 椭圆木纹圈
for cx, cy, rx in [(int(S*0.3), int(S*0.2), int(S*0.35)), (int(S*0.75), int(S*0.8), int(S*0.3))]:
    wd.ellipse([cx-rx, cy-int(rx*0.25), cx+rx, cy+int(rx*0.25)],
               outline=(139, 90, 43, 18), width=5)
wood = wood.filter(ImageFilter.GaussianBlur(2))
img = Image.alpha_composite(img, wood)
d = ImageDraw.Draw(img)

# ============ 棋盘网格线 ============
N = 15                      # 15 路棋盘
MARGIN = int(S * 0.115)     # 边距
GRID = S - 2 * MARGIN
CELL = GRID / (N - 1)
LINE = int(S * 0.006)       # 线宽
LINE_COLOR = (93, 78, 55, 200)

for i in range(N):
    p = MARGIN + i * CELL
    d.line([(MARGIN, p), (MARGIN + GRID, p)], fill=LINE_COLOR, width=LINE)
    d.line([(p, MARGIN), (p, MARGIN + GRID)], fill=LINE_COLOR, width=LINE)

# 边框线加粗
d.rounded_rectangle(
    [MARGIN, MARGIN, MARGIN + GRID, MARGIN + GRID],
    radius=int(S * 0.01), outline=(93, 78, 55, 230), width=LINE * 2
)

# 星位（9 个星位点）
STAR_R = int(S * 0.011)
for sr, sc in [(3,3),(3,11),(11,3),(11,11),(7,7),(3,7),(7,3),(7,11),(11,7)]:
    x = MARGIN + sc * CELL
    y = MARGIN + sr * CELL
    d.ellipse([x-STAR_R, y-STAR_R, x+STAR_R, y+STAR_R], fill=(93, 78, 55, 220))

# ============ 棋子 ============
def draw_stone(base, cx, cy, radius, black=True):
    """带光泽的棋子：径向渐变 + 高光 + 投影"""
    stone = Image.new("RGBA", (int(radius*4), int(radius*4)), (0,0,0,0))
    sd = ImageDraw.Draw(stone)
    c = radius * 2  # 中心

    # 投影
    shadow = Image.new("RGBA", stone.size, (0,0,0,0))
    shd = ImageDraw.Draw(shadow)
    shd.ellipse([c-radius+radius*0.08, c-radius+radius*0.15,
                 c+radius+radius*0.08, c+radius+radius*0.15],
                fill=(60, 40, 10, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius*0.15))
    stone = Image.alpha_composite(stone, shadow)
    sd = ImageDraw.Draw(stone)

    # 主体：多圈同心圆模拟径向渐变
    if black:
        edge, mid, core = (20, 20, 22), (45, 45, 48), (95, 95, 100)
    else:
        edge, mid, core = (185, 185, 190), (225, 225, 230), (255, 255, 255)
    steps = 40
    for i in range(steps, 0, -1):
        t = i / steps
        r = radius * t
        if t > 0.7:
            k = (t - 0.7) / 0.3
            col = tuple(int(mid[j] + (edge[j] - mid[j]) * k) for j in range(3))
        else:
            k = t / 0.7
            col = tuple(int(core[j] + (mid[j] - core[j]) * k) for j in range(3))
        # 渐变中心偏左上
        cx_off = -radius * 0.25 * (1 - t)
        cy_off = -radius * 0.25 * (1 - t)
        sd.ellipse([c - r + cx_off, c - r + cy_off, c + r + cx_off, c + r + cy_off],
                   fill=col + (255,))

    # 高光（左上椭圆）
    hl_r = radius * 0.42
    highlight = Image.new("RGBA", stone.size, (0,0,0,0))
    hld = ImageDraw.Draw(highlight)
    hld.ellipse([c - radius*0.45 - hl_r, c - radius*0.5 - hl_r*0.9,
                 c - radius*0.45 + hl_r, c - radius*0.5 + hl_r*0.9],
                fill=(255, 255, 255, 130 if black else 220))
    highlight = highlight.filter(ImageFilter.GaussianBlur(radius*0.12))
    stone = Image.alpha_composite(stone, highlight)

    # 缩放粘贴到目标位置
    stone = stone.resize((int(radius*4), int(radius*4)))
    px = int(cx - radius*2)
    py = int(cy - radius*2)
    base.alpha_composite(stone, (px, py))

# 黑棋（左下，较大）
draw_stone(img, S*0.36, S*0.60, S*0.155, black=True)
# 白棋（右上，稍小，紧邻）
draw_stone(img, S*0.635, S*0.40, S*0.13, black=False)

# 白棋上加一枚小红点装饰（呼应游戏内"最后落子"标记）
d2 = ImageDraw.Draw(img)
dot_r = S * 0.016
d2.ellipse([S*0.635-dot_r, S*0.40-dot_r, S*0.635+dot_r, S*0.40+dot_r],
           fill=(228, 60, 60, 255))

# ============ 输出 ============
final = img.resize((1024, 1024), Image.LANCZOS)
final.save("/Users/liuxue/Desktop/www/maozi-gobang/web/src/assets/logo-1024.png")
final.resize((512, 512), Image.LANCZOS).save("/Users/liuxue/Desktop/www/maozi-gobang/web/src/assets/logo-512.png")
final.resize((192, 192), Image.LANCZOS).save("/Users/liuxue/Desktop/www/maozi-gobang/web/src/assets/favicon.png")

# Android mipmap 各密度
sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
import os
os.makedirs("/tmp/gobang-icons", exist_ok=True)
for name, px in sizes.items():
    final.resize((px, px), Image.LANCZOS).save(f"/tmp/gobang-icons/ic_launcher_{name}.png")
final.resize((512, 512), Image.LANCZOS).save("/tmp/gobang-icons/playstore.png")

print("logo 生成完成")
print("输出: web/src/assets/{logo-1024,logo-512,favicon}.png + /tmp/gobang-icons/ (Android 各密度)")
