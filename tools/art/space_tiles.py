"""Pixel-art tiles and creatures for Space Roundup.

Not needed to build the website; this is how the images in
public/space-roundup/tiles/ were drawn, kept so new ones match.

    pip install pillow
    python tools/art/space_tiles.py

Drawn at 32x32 and scaled x2 (nearest neighbour) to 64x64 like the other
puzzles' tiles. Creatures and portals have transparent backgrounds so they
sit on top of the space tiles.
"""
import math
import os
import random
from PIL import Image, ImageDraw

N = 32
SCALE = 2
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "space-roundup", "tiles")
os.makedirs(OUT, exist_ok=True)


def hexc(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def save(img, name):
    img.resize((N * SCALE, N * SCALE), Image.NEAREST).save(os.path.join(OUT, name + ".png"))
    print("wrote", name)


def disc(draw, cx, cy, r, color):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)


# ------------------------------------------------------------------ space

def space(seed):
    """Deep space with a few stars of different brightness."""
    rnd = random.Random(seed)
    base = hexc("#0b1026")
    img = Image.new("RGBA", (N, N), base)
    for y in range(N):  # very faint nebula haze
        for x in range(N):
            if rnd.random() < 0.06:
                img.putpixel((x, y), hexc("#10173a"))
    for _ in range(rnd.randint(5, 8)):
        x, y = rnd.randrange(1, N - 1), rnd.randrange(1, N - 1)
        img.putpixel((x, y), rnd.choice([hexc("#6c7aa8"), hexc("#9aa6cf"), hexc("#c9d3f5")]))
    if rnd.random() < 0.7:  # one bright twinkle
        x, y = rnd.randrange(3, N - 3), rnd.randrange(3, N - 3)
        img.putpixel((x, y), hexc("#ffffff"))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            img.putpixel((x + dx, y + dy), hexc("#8fa0d8"))
    return img


# ------------------------------------------------------------------ asteroid

def asteroid(seed):
    """A lumpy grey-brown rock with craters, on a space background."""
    rnd = random.Random(seed)
    img = space(seed + 100)
    body = hexc("#5d5348")
    light = hexc("#7d7163")
    dark = hexc("#3b342d")
    # lumpy outline: radius varies with angle
    bumps = [rnd.uniform(12.5, 15.5) for _ in range(10)]

    def radius(angle):
        i = angle / (2 * math.pi) * len(bumps)
        a, b = int(i) % len(bumps), (int(i) + 1) % len(bumps)
        t = i - int(i)
        return bumps[a] * (1 - t) + bumps[b] * t

    cx, cy = 15.5, 15.5
    for y in range(N):
        for x in range(N):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            r = radius(math.atan2(dy, dx) % (2 * math.pi))
            if d <= r:
                c = body
                if dx + dy < -r * 0.55:
                    c = light          # lit from the top-left
                elif dx + dy > r * 0.6:
                    c = dark           # shadow bottom-right
                if rnd.random() < 0.08:
                    c = dark if c != dark else body
                img.putpixel((x, y), c)
    draw = ImageDraw.Draw(img)
    for _ in range(3):  # craters
        x, y, r = rnd.randint(8, 22), rnd.randint(8, 22), rnd.randint(2, 3)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=dark)
        draw.arc((x - r, y - r, x + r, y + r), 200, 20, fill=light)
    return img


# ------------------------------------------------------------------ creatures

def creature(body, shade, eye_style="two", antenna=True, blush=None, size=11):
    """A round space creature, facing the viewer."""
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = 16, 17
    disc(draw, cx, cy + 1, size, shade)          # shadow side
    disc(draw, cx - 1, cy, size - 1, body)       # body
    disc(draw, cx - 5, cy - 5, 2, hexc("#ffffff", 170))  # shine
    if antenna:
        draw.line((cx, cy - size, cx + 3, cy - size - 4), fill=shade, width=1)
        disc(draw, cx + 3, cy - size - 4, 1, hexc("#fff3a8"))
    white, pupil = hexc("#ffffff"), hexc("#1b1830")
    if eye_style == "two":
        for ex in (cx - 5, cx + 3):
            disc(draw, ex, cy - 1, 3, white)
            disc(draw, ex + 1, cy, 1, pupil)
    else:  # one big eye
        disc(draw, cx - 1, cy - 1, 4, white)
        disc(draw, cx, cy, 2, pupil)
    if blush:
        draw.point([(cx - 8, cy + 3), (cx - 7, cy + 3), (cx + 6, cy + 3), (cx + 7, cy + 3)], fill=blush)
    draw.arc((cx - 4, cy + 1, cx + 2, cy + 6), 20, 160, fill=pupil)  # smile
    return img


# ------------------------------------------------------------------ exit portal

def portal(open_):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = 15.5, 15.5
    if open_:
        rings = [(14, "#2f7d6d"), (12, "#3fb39a"), (10, "#6fe3c6"), (7, "#b8ffef"), (4, "#ffffff")]
    else:
        rings = [(14, "#3a2f4f"), (12, "#4a3c66"), (10, "#2a2340"), (7, "#1c1830"), (4, "#15122a")]
    for r, color in rings:
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=hexc(color))
    if open_:
        for i in range(12):  # swirl sparkles
            a = i / 12 * 2 * math.pi
            r = 6 + (i % 3) * 2.5
            img.putpixel((int(cx + r * math.cos(a)), int(cy + r * math.sin(a))), hexc("#e9fff9"))
    else:  # bars across a locked portal
        for x in (11, 15, 19):
            draw.line((x, 4, x, 27), fill=hexc("#8a7aa8"), width=2)
        draw.line((5, 15, 26, 15), fill=hexc("#8a7aa8"), width=2)
    return img


for i, seed in enumerate((1, 2, 3), start=1):
    save(space(seed), f"space-{i}")
for i, seed in enumerate((11, 12, 13), start=1):
    save(asteroid(seed), f"asteroid-{i}")

save(creature(hexc("#47c7e8"), hexc("#2a8fb0"), blush=hexc("#ff9ab0")), "player")

FRIENDS = [
    ("#ff8fb3", "#c95b82", "one"),
    ("#ffd35c", "#c9992a", "two"),
    ("#8fe07a", "#57a546", "one"),
    ("#c39cff", "#8a63c9", "two"),
]
for i, (body, shade, eyes) in enumerate(FRIENDS, start=1):
    save(creature(hexc(body), hexc(shade), eye_style=eyes, antenna=(i % 2 == 0), size=10), f"friend-{i}")

save(portal(False), "exit-locked")
save(portal(True), "exit-open")
