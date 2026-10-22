import math, sys
from PIL import Image, ImageDraw

out_dir = sys.argv[1]
S = 1024  # draw big, downscale for antialiasing


def star(cx, cy, r_out, r_in, points=5, rot=-math.pi / 2):
    pts = []
    for i in range(points * 2):
        r = r_out if i % 2 == 0 else r_in
        a = rot + i * math.pi / points
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# Background: vertical purple gradient in a rounded square
grad = Image.new("RGBA", (S, S))
gd = ImageDraw.Draw(grad)
top, bot = (155, 77, 255), (90, 31, 158)
for y in range(S):
    t = y / S
    gd.line([(0, y), (S, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=255)
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
img.paste(grad, (0, 0), mask)
d = ImageDraw.Draw(img)

# Wand: thick white stick from bottom-left toward the star
x0, y0, x1, y1 = S * 0.2, S * 0.8, S * 0.6, S * 0.4
w = S * 0.11
ang = math.atan2(y1 - y0, x1 - x0)
nx, ny = -math.sin(ang) * w / 2, math.cos(ang) * w / 2
d.polygon([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], fill="white")
d.ellipse([x0 - w / 2, y0 - w / 2, x0 + w / 2, y0 + w / 2], fill="white")

# Gold star at the tip + sparkles
gold = (255, 204, 51)
d.polygon(star(S * 0.66, S * 0.34, S * 0.24, S * 0.1), fill=gold)
d.polygon(star(S * 0.24, S * 0.25, S * 0.09, S * 0.025, points=4, rot=0), fill="white")
d.polygon(star(S * 0.84, S * 0.72, S * 0.07, S * 0.02, points=4, rot=0), fill="white")

for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f"{out_dir}/icon{size}.png")
