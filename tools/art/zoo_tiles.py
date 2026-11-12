"""Pixel-art tiles for zoOrganizer (ground types, path, lawn, tree, fences...).

Not needed to build the website; this is how the tiles in
public/zoorganizer/tiles/ were drawn, kept so new ones match.

    pip install pillow
    python tools/art/zoo_tiles.py

Tiles are drawn at 32x32 and scaled x2 (nearest neighbour) to 64x64 like the
Minotaur tiles, and are seamless so enclosures can be any size.
"""
import math, random, os
from PIL import Image, ImageDraw

N = 32            # native pixel-art resolution
SCALE = 2         # -> 64x64 like the Minotaur tiles
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "zoorganizer", "tiles")
os.makedirs(OUT, exist_ok=True)

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

def periodic_noise(seed, size=N, octaves=((4, 1.0), (8, 0.5), (16, 0.25))):
    """Seamless value noise in [0,1]."""
    rnd = random.Random(seed)
    out = [[0.0]*size for _ in range(size)]
    total = sum(a for _, a in octaves)
    for cells, amp in octaves:
        lat = [[rnd.random() for _ in range(cells)] for _ in range(cells)]
        step = size / cells
        for y in range(size):
            for x in range(size):
                gx, gy = x / step, y / step
                x0, y0 = int(gx) % cells, int(gy) % cells
                x1, y1 = (x0 + 1) % cells, (y0 + 1) % cells
                fx, fy = gx - int(gx), gy - int(gy)
                sx, sy = fx*fx*(3-2*fx), fy*fy*(3-2*fy)
                a = lat[y0][x0] + (lat[y0][x1] - lat[y0][x0]) * sx
                b = lat[y1][x0] + (lat[y1][x1] - lat[y1][x0]) * sx
                out[y][x] += (a + (b - a) * sy) * amp
    return [[v / total for v in row] for row in out]

def dithered(noise, palette, contrast=1.6):
    img = Image.new("RGBA", (N, N))
    px = img.load()
    k = len(palette)
    for y in range(N):
        for x in range(N):
            v = (noise[y][x] - 0.5) * contrast + 0.5
            v = min(max(v, 0), 0.999)
            t = (BAYER[y % 4][x % 4] + 0.5) / 16 - 0.5
            idx = int(min(max(v * k + t * 0.9, 0), k - 1))
            px[x, y] = palette[idx]
    return img

def put(img, x, y, c):
    img.putpixel((x % N, y % N), c)

def up(img, scale=SCALE):
    return img.resize((img.width*scale, img.height*scale), Image.NEAREST)

def mute(img, sat=0.8, bright=0.94):
    from PIL import ImageEnhance
    a = img.getchannel("A")
    rgb = ImageEnhance.Color(img.convert("RGB")).enhance(sat)
    rgb = ImageEnhance.Brightness(rgb).enhance(bright)
    rgb.putalpha(a)
    return rgb

def save(img, name):
    up(mute(img)).save(f"{OUT}/{name}.png")

# ---------------------------------------------------------------- terrains
def grass(seed=1, pal=("#2c5228", "#36622f", "#417237", "#4f8240"), tuft="#6a9a4d", dark="#24431f", flowers=False):
    p = [hexc(c) for c in pal]
    img = dithered(periodic_noise(seed), p)
    r = random.Random(seed + 100)
    for _ in range(22):                      # grass tufts: little "v" shapes
        x, y = r.randrange(N), r.randrange(N)
        put(img, x, y, hexc(tuft)); put(img, x - 1, y - 1, hexc(tuft)); put(img, x + 1, y - 1, hexc(tuft))
        put(img, x, y + 1, hexc(dark))
    if flowers:
        for _ in range(5):
            x, y = r.randrange(N), r.randrange(N)
            c = hexc(r.choice(["#e8d27a", "#e6e0d0", "#d98a8a"]))
            put(img, x, y, c); put(img, x + 1, y, c); put(img, x, y + 1, c); put(img, x + 1, y + 1, hexc("#c9a94a"))
    return img

def sand(seed=2):
    p = [hexc(c) for c in ("#a98a55", "#b89863", "#c6a671", "#d3b580")]
    img = dithered(periodic_noise(seed), p, 1.3)
    r = random.Random(seed + 100)
    for _ in range(14):                      # pebbles
        x, y = r.randrange(N), r.randrange(N)
        put(img, x, y, hexc("#8d7146")); put(img, x + 1, y, hexc("#e2cb98"))
    for _ in range(6):                       # wind ripples
        x, y = r.randrange(N), r.randrange(N)
        for i in range(4): put(img, x + i, y + (1 if i in (1, 2) else 0), hexc("#9c7f4e"))
    return img

def water(seed=3):
    p = [hexc(c) for c in ("#25557a", "#2c638b", "#336f98", "#3d7ea6")]
    img = dithered(periodic_noise(seed), p, 1.4)
    r = random.Random(seed + 100)
    for _ in range(9):                       # wave highlights
        x, y = r.randrange(N), r.randrange(N)
        L = r.choice([3, 4, 5])
        for i in range(L): put(img, x + i, y, hexc("#7fb6d2"))
        put(img, x + 1, y + 1, hexc("#4f8fb6"))
    return img

def rock(seed=4):
    p = [hexc(c) for c in ("#5f5e58", "#6e6d66", "#7d7c74", "#8c8b82")]
    img = dithered(periodic_noise(seed), p, 1.5)
    r = random.Random(seed + 100)
    for _ in range(7):                       # boulders with highlight + shadow
        x, y = r.randrange(N), r.randrange(N)
        for dx, dy in [(0,0),(1,0),(2,0),(0,1),(1,1),(2,1),(1,-1)]:
            put(img, x+dx, y+dy, hexc("#9a998f"))
        put(img, x, y-0, hexc("#b1b0a5")); put(img, x+1, y-1, hexc("#b1b0a5"))
        for dx in range(3): put(img, x+dx, y+2, hexc("#4a4944"))
    for _ in range(3):                       # cracks
        x, y = r.randrange(N), r.randrange(N)
        for i in range(5): put(img, x + i, y + (i // 2), hexc("#4d4c47"))
    return img

def snow(seed=5):
    p = [hexc(c) for c in ("#b9c8d3", "#c9d6df", "#d8e2e9", "#e6edf2")]
    img = dithered(periodic_noise(seed), p, 1.3)
    r = random.Random(seed + 100)
    for _ in range(16):
        x, y = r.randrange(N), r.randrange(N)
        put(img, x, y, hexc("#f7fafc"))
    for _ in range(5):
        x, y = r.randrange(N), r.randrange(N)
        for i in range(3): put(img, x + i, y, hexc("#a7b8c6"))
    return img

def dirt(seed=6):
    p = [hexc(c) for c in ("#553b25", "#634529", "#71502f", "#7f5b36")]
    img = dithered(periodic_noise(seed), p, 1.4)
    r = random.Random(seed + 100)
    for _ in range(14):
        x, y = r.randrange(N), r.randrange(N)
        put(img, x, y, hexc("#94714a")); put(img, x, y + 1, hexc("#3f2b1b"))
    return img

def jungle(seed=7):
    p = [hexc(c) for c in ("#1c3d21", "#234a27", "#2b582e", "#346736")]
    img = dithered(periodic_noise(seed), p, 1.5)
    r = random.Random(seed + 100)
    for _ in range(12):                      # leaves
        x, y = r.randrange(N), r.randrange(N)
        c, d = hexc(r.choice(["#4f8a3e", "#5c9945", "#6b7f2c"])), hexc("#15301a")
        for dx, dy in [(0,0),(1,0),(1,1),(2,1),(2,2)]: put(img, x+dx, y+dy, c)
        put(img, x, y+1, d)
    return img

def path_tile(seed=8):
    """Gravel walkway: soft, low-contrast so the enclosures stand out."""
    p = [hexc(c) for c in ("#8d8470", "#978e79", "#a09782", "#a9a08a")]
    img = dithered(periodic_noise(seed, octaves=((4, 1.0), (16, 0.7), (32, 0.5))), p, 1.1)
    r = random.Random(seed + 100)
    for _ in range(26):                         # pebbles: dark base, light top
        x, y = r.randrange(N), r.randrange(N)
        put(img, x, y, hexc("#b8af98")); put(img, x + 1, y, hexc("#b1a891"))
        put(img, x, y + 1, hexc("#6f6755")); put(img, x + 1, y + 1, hexc("#7a7260"))
    for _ in range(20):
        put(img, r.randrange(N), r.randrange(N), hexc("#807763"))
    return img

def planks(seed=9):
    """Wooden deck for the arrivals area (horizontal planks)."""
    p = [hexc(c) for c in ("#5d3f24", "#6a4a2b", "#775433", "#835e39")]
    img = dithered(periodic_noise(seed, octaves=((2, 1.0), (16, 0.6), (32, 0.3))), p, 1.3)
    dark, hi = hexc("#3c2817"), hexc("#946c43")
    r = random.Random(seed)
    for y0 in range(0, N, 8):
        for x in range(N): put(img, x, y0, dark); put(img, x, y0 + 1, hi)
        cut = r.randrange(N)
        for y in range(y0, y0 + 8): put(img, cut, y, dark)
        put(img, cut + 2, y0 + 4, dark); put(img, cut - 3, y0 + 4, dark)   # nails
        for _ in range(3):                                                 # grain
            gx, gy = r.randrange(N), y0 + r.randrange(3, 7)
            for i in range(r.randrange(3, 7)): put(img, gx + i, gy, hexc("#57391f"))
    return img

TERRAINS = dict(grass=grass(), sand=sand(), water=water(), rock=rock(), snow=snow(),
                dirt=dirt(), jungle=jungle())
for name, im in TERRAINS.items(): save(im, f"terrain-{name}")
save(path_tile(), "path")
save(grass(11, ("#345c2c", "#3e6a33", "#48773a", "#558544"), "#6f9f52", "#2a4b24", flowers=True), "lawn")
save(planks(), "planks")

# ---------------------------------------------------------------- sprites
def tree():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([5, 20, 28, 30], fill=(20, 30, 16, 110))              # shadow
    d.rectangle([14, 18, 17, 26], fill=hexc("#5a3b22"))              # trunk
    d.rectangle([14, 18, 14, 26], fill=hexc("#3f2816"))
    blobs = [(16, 11, 11), (9, 14, 7), (23, 14, 7), (16, 6, 7)]
    for cx, cy, rr in blobs: d.ellipse([cx-rr-1, cy-rr-1, cx+rr+1, cy+rr+1], fill=hexc("#16301a"))   # outline
    for cx, cy, rr in blobs: d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], fill=hexc("#2f6333"))
    for cx, cy, rr in blobs: d.ellipse([cx-rr+2, cy-rr+1, cx+rr-3, cy+rr-4], fill=hexc("#3f7a3c"))
    for cx, cy, rr in blobs: d.ellipse([cx-rr+3, cy-rr+2, cx-rr+6, cy-rr+4], fill=hexc("#63a152"))
    r = random.Random(5)
    for _ in range(10):
        x, y = r.randrange(6, 26), r.randrange(2, 20)
        if img.getpixel((x, y))[3] and img.getpixel((x, y)) != hexc("#16301a"):
            img.putpixel((x, y), hexc("#24502a"))
    return img

def fence_h():
    """Horizontal fence rail, 32 x 8 (centred on a cell edge)."""
    img = Image.new("RGBA", (N, 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 2, N-1, 6], fill=hexc("#3a2412"))   # outline / shadow
    d.rectangle([0, 2, N-1, 4], fill=hexc("#8a5a2e"))
    d.line([0, 2, N-1, 2], fill=hexc("#b07a43"))
    d.line([0, 5, N-1, 5], fill=hexc("#5e3a1b"))
    for x in (9, 22): d.point((x, 3), fill=hexc("#5e3a1b"))   # grain
    return img

def fence_v():
    img = Image.new("RGBA", (8, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([1, 0, 6, N-1], fill=hexc("#3a2412"))
    d.rectangle([2, 0, 4, N-1], fill=hexc("#8a5a2e"))
    d.line([2, 0, 2, N-1], fill=hexc("#b07a43"))
    d.line([5, 0, 5, N-1], fill=hexc("#5e3a1b"))
    for y in (7, 20): d.point((3, y), fill=hexc("#5e3a1b"))
    return img

def fence_post():
    img = Image.new("RGBA", (10, 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, 9, 9], fill=(20, 14, 8, 120))     # shadow
    d.rectangle([0, 0, 7, 7], fill=hexc("#2e1c0e"))
    d.rectangle([1, 1, 6, 6], fill=hexc("#7a4f28"))
    d.rectangle([1, 1, 5, 2], fill=hexc("#a8743f"))
    d.rectangle([1, 1, 2, 5], fill=hexc("#a8743f"))
    d.point((4, 4), fill=hexc("#5a381b"))
    return img

def straw():
    """Bedding patch marking an empty arrival spot."""
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([3, 7, 28, 26], fill=hexc("#6e5a2a"))
    d.ellipse([4, 7, 27, 24], fill=hexc("#b89a45"))
    r = random.Random(3)
    for _ in range(60):
        x, y = r.randrange(5, 27), r.randrange(8, 24)
        if img.getpixel((x, y))[3]:
            c = hexc(r.choice(["#d9bd62", "#9c7f35", "#e8d07c", "#c7a84f"]))
            img.putpixel((x, y), c)
            if x + 1 < N and img.getpixel((x+1, y))[3]: img.putpixel((x + 1, y), c)
    return img

save(tree(), "tree")
save(fence_h(), "fence-h")
save(fence_v(), "fence-v")
save(fence_post(), "fence-post")
save(straw(), "straw")
print("tiles written to", OUT)
