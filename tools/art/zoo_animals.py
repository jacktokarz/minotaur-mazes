"""Pixel-art animal sprites for zoOrganizer (32x32, side view facing right).

Not needed to build the website; this is how the sprites in
public/zoorganizer/animals/ were drawn, kept so new animals match.

    pip install pillow
    python tools/art/zoo_animals.py
    PREVIEW=sheet.png python tools/art/zoo_animals.py   # also writes a preview sheet

Each animal is a function built from simple shapes (ellipses, lines,
legs) plus a few hand-placed pixels; a dark outline is added automatically.
"""
import os, math
from PIL import Image

N = 32
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "zoorganizer", "animals")
PREVIEW = os.environ.get("PREVIEW")   # optional: path for a preview sheet
os.makedirs(OUT, exist_ok=True)

def hexc(h):
    h = h.lstrip("#")
    if len(h) == 3: h = "".join(ch * 2 for ch in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

class Sprite:
    def __init__(self):
        self.px = {}                       # (x, y) -> colour
    # --- primitives -------------------------------------------------------
    def set(self, x, y, c):
        if 0 <= x < N and 0 <= y < N: self.px[(x, y)] = hexc(c) if isinstance(c, str) else c
    def ellipse_cells(self, cx, cy, rx, ry):
        return [(x, y) for y in range(N) for x in range(N)
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1]
    def ellipse(self, cx, cy, rx, ry, c):
        for x, y in self.ellipse_cells(cx, cy, rx, ry): self.set(x, y, c)
    def shaded_ellipse(self, cx, cy, rx, ry, base, shade, light=None):
        cells = set(self.ellipse_cells(cx, cy, rx, ry))
        for x, y in cells: self.set(x, y, shade)
        for x, y in self.ellipse_cells(cx - 0.3, cy - ry * 0.22, rx * 0.9, ry * 0.78):
            if (x, y) in cells: self.set(x, y, base)
        if light:
            for x, y in self.ellipse_cells(cx - rx * 0.2, cy - ry * 0.5, rx * 0.5, ry * 0.28):
                if (x, y) in cells: self.set(x, y, light)
    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.set(x, y, c)
    def line(self, x0, y0, x1, y1, c, width=1):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1) * 2
        for i in range(steps + 1):
            t = i / steps; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            for dx in range(width):
                for dy in range(width):
                    self.set(round(x - (width - 1) / 2 + dx), round(y - (width - 1) / 2 + dy), c)
    def leg(self, x, top, bottom, c, shade, hoof, width=2):
        self.rect(x, top, x + width - 1, bottom - 1, c)
        self.rect(x + width - 1, top, x + width - 1, bottom - 1, shade)
        self.rect(x, bottom, x + width - 1, bottom, hoof)
    # --- output -----------------------------------------------------------
    def image(self, outline="#1b130c"):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for (x, y), c in self.px.items(): img.putpixel((x, y), c)
        o = hexc(outline)
        add = []
        for y in range(N):
            for x in range(N):
                if (x, y) in self.px: continue
                if any((x + dx, y + dy) in self.px for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((x, y))
        for x, y in add: img.putpixel((x, y), o)
        return img

# ---------------------------------------------------------------- animals
def lion():
    s = Sprite()
    T, S, L = "#c8923f", "#9c6a2a", "#e2b463"
    M, MS, ML = "#8b4a1c", "#6a3412", "#ad6428"
    s.line(6, 16, 3, 20, S); s.line(3, 20, 3, 23, S)          # tail
    s.ellipse(3, 24, 1.6, 1.6, MS)                               # tail tuft
    s.leg(7, 20, 28, S, S, "#6e4a1f", 2); s.leg(18, 20, 28, S, S, "#6e4a1f", 2)   # far legs
    s.shaded_ellipse(14, 18, 9.5, 5, T, S, L)                    # body
    s.leg(10, 21, 28, T, S, "#e2b463", 3); s.leg(21, 21, 28, T, S, "#e2b463", 3)  # near legs
    s.shaded_ellipse(21, 12, 6.8, 7.8, M, MS, ML)                # mane
    s.shaded_ellipse(24.5, 12, 4, 4.6, T, S, L)                  # face
    s.ellipse(27.6, 14.2, 2.6, 2.1, "#ecc98c")                   # muzzle
    s.set(25, 10, "#1a1008"); s.set(24, 10, "#f6e6c0")           # eye
    s.set(29, 13, "#3a2010"); s.set(30, 13, "#3a2010")           # nose
    s.set(27, 16, "#7a4a20"); s.set(28, 16, "#7a4a20")           # mouth
    return s.image()

def zebra():
    s = Sprite()
    W, WS, B = "#ece8de", "#b9b3a6", "#24211f"
    s.line(5, 15, 3, 21, B)                                       # tail
    s.set(3, 22, B); s.set(2, 22, B)
    s.leg(7, 20, 28, WS, WS, B, 2); s.leg(18, 20, 28, WS, WS, B, 2)
    s.shaded_ellipse(13, 17.5, 9, 5, W, WS)                      # body
    s.line(19, 15, 23, 8, W, 4)                                   # neck
    s.leg(10, 21, 28, W, WS, B, 2); s.leg(21, 21, 28, W, WS, B, 2)
    s.shaded_ellipse(25.5, 8.5, 3, 3.6, W, WS)                   # head
    s.ellipse(27.8, 11.5, 2.2, 2, "#4a4642")                     # muzzle
    s.set(28, 11, "#111"); 
    s.set(23, 3, W); s.set(23, 4, W); s.set(24, 4, WS)            # ear
    for x, y in [(20, 9), (21, 8), (21, 7), (22, 6), (22, 5), (23, 5)]: s.set(x, y, B)   # mane
    # stripes: body (vertical, slightly curved), neck (diagonal), legs (horizontal)
    for x in (7, 10, 13, 16, 19):
        for y in range(13, 23):
            if s.px.get((x, y)) in (hexc(W), hexc(WS)) and (y + x) % 7 != 0: s.set(x + (1 if y > 19 else 0), y, B)
    for i in range(3):
        s.line(20 + i, 15 - 2 * i, 23 + i, 14 - 2 * i, B)
    for y in (23, 26):
        for x0 in (7, 10, 18, 21):
            s.set(x0, y, B); s.set(x0 + 1, y, B)
    s.set(26, 7, "#111")                                          # eye
    return s.image()

def camel():
    s = Sprite()
    T, S, L = "#c9a46a", "#9e7c46", "#e0c28a"
    s.line(5, 16, 4, 21, S)                                       # tail
    s.leg(7, 19, 28, S, S, "#6e5330", 2); s.leg(17, 19, 28, S, S, "#6e5330", 2)
    s.shaded_ellipse(13, 17, 8.5, 4.5, T, S, L)                  # body
    s.shaded_ellipse(12, 12.5, 5, 4.2, T, S, L)                  # hump
    s.leg(10, 20, 28, T, S, "#6e5330", 2); s.leg(20, 20, 28, T, S, "#6e5330", 2)
    for y in (24,): s.set(10, y, S); s.set(20, y, S)              # knees
    s.line(20, 16, 24, 13, T, 3)                                  # neck (forward)
    s.line(24, 13, 26, 8, T, 3)                                   # neck (up)
    s.shaded_ellipse(27.5, 7.5, 3.2, 2.3, T, S, L)               # head
    s.ellipse(30, 8.6, 1.4, 1.4, T)                               # snout
    s.set(26, 4, S); s.set(26, 5, T)                              # ear
    s.set(28, 6, "#1a1008")                                       # eye
    s.set(30, 9, "#5a4126")                                       # nostril/mouth
    return s.image()

def penguin():
    s = Sprite()
    K, KS, KL = "#2b2f3a", "#1c1f27", "#454b5c"
    W, WS = "#eef0f2", "#c5cad3"
    O = "#e8952a"
    s.rect(11, 27, 14, 28, O); s.rect(18, 27, 21, 28, O)           # feet
    s.shaded_ellipse(16, 17, 7.5, 10.5, K, KS, KL)               # body
    s.ellipse(16, 19.5, 4.8, 7.6, WS); s.ellipse(15.7, 18.8, 4.2, 7, W)   # belly
    s.ellipse(8.6, 18, 1.6, 5.2, KS); s.ellipse(23.4, 18, 1.6, 5.2, KS)   # flippers
    s.ellipse(13, 10.5, 1.6, 1.3, W); s.ellipse(19, 10.5, 1.6, 1.3, W)   # eye patches
    s.set(13, 10, "#111"); s.set(19, 10, "#111")                 # eyes
    s.rect(15, 12, 17, 12, O); s.set(16, 13, "#c47418")            # beak
    for x, y in [(13, 13), (19, 13), (12, 12), (20, 12)]: s.set(x, y, "#f2c94c")  # yellow cheeks
    return s.image("#0e0f13")

def goat():
    s = Sprite()
    G, GS, GL = "#d6cfc2", "#a89f91", "#ebe6dc"
    H = "#6b5b49"
    s.set(5, 14, G); s.set(4, 13, G); s.set(4, 12, GS)             # tail (up)
    s.leg(7, 20, 28, GS, GS, "#3b3129", 2); s.leg(17, 20, 28, GS, GS, "#3b3129", 2)
    s.shaded_ellipse(12.5, 17.5, 8, 4.5, G, GS, GL)              # body
    s.leg(10, 21, 28, G, GS, "#3b3129", 2); s.leg(20, 21, 28, G, GS, "#3b3129", 2)
    s.line(18, 16, 22, 11, G, 4)                                  # neck
    s.shaded_ellipse(24.5, 10, 3.2, 2.6, G, GS, GL)              # head
    s.ellipse(27.6, 11.2, 1.8, 1.6, G)                            # snout
    for x, y in [(23, 7), (22, 6), (22, 5), (21, 4), (20, 4), (19, 5)]: s.set(x, y, H)   # horn
    for x, y in [(24, 7), (23, 6), (23, 5), (22, 4)]: s.set(x, y, "#8c7a64")            # horn highlight
    s.set(21, 9, GS); s.set(20, 10, GS)                           # ear
    s.set(25, 9, "#1a1008")                                       # eye
    for x, y in [(26, 13), (26, 14), (25, 14), (26, 15)]: s.set(x, y, "#bfb6a6")         # beard
    s.set(29, 11, "#5a4a3a")                                      # nose
    return s.image()


def fossa():
    """Fossa-like: slender, reddish-brown, long thick tail, small round ears."""
    s = Sprite()
    F, FS, FL = "#a4643a", "#7a4526", "#c2804f"
    s.line(6, 18, 3, 22, FS, 2); s.line(3, 22, 2, 27, FS, 2)      # long tail
    s.leg(8, 20, 28, FS, FS, "#4a2a16", 2); s.leg(19, 20, 28, FS, FS, "#4a2a16", 2)
    s.shaded_ellipse(14, 18.5, 9.5, 3.8, F, FS, FL)              # long slender body
    s.leg(11, 21, 28, F, FS, "#4a2a16", 2); s.leg(21, 21, 28, F, FS, "#4a2a16", 2)
    s.line(21, 17, 23, 15, F, 3)                                  # neck
    s.shaded_ellipse(25, 14.5, 3.4, 3, F, FS, FL)                # head
    s.ellipse(28.2, 15.6, 2.2, 1.5, "#d29a6a")                   # muzzle
    s.ellipse(23.2, 11.4, 1.3, 1.3, FS); s.set(23, 11, "#e0a878")   # ears
    s.ellipse(25.8, 11.2, 1.2, 1.2, FS)
    s.set(26, 14, "#1a1008"); s.set(25, 14, "#f3d9b0")           # eye
    s.set(30, 15, "#2a1810")                                      # nose
    return s.image()

def monitor_lizard():
    """Long, low, grey-olive lizard with pale spots and a forked tongue."""
    s = Sprite()
    G, GS, GL = "#727349", "#4f5032", "#8f9060"
    SP = "#cfc47e"
    s.line(8, 22, 3, 25, G, 3); s.line(3, 25, 0, 27, GS, 2)       # tail (tapering)
    s.rect(9, 24, 10, 27, GS); s.rect(20, 24, 21, 27, GS)          # far legs
    s.shaded_ellipse(15, 21.5, 8.5, 3.3, G, GS, GL)              # body
    s.line(22, 21, 25, 20, G, 3)                                  # neck
    s.shaded_ellipse(27, 20, 3.2, 2, G, GS, GL)                  # head
    s.ellipse(29.6, 20.6, 1.6, 1.1, G)                            # snout
    s.rect(12, 24, 13, 27, G); s.rect(22, 24, 23, 27, G)           # near legs
    for x in (11, 13, 14, 22, 24): s.set(x, 28, "#2f2f1e")         # claws
    s.set(11, 27, G); s.set(22, 27, G)
    for x, y in [(10, 20), (13, 19), (16, 19), (19, 20), (12, 22), (17, 21), (6, 23), (21, 19)]: s.set(x, y, SP)
    s.set(27, 19, "#1a1008")                                      # eye
    s.set(31, 21, "#c0392b"); s.set(31, 20, "#c0392b")             # forked tongue
    return s.image()

def snowy_owl():
    """White owl, front-facing, black speckles, yellow eyes."""
    s = Sprite()
    W, WS = "#f4f6f8", "#c8ced8"
    s.shaded_ellipse(16, 18, 8, 10, W, WS)                       # body
    s.ellipse(9, 19, 2, 6, WS); s.ellipse(23, 19, 2, 6, WS)       # wings
    s.ellipse(16, 11, 6, 4.6, W)                                  # face
    for x, y in [(11, 18), (14, 21), (18, 19), (21, 22), (13, 24), (19, 25), (16, 23),
                 (9, 17), (23, 18), (10, 21), (22, 21), (12, 20), (20, 17)]:
        s.set(x, y, "#2a2d33")                                    # speckles
    for cx in (13, 19):                                           # yellow eyes
        s.rect(cx - 1, 10, cx, 11, "#f2c230"); s.set(cx, 10, "#111")
    s.set(16, 12, "#3a3d44"); s.set(16, 13, "#3a3d44")             # beak
    s.set(15, 8, "#dfe3e8"); s.set(17, 8, "#dfe3e8")               # brow feathers
    for x in (12, 14, 18, 20): s.set(x, 28, "#4a4d55")             # talons
    return s.image("#1a1c22")

def ring_tailed_lemur():
    """Grey body, white face with dark eye patches, big black-and-white ringed tail."""
    s = Sprite()
    G, GS, GL = "#8e8b87", "#6a6764", "#aaa7a2"
    # big, bushy tail with black and white rings, curling up over the back
    path = [(7.5, 18), (5, 15.5), (3.8, 12), (4, 8.5), (5.8, 5.2), (8.6, 3.2), (11.5, 2.8)]
    travelled = 0.0
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        steps = int(seg * 6)
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps; y = y0 + (y1 - y0) * i / steps
            band = int((travelled + seg * i / steps) / 2.6) % 2
            for cx, cy in s.ellipse_cells(x, y, 1.6, 1.6):
                s.set(cx, cy, "#1f1d1c" if band == 0 else "#f1efe9")
        travelled += seg
    s.leg(8, 20, 28, GS, GS, "#2a2826", 2); s.leg(18, 20, 28, GS, GS, "#2a2826", 2)
    s.shaded_ellipse(13.5, 18.5, 7.5, 4, G, GS, GL)              # body
    s.ellipse(13, 21, 5, 1.6, "#d8d5cf")                          # pale belly
    s.leg(11, 21, 28, G, GS, "#2a2826", 2); s.leg(20, 21, 28, G, GS, "#2a2826", 2)
    s.line(19, 17, 22, 14, G, 3)                                  # neck
    s.shaded_ellipse(24, 13.5, 3.4, 3.2, "#f1efe9", "#cfcbc4")   # white face
    s.ellipse(23.3, 11.3, 3, 1.5, GS)                             # grey crown
    s.ellipse(27.4, 14.8, 2, 1.3, "#f1efe9")                      # snout
    s.set(21, 9, GS); s.set(21, 10, G); s.set(23, 9, GS)            # ears
    s.rect(25, 12, 26, 13, "#2a2826"); s.set(26, 12, "#e8a020")     # eye patch + eye
    s.set(29, 14, "#1f1d1c")                                      # nose
    return s.image()

def brown_bear():
    """Big brown bear with a shoulder hump and round ears."""
    s = Sprite()
    B, BS, BL = "#7c4f2d", "#573520", "#9a683d"
    s.leg(6, 21, 28, BS, BS, "#2e1c10", 3); s.leg(17, 21, 28, BS, BS, "#2e1c10", 3)
    s.shaded_ellipse(14, 18, 10.5, 6.2, B, BS, BL)               # body
    s.shaded_ellipse(18, 13.2, 5, 3.6, B, BS, BL)                # shoulder hump
    s.leg(9, 22, 28, B, BS, "#2e1c10", 4); s.leg(20, 22, 28, B, BS, "#2e1c10", 4)
    s.shaded_ellipse(26, 15, 3.9, 3.6, B, BS, BL)                # head
    s.ellipse(29, 16.8, 2.2, 1.7, "#a57a52")                     # muzzle
    s.ellipse(24, 11.3, 1.4, 1.4, BS); s.ellipse(26.6, 11, 1.3, 1.3, BS)   # ears
    s.set(24, 11, "#3a2414")
    s.set(27, 14, "#120a05")                                      # eye
    s.set(31, 16, "#120a05"); s.set(30, 16, "#2a180c")             # nose
    return s.image()

def snake_necked_turtle():
    """Low domed shell with a long, snake-like neck stretched forward."""
    s = Sprite()
    SH, SS, SL = "#6b5a36", "#4a3d22", "#8a7648"
    K, KS = "#8d8a62", "#686543"
    s.set(4, 24, KS); s.set(3, 25, KS)                             # tail
    s.rect(6, 25, 8, 27, KS); s.rect(17, 25, 19, 27, KS)           # far legs
    s.line(20, 23, 24, 19, K, 2); s.line(24, 19, 27, 17, K, 2)     # long neck
    s.ellipse(29, 16.5, 2.4, 1.7, K)                              # head
    s.set(29, 15, "#1a1008"); s.set(31, 17, KS)                    # eye, mouth
    # shell: dome (top half of an ellipse) with scutes and a pale rim
    for x, y in s.ellipse_cells(13, 24, 9.5, 7.5):
        if y <= 24: s.set(x, y, SH)
    for x, y in s.ellipse_cells(12.5, 22.5, 7.5, 5):
        if y <= 22: s.set(x, y, SL)
    for x, y in s.ellipse_cells(12.5, 23, 5.5, 3.5):
        if y <= 22: s.set(x, y, SH)
    for x in range(5, 22): s.set(x, 24, "#c8b27a")                 # rim / plastron
    for x in (9, 13, 17): s.line(x, 18, x, 23, SS)                 # scute lines
    s.line(6, 21, 20, 21, SS)
    s.rect(8, 25, 10, 27, K); s.rect(18, 25, 20, 27, K)            # near legs
    for x in (8, 10, 18, 20): s.set(x, 28, "#3b3a28")              # claws
    return s.image()

def baboon():
    """Olive baboon on all fours: dog-like dark muzzle, arched tail, pink rump."""
    s = Sprite()
    B, BS, BL = "#8a7b55", "#66593b", "#a39466"
    s.line(7, 16, 6, 12, BS, 2); s.line(6, 12, 4, 11, BS, 2); s.line(4, 11, 3, 14, BS, 2); s.line(3, 14, 3, 17, BS, 2)  # arched tail
    s.leg(8, 20, 28, BS, BS, "#3b3426", 2); s.leg(18, 20, 28, BS, BS, "#3b3426", 2)
    s.shaded_ellipse(14, 17.5, 8, 4.4, B, BS, BL)                  # body (shoulders higher than hips)
    s.shaded_ellipse(19.5, 15.5, 3.6, 3.4, B, BS, BL)
    s.rect(6, 17, 7, 18, "#d98a8a")                                 # pink rump
    s.leg(11, 21, 28, B, BS, "#3b3426", 2); s.leg(21, 21, 28, B, BS, "#3b3426", 2)
    s.shaded_ellipse(24, 12.5, 3.4, 3.2, B, BS, BL)                # round head
    s.ellipse(27.6, 14.2, 3.2, 1.8, "#3f3830")                     # long dark muzzle
    s.ellipse(27.4, 13.6, 2.4, 0.9, "#4f473d")
    s.set(30, 13, "#1a1510"); s.rect(27, 15, 29, 15, "#2a241e")    # nostril, mouth
    s.rect(23, 10, 26, 10, "#4a3f30"); s.set(25, 11, "#120c08")    # brow, eye
    s.set(22, 9, BS); s.set(22, 10, BS)                             # ear
    return s.image()

def gorilla():
    """Front-facing gorilla: huge dark body, long arms down to the knuckles."""
    s = Sprite()
    K, KS, KL = "#2b2b30", "#19191c", "#3f3f47"
    s.rect(11, 24, 14, 28, KS); s.rect(18, 24, 21, 28, KS)         # legs
    s.ellipse(7.5, 20, 2.6, 7.5, KS); s.ellipse(24.5, 20, 2.6, 7.5, KS)   # arms
    s.rect(5, 26, 9, 28, "#121214"); s.rect(23, 26, 27, 28, "#121214")     # knuckles
    s.shaded_ellipse(16, 17.5, 8, 7.5, K, KS, KL)                  # body
    s.ellipse(16, 19.5, 4.2, 3.6, "#4c4848")                       # chest
    s.shaded_ellipse(16, 9, 4.6, 4.4, K, KS, KL)                   # head
    s.ellipse(16, 5.2, 2.6, 1.5, K)                                 # crest
    s.ellipse(16, 10.6, 3.1, 2.6, "#4d4646")                       # face
    s.rect(13, 8, 19, 8, "#141416")                                 # brow ridge
    s.set(14, 9, "#d8d0c0"); s.set(18, 9, "#d8d0c0")               # eyes
    s.set(15, 11, "#141416"); s.set(17, 11, "#141416")             # nostrils
    s.rect(15, 13, 17, 13, "#2a2424")                               # mouth
    return s.image("#0c0c0e")

def chimpanzee():
    """Front-facing chimp: dark fur, pale face, big ears."""
    s = Sprite()
    K, KS, KL = "#3a2e26", "#261d17", "#52443a"
    F, FS = "#caa586", "#a9836a"
    s.rect(12, 24, 14, 28, KS); s.rect(18, 24, 20, 28, KS)         # legs
    s.rect(11, 28, 14, 28, FS); s.rect(18, 28, 21, 28, FS)         # feet
    s.ellipse(9, 20, 2, 6.5, KS); s.ellipse(23, 20, 2, 6.5, KS)     # arms
    s.ellipse(9, 26.5, 1.6, 1.3, FS); s.ellipse(23, 26.5, 1.6, 1.3, FS)   # hands
    s.shaded_ellipse(16, 18.5, 6.5, 6.5, K, KS, KL)                # body
    s.ellipse(10.6, 10, 1.9, 2.2, F); s.ellipse(21.4, 10, 1.9, 2.2, F)    # big ears
    s.shaded_ellipse(16, 9.5, 4.6, 4.4, K, KS, KL)                 # head
    s.ellipse(16, 11, 3.3, 3.1, F)                                  # face
    s.ellipse(16, 12.8, 2.4, 1.6, "#dcbfa4")                       # muzzle
    s.rect(13, 9, 19, 9, FS)                                        # brow
    s.set(14, 10, "#140d08"); s.set(18, 10, "#140d08")             # eyes
    s.rect(15, 13, 17, 13, "#6e4f3c")                               # mouth
    return s.image()

def orangutan():
    """Front-facing orangutan: shaggy orange fur, very long arms, dark face."""
    s = Sprite()
    O, OS, OL = "#b4561f", "#853c13", "#d3733a"
    s.rect(12, 24, 14, 28, OS); s.rect(18, 24, 20, 28, OS)         # short legs
    s.line(10, 14, 5, 22, OS, 3); s.line(5, 22, 5, 27, OS, 3)       # long arms reaching down
    s.line(22, 14, 27, 22, OS, 3); s.line(27, 22, 27, 27, OS, 3)
    s.rect(4, 28, 6, 28, "#5a3a26"); s.rect(26, 28, 28, 28, "#5a3a26")   # hands
    s.shaded_ellipse(16, 18.5, 7, 7, O, OS, OL)                     # body
    for x, y in [(10, 22), (12, 25), (20, 25), (22, 22), (11, 18), (21, 18)]: s.set(x, y, OL)   # shaggy fur
    s.shaded_ellipse(16, 9.5, 5, 4.6, O, OS, OL)                    # head
    s.ellipse(16, 10.6, 3.4, 3, "#5b4634")                          # dark face
    s.ellipse(16, 12.4, 2.2, 1.3, "#6f5844")                        # muzzle
    s.set(14, 10, "#140d08"); s.set(18, 10, "#140d08")              # eyes
    s.rect(15, 13, 17, 13, "#3a2a1e")                               # mouth
    return s.image()

def gibbon():
    """Gibbon hanging from a branch by its long arms."""
    s = Sprite()
    G, GS, GL = "#cbb187", "#a18a63", "#e0ca9f"
    s.rect(1, 3, 30, 4, "#6b4a2b"); s.rect(1, 3, 30, 3, "#8a6238")   # branch
    for x in (4, 26): s.set(x, 5, "#4f8a3e"); s.set(x + 1, 5, "#5c9945")  # leaves
    s.line(11, 5, 13, 13, G, 2); s.line(21, 5, 19, 13, G, 2)         # long arms up to the branch
    s.rect(10, 4, 12, 5, GS); s.rect(20, 4, 22, 5, GS)               # hands gripping
    s.shaded_ellipse(16, 18, 4.4, 5.5, G, GS, GL)                    # body
    s.line(14, 22, 12, 28, GS, 2); s.line(18, 22, 20, 28, GS, 2)      # dangling legs
    s.ellipse(16, 12, 3.4, 3.2, GS)                                   # head (fur)
    s.ellipse(16, 12.4, 2.6, 2.4, "#f2ead8")                         # white face ring
    s.ellipse(16, 12.6, 1.8, 1.7, "#3a2e24")                         # dark face
    s.set(15, 12, "#f2ead8"); s.set(17, 12, "#f2ead8")               # eyes
    return s.image()

def golden_lion_tamarin():
    """Small golden monkey with a lion-like mane around a dark face, and a long tail."""
    s = Sprite()
    Y, YS, YL = "#e09a2a", "#ad6c18", "#f5c257"
    s.line(9, 21, 7, 25, YS, 2); s.line(7, 25, 8, 29, YS, 2)          # long tail hanging down
    s.rect(11, 23, 12, 27, YS); s.rect(18, 23, 19, 27, YS)            # far legs
    s.shaded_ellipse(14.5, 21.5, 5.5, 2.8, Y, YS, YL)                # small body
    s.rect(13, 23, 14, 27, Y); s.rect(20, 23, 21, 27, Y)              # near legs
    s.ellipse(22, 16.5, 4.6, 4.4, YS)                                # mane (outer)
    s.ellipse(22, 16.2, 4, 3.8, YL)                                  # mane (inner, bright)
    s.ellipse(23.4, 17, 2.1, 2.2, "#4a2a1a")                         # dark face
    s.set(24, 16, "#f8e2a0"); s.set(23, 16, "#1a0e06")               # eye
    s.set(25, 18, "#2a160c")                                          # nose
    return s.image()

def pygmy_marmoset():
    """Tiny tawny-olive monkey with a curled, faintly banded tail."""
    s = Sprite()
    M, MS, ML = "#8e7d5a", "#685a3e", "#aa9a74"
    curl = [(12, 23), (10, 23), (8.5, 21.5), (8, 19.5), (9, 18), (10.5, 18.2)]
    travelled = 0.0
    for (x0, y0), (x1, y1) in zip(curl, curl[1:]):
        seg = math.hypot(x1 - x0, y1 - y0); steps = max(1, int(seg * 6))
        for i in range(steps):
            x = x0 + (x1 - x0) * i / steps; y = y0 + (y1 - y0) * i / steps
            band = int((travelled + seg * i / steps) / 1.8) % 2
            for cx, cy in s.ellipse_cells(x, y, 1.05, 1.05):
                s.set(cx, cy, MS if band else "#4c412c")
        travelled += seg
    s.rect(13, 24, 13, 27, MS); s.rect(18, 24, 18, 27, MS)            # far legs
    s.shaded_ellipse(16, 23, 4, 2.5, M, MS, ML)                      # tiny body
    s.rect(14, 24, 15, 27, M); s.rect(19, 24, 20, 27, M)              # near legs
    s.shaded_ellipse(21, 20, 2.8, 2.6, M, MS, ML)                    # head
    s.ellipse(22.4, 20.6, 1.3, 1.2, "#d8cfb8")                       # pale muzzle
    s.set(22, 19, "#120c08"); s.set(23, 21, "#3a3022")               # eye, nose
    s.set(19, 18, ML)                                                 # ear tuft
    return s.image()

# Filename = the animal's name in lowercase with dashes ("Snow Leopard" -> snow-leopard.png).
ANIMALS = {
    "lion": lion, "zebra": zebra, "camel": camel, "penguin": penguin, "goat": goat,
    "fossa": fossa, "monitor-lizard": monitor_lizard, "snowy-owl": snowy_owl,
    "ring-tailed-lemur": ring_tailed_lemur, "brown-bear": brown_bear,
    "snake-necked-turtle": snake_necked_turtle,
    "baboon": baboon, "gorilla": gorilla, "chimpanzee": chimpanzee, "orangutan": orangutan,
    "gibbon": gibbon, "golden-lion-tamarin": golden_lion_tamarin, "pygmy-marmoset": pygmy_marmoset,
}
for name, make in ANIMALS.items():
    make().save(f"{OUT}/{name}.png")

# preview sheet: each sprite at 4x, on two different grounds
if not PREVIEW:
    print(f"Animal sprites written to {OUT}"); raise SystemExit
tiles = os.path.join(ROOT, "public", "zoorganizer", "tiles") + os.sep
grounds = [Image.open(tiles + f).convert("RGBA") for f in ("terrain-sand.png", "terrain-grass.png", "terrain-snow.png")]
names = list(ANIMALS)
cols = 6
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * 136 + 8, rows * len(grounds) * 136 + 8), (23, 25, 22, 255))
for i, name in enumerate(names):
    sp = Image.open(f"{OUT}/{name}.png").resize((128, 128), Image.NEAREST)
    for j, g in enumerate(grounds):
        bg = g.resize((128, 128), Image.NEAREST); bg.alpha_composite(sp)
        sheet.alpha_composite(bg, (8 + (i % cols) * 136, 8 + ((i // cols) * len(grounds) + j) * 136))
sheet.save(PREVIEW)
print(f"Animal sprites written to {OUT}; preview sheet at {PREVIEW}")
