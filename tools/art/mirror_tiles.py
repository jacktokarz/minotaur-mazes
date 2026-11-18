"""Pixel-art tiles for the Mirror Maze puzzles (wall, floor, letter square).

Not needed to build the website; this is how the tiles in
public/mirror-maze/tiles/ were drawn, kept so new ones match.

    pip install pillow
    python tools/art/mirror_tiles.py

Tiles are drawn at 32x32 and scaled x2 (nearest neighbour) to 64x64 like the
other puzzles' tiles. Each square of the maze shows one whole tile; the three
floor variants are mixed so the floor doesn't look copy-pasted.
"""
import os
import random
from PIL import Image

N = 32
SCALE = 2
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "mirror-maze", "tiles")
os.makedirs(OUT, exist_ok=True)


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def shade(c, amount):
    """Lighten (amount > 0) or darken (amount < 0) a colour."""
    r, g, b, a = c
    if amount >= 0:
        return (int(r + (255 - r) * amount), int(g + (255 - g) * amount), int(b + (255 - b) * amount), a)
    return (int(r * (1 + amount)), int(g * (1 + amount)), int(b * (1 + amount)), a)


def speckle(img, rnd, colors, count, box=(0, 0, N, N)):
    x0, y0, x1, y1 = box
    if x1 <= x0 or y1 <= y0:
        return
    for _ in range(count):
        img.putpixel((rnd.randrange(x0, x1), rnd.randrange(y0, y1)), rnd.choice(colors))


def save(img, name):
    img.resize((N * SCALE, N * SCALE), Image.NEAREST).save(os.path.join(OUT, name + ".png"))
    print("wrote", name)


def wall(seed=11):
    """Dark stone bricks, staggered rows."""
    rnd = random.Random(seed)
    mortar = hexc("#101210")
    base = [hexc("#2a2e27"), hexc("#2f342b"), hexc("#262a23"), hexc("#333830")]
    img = Image.new("RGBA", (N, N), mortar)
    brick_h = 8
    for row in range(N // brick_h):
        y0 = row * brick_h
        offset = 0 if row % 2 == 0 else 8
        for col in range(-1, 3):
            x0 = col * 16 + offset
            color = rnd.choice(base)
            for y in range(y0 + 1, y0 + brick_h):
                for x in range(x0 + 1, x0 + 16):
                    if 0 <= x < N:
                        c = color
                        if y == y0 + 1:
                            c = shade(color, 0.12)      # lit top edge
                        elif y == y0 + brick_h - 1:
                            c = shade(color, -0.25)     # shadowed bottom edge
                        img.putpixel((x, y), c)
            speckle(img, rnd, [shade(color, -0.18), shade(color, 0.08)], 6,
                    (max(0, x0 + 2), y0 + 2, min(N, x0 + 15), y0 + brick_h - 1))
    return img


def floor(seed=12):
    """Worn flagstone: a slightly bevelled slab with small cracks and grit."""
    rnd = random.Random(seed)
    base = hexc("#3a4034")
    img = Image.new("RGBA", (N, N), base)
    for y in range(N):
        for x in range(N):
            n = rnd.random()
            if n < 0.10:
                img.putpixel((x, y), shade(base, -0.10))
            elif n < 0.16:
                img.putpixel((x, y), shade(base, 0.07))
    for i in range(N):  # bevel
        img.putpixel((i, 0), shade(base, 0.14))
        img.putpixel((0, i), shade(base, 0.10))
        img.putpixel((i, N - 1), shade(base, -0.30))
        img.putpixel((N - 1, i), shade(base, -0.25))
    # a couple of hairline cracks, placed differently on each variant
    starts = [(rnd.randrange(3, 26), rnd.randrange(3, 26)) for _ in range(2)]
    for start in starts:
        x, y = start
        for _ in range(7):
            img.putpixel((x, y), shade(base, -0.28))
            x += rnd.choice((1, 1, 0))
            y += rnd.choice((-1, 0, 1))
            x, y = min(max(x, 2), N - 3), min(max(y, 2), N - 3)
    return img


def letter_plate(seed=13):
    """A light, polished stone plate for letters/icons: clearly not a wall."""
    rnd = random.Random(seed)
    rim = hexc("#6b6a55")
    face = hexc("#5a5a48")
    img = Image.new("RGBA", (N, N), rim)
    for y in range(2, N - 2):
        for x in range(2, N - 2):
            c = face
            n = rnd.random()
            if n < 0.08:
                c = shade(face, 0.08)
            elif n < 0.14:
                c = shade(face, -0.08)
            img.putpixel((x, y), c)
    for i in range(N):
        img.putpixel((i, 0), shade(rim, 0.25))
        img.putpixel((0, i), shade(rim, 0.20))
        img.putpixel((i, N - 1), shade(rim, -0.35))
        img.putpixel((N - 1, i), shade(rim, -0.30))
    for i in range(2, N - 2):  # inner bevel
        img.putpixel((i, 2), shade(face, -0.22))
        img.putpixel((2, i), shade(face, -0.18))
        img.putpixel((i, N - 3), shade(face, 0.16))
        img.putpixel((N - 3, i), shade(face, 0.12))
    return img


save(wall(), "wall")
for variant, seed in enumerate((12, 21, 34), start=1):  # mixed across the board
    save(floor(seed), f"floor-{variant}")
save(letter_plate(), "letter")
