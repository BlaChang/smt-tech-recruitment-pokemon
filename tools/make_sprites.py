#!/usr/bin/env python3
"""
Generates the game's sprite art: original GBA-style pixel art, drawn from
code so it can be tweaked and regenerated rather than hand-edited.

    python3 tools/make_sprites.py          # write all art
    python3 tools/make_sprites.py --clean  # remove it (back to rectangles)

Requires Pillow. Everything here is original work for SMT -- no third-party
assets, so there is nothing to attribute and nothing to take down.
"""
import os
import shutil
import sys

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'public', 'assets'))
SUBDIRS = ('characters', 'mons', 'tiles')

OUTLINE = (34, 30, 52, 255)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def add_outline(Image, img, color=(28, 24, 42, 255)):
    """
    Wraps every opaque shape in a 1px dark border, the way GBA sprites are
    drawn -- without it, characters dissolve into the light gym floor.

    Safe to run across a whole sheet: each 16x32 frame has transparent padding
    at its edges, so the outline cannot bleed into the neighbouring frame.
    """
    src = img.load()
    out = img.copy()
    dst = out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if src[x, y][3] != 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] != 0:
                    dst[x, y] = color
                    break
    return out


def bottom_align(Image, img):
    """
    Pushes the drawn content to the bottom of its frame. Battle sprites are
    bottom-aligned onto the platform, so any empty rows under the feet show up
    in-game as the creature hovering.
    """
    box = img.getbbox()
    if box is None:
        return img
    gap = img.height - box[3]
    if gap == 0:
        return img
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img.crop(box), (box[0], box[1] + gap))
    return out


def shade(c, f):
    """Darken (f<1) or lighten (f>1) a colour, clamped."""
    return tuple(max(0, min(255, int(v * f))) for v in c[:3])


# --------------------------------------------------------------------------
# Characters: 16x32 frames, 3 columns (idle, step A, step B) x 4 rows
# (down, up, left, right). The body occupies the lower 28px; the head
# overhangs the tile above, the way GBA overworld sprites do.
# --------------------------------------------------------------------------

CHARACTERS = {
    #            skin             hair            shirt            pants
    'player':    ((252, 216, 176), (196, 96, 48), (226, 78, 62), (62, 74, 122)),
    'professor': ((250, 214, 178), (226, 226, 236), (238, 240, 246), (120, 124, 150)),
    'greeter':   ((238, 194, 152), (58, 44, 38), (206, 86, 64), (74, 66, 92)),
    'scale':     ((226, 178, 138), (70, 52, 44), (74, 127, 193), (58, 62, 96)),
    'build':     ((250, 214, 178), (128, 82, 40), (63, 158, 106), (58, 62, 96)),
    'warstory':  ((214, 162, 122), (42, 38, 52), (138, 94, 168), (62, 58, 84)),
    'wacky':     ((252, 216, 176), (86, 62, 120), (212, 160, 42), (70, 66, 96)),
    'hint':      ((232, 186, 146), (96, 106, 128), (95, 125, 149), (58, 62, 96)),
    'leader':    ((216, 164, 124), (36, 32, 44), (184, 51, 106), (46, 48, 74)),
}


def draw_character(d, ox, oy, pal, direction, step):
    """
    One 16x24 frame at (ox, oy). `step` is -1 for the standing pose, 0/1 for
    the two walking poses. Frame height matches the extracted rip so both
    sources work against the same manifest: a 16x16 body on the tile with an
    8px head overhang above it.
    """
    skin, hair, shirt, pants = pal
    shoe = shade(pants, 0.55)
    bob = 1 if step == 1 else 0

    def box(x0, y0, x1, y1, c):
        d.rectangle([ox + x0, oy + y0, ox + x1, oy + y1], fill=rgba(c))

    def px(x, y, c):
        d.point((ox + x, oy + y), fill=rgba(c))

    side = direction in ('left', 'right')
    hx0, hx1 = (5, 10) if side else (4, 11)

    # ---- head (rides the bob) ----
    box(hx0, 3 - bob, hx1, 10 - bob, skin)
    if direction == 'up':
        box(hx0, 2 - bob, hx1, 8 - bob, hair)
    elif side:
        box(hx0, 2 - bob, hx1, 5 - bob, hair)
        box(hx0, 2 - bob, hx0 + 1, 7 - bob, hair)
    else:
        box(hx0, 2 - bob, hx1, 4 - bob, hair)
        px(hx0, 5 - bob, hair)
        px(hx1, 5 - bob, hair)

    # ---- eyes ----
    if direction == 'down':
        px(6, 7 - bob, OUTLINE[:3])
        px(9, 7 - bob, OUTLINE[:3])
    elif direction == 'left':
        px(6, 7 - bob, OUTLINE[:3])
    elif direction == 'right':
        px(9, 7 - bob, OUTLINE[:3])

    # ---- torso ----
    bx0, bx1 = (5, 10) if side else (4, 11)
    box(bx0, 11 - bob, bx1, 17 - bob, shirt)
    box(bx0, 11 - bob, bx1, 12 - bob, shade(shirt, 1.15))

    # ---- arms swing opposite the legs ----
    if side:
        swing = 0 if step < 0 else (1 if step == 0 else -1)
        box(7, 12 - bob, 8, 16 + swing - bob, shade(shirt, 0.82))
    else:
        sw = 0 if step < 0 else (1 if step == 0 else -1)
        box(bx0 - 1, 12 - bob + sw, bx0 - 1, 16 - bob + sw, skin)
        box(bx1 + 1, 12 - bob - sw, bx1 + 1, 16 - bob - sw, skin)

    # ---- legs ----
    if side:
        if step < 0:
            box(6, 18, 8, 22, pants)
            box(6, 23, 8, 23, shoe)
        elif step == 0:
            box(8, 18, 10, 22, pants)
            box(8, 23, 10, 23, shoe)
            box(4, 18, 6, 21, shade(pants, 0.75))
            box(4, 22, 6, 22, shade(shoe, 0.9))
        else:
            box(4, 18, 6, 22, pants)
            box(4, 23, 6, 23, shoe)
            box(8, 18, 10, 21, shade(pants, 0.75))
            box(8, 22, 10, 22, shade(shoe, 0.9))
    else:
        lx0, lx1 = bx0 + 1, bx0 + 2
        rx0, rx1 = bx1 - 2, bx1 - 1
        if step < 0:
            box(lx0, 18, lx1, 22, pants)
            box(rx0, 18, rx1, 22, pants)
            box(lx0, 23, lx1, 23, shoe)
            box(rx0, 23, rx1, 23, shoe)
        else:
            planted, lifted = ((lx0, lx1), (rx0, rx1)) if step == 0 else ((rx0, rx1), (lx0, lx1))
            box(planted[0], 18, planted[1], 22, pants)
            box(planted[0], 23, planted[1], 23, shoe)
            box(lifted[0], 18, lifted[1], 20, shade(pants, 0.8))
            box(lifted[0], 21, lifted[1], 21, shade(shoe, 0.9))


def build_characters(Image, ImageDraw):
    rows = ('down', 'up', 'left', 'right')
    for name, pal in CHARACTERS.items():
        img = Image.new('RGBA', (48, 96), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for r, direction in enumerate(rows):
            for c, step in enumerate((-1, 0, 1)):
                draw_character(d, c * 16, r * 24, pal, direction, step)
        img = add_outline(Image, img)
        img.save(os.path.join(OUT, 'characters', f'{name}.png'))


# --------------------------------------------------------------------------
# Mons: 64x64 (the GBA battle-sprite size), single frame, bottom-aligned on
# the platform. Each creature is authored in a 40x40 space and scaled up on
# save, so the drawing code below stays readable.
# --------------------------------------------------------------------------

MON_AUTHOR_SIZE = 40
MON_OUTPUT_SIZE = 64

def mon_blobheart(d):
    """Red panda: rust body, white face mask, ringed tail."""
    rust, cream, dark = (198, 96, 56), (248, 238, 224), (74, 46, 38)
    d.ellipse([12, 16, 34, 38], fill=rgba(rust))                 # body
    d.ellipse([16, 28, 38, 36], fill=rgba(shade(rust, 0.8)))     # haunch
    # tail with rings
    for i, x in enumerate(range(2, 16, 4)):
        d.ellipse([x, 30 - i, x + 6, 37 - i], fill=rgba(rust if i % 2 else dark))
    d.ellipse([11, 6, 31, 26], fill=rgba(rust))                  # head
    d.ellipse([9, 4, 16, 11], fill=rgba(dark))                   # ears
    d.ellipse([26, 4, 33, 11], fill=rgba(dark))
    d.ellipse([13, 12, 22, 22], fill=rgba(cream))                # face mask
    d.ellipse([20, 12, 29, 22], fill=rgba(cream))
    d.point((17, 16), fill=rgba(dark))                           # eyes
    d.point((25, 16), fill=rgba(dark))
    d.ellipse([20, 18, 22, 20], fill=rgba(dark))                 # nose


def mon_goose(d):
    """Seagull: white body, grey wing, orange beak and feet."""
    white, grey, orange, dark = (246, 246, 250), (150, 158, 176), (232, 146, 44), (48, 46, 62)
    d.ellipse([10, 30, 20, 34], fill=rgba(orange))               # feet
    d.ellipse([22, 30, 32, 34], fill=rgba(orange))
    d.ellipse([8, 14, 34, 33], fill=rgba(white))                 # body
    d.polygon([(10, 18), (30, 22), (12, 30)], fill=rgba(grey))   # folded wing
    d.ellipse([20, 4, 34, 18], fill=rgba(white))                 # head
    d.polygon([(32, 10), (39, 12), (32, 15)], fill=rgba(orange)) # beak
    d.point((29, 10), fill=rgba(dark))                           # eye
    d.ellipse([27, 9, 30, 12], outline=rgba(dark))


def mon_francis(d):
    """Penguin: black back, white front, orange beak and feet."""
    black, white, orange = (44, 44, 62), (248, 248, 252), (236, 152, 46)
    d.ellipse([10, 34, 19, 39], fill=rgba(orange))               # feet
    d.ellipse([21, 34, 30, 39], fill=rgba(orange))
    d.ellipse([9, 10, 31, 37], fill=rgba(black))                 # body
    d.ellipse([14, 16, 26, 36], fill=rgba(white))                # belly
    d.ellipse([12, 2, 28, 18], fill=rgba(black))                 # head
    d.ellipse([16, 9, 25, 18], fill=rgba(white))                 # face
    d.polygon([(18, 12), (24, 14), (18, 16)], fill=rgba(orange)) # beak
    d.point((17, 9), fill=rgba(white))
    d.point((23, 9), fill=rgba(white))
    d.ellipse([5, 16, 11, 30], fill=rgba(shade(black, 1.3)))     # flipper


def mon_maytrix(d):
    """A matrix: violet brackets around a grid of digits."""
    violet, glow, dark = (140, 95, 176), (216, 190, 244), (52, 40, 72)
    d.rectangle([6, 6, 34, 36], fill=rgba(dark))
    d.rectangle([8, 8, 32, 34], fill=rgba(violet))
    # bracket arms
    for x0, x1 in ((4, 9), (31, 36)):
        d.rectangle([x0, 4, x1, 7], fill=rgba(glow))
        d.rectangle([x0, 35, x1, 38], fill=rgba(glow))
        d.rectangle([x0, 4, x0 + 2, 38] if x0 == 4 else [x1 - 2, 4, x1, 38], fill=rgba(glow))
    # entries
    for r in range(3):
        for c in range(3):
            on = (r + c) % 2 == 0
            x, y = 11 + c * 7, 11 + r * 8
            d.rectangle([x, y, x + 4, y + 5], fill=rgba(glow if on else shade(violet, 0.6)))


def mon_tesselation(d):
    """A tessellation: gold hexagons tiling the frame, no gaps."""
    gold, deep, edge = (232, 186, 62), (168, 122, 34), (96, 68, 20)
    d.rectangle([0, 0, 39, 39], fill=rgba(edge))
    r = 6
    for row in range(-1, 5):
        for col in range(-1, 5):
            cx = col * 11 + (6 if row % 2 else 0)
            cy = row * 9 + 4
            pts = [(cx, cy - r), (cx + r, cy - r // 2), (cx + r, cy + r // 2),
                   (cx, cy + r), (cx - r, cy + r // 2), (cx - r, cy - r // 2)]
            fill = gold if (row + col) % 2 == 0 else deep
            d.polygon(pts, fill=rgba(fill), outline=rgba(edge))


MONS = {
    'blobheart': mon_blobheart,
    'goose': mon_goose,
    'francis': mon_francis,
    'maytrix': mon_maytrix,
    'tesselation': mon_tesselation,
}


def hand_authored():
    """
    Mons with real art in art-source/mons/ are owned by tools/import_mon.py.
    Generated placeholders must never clobber them.
    """
    src = os.path.join(OUT, '..', '..', '..', 'art-source', 'mons')
    src = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'art-source', 'mons'))
    if not os.path.isdir(src):
        return set()
    return {os.path.splitext(f)[0] for f in os.listdir(src)
            if os.path.splitext(f)[1].lower() in ('.png', '.jpg', '.jpeg')}


def build_mons(Image, ImageDraw):
    skip = hand_authored()
    for name, fn in MONS.items():
        if name in skip:
            print(f'  keeping hand-authored {name} (run tools/import_mon.py to rebuild it)')
            continue
        img = Image.new('RGBA', (MON_AUTHOR_SIZE, MON_AUTHOR_SIZE), (0, 0, 0, 0))
        fn(ImageDraw.Draw(img))
        # NEAREST keeps hard pixel edges; outline after scaling so it stays 1px.
        img = img.resize((MON_OUTPUT_SIZE, MON_OUTPUT_SIZE), Image.NEAREST)
        img = add_outline(Image, img)
        img = bottom_align(Image, img)
        img.save(os.path.join(OUT, 'mons', f'{name}.png'))


# --------------------------------------------------------------------------
# Tiles: one 64x48 atlas, 16x16 cells, laid out to match TILES in
# src/world/tilemap.ts.
#   row 0: wall  floor  carpet  platform
#   row 1: desk  plant  sign    bookshelf
#   row 2: gate  entrance  panel-off  panel-on
# --------------------------------------------------------------------------

def build_tiles(Image, ImageDraw):
    img = Image.new('RGBA', (64, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def cell(col, row):
        return col * 16, row * 16

    def fill(col, row, c):
        x, y = cell(col, row)
        d.rectangle([x, y, x + 15, y + 15], fill=rgba(c))

    # --- wall: stone with a lit top edge and mortar lines ---
    fill(0, 0, (66, 68, 104))
    x, y = cell(0, 0)
    d.rectangle([x, y, x + 15, y + 4], fill=rgba((92, 95, 138)))
    for by in (6, 11):
        d.line([x, y + by, x + 15, y + by], fill=rgba((48, 50, 80)))
    d.line([x + 7, y + 6, x + 7, y + 11], fill=rgba((48, 50, 80)))

    # --- floor: warm boards with a seam ---
    fill(1, 0, (214, 198, 162))
    x, y = cell(1, 0)
    d.line([x, y + 15, x + 15, y + 15], fill=rgba((196, 178, 142)))
    for sx in (3, 11):
        d.point((x + sx, y + 5), fill=rgba((202, 186, 150)))

    # --- carpet ---
    fill(2, 0, (188, 122, 96))
    x, y = cell(2, 0)
    d.rectangle([x + 1, y + 1, x + 14, y + 14], outline=rgba((214, 152, 122)))

    # --- leader platform: violet dais ---
    fill(3, 0, (150, 128, 196))
    x, y = cell(3, 0)
    d.rectangle([x, y, x + 15, y + 2], fill=rgba((178, 158, 220)))
    d.point((x + 4, y + 8), fill=rgba((178, 158, 220)))
    d.point((x + 11, y + 12), fill=rgba((178, 158, 220)))

    # --- desk ---
    fill(0, 1, (214, 198, 162))
    x, y = cell(0, 1)
    d.rectangle([x, y + 2, x + 15, y + 13], fill=rgba((146, 102, 62)))
    d.rectangle([x, y + 2, x + 15, y + 4], fill=rgba((178, 130, 82)))
    d.line([x, y + 13, x + 15, y + 13], fill=rgba((96, 66, 40)))

    # --- plant ---
    fill(1, 1, (214, 198, 162))
    x, y = cell(1, 1)
    d.rectangle([x + 5, y + 10, x + 10, y + 15], fill=rgba((150, 96, 62)))
    d.ellipse([x + 2, y + 1, x + 13, y + 11], fill=rgba((62, 128, 74)))
    d.ellipse([x + 4, y + 3, x + 8, y + 7], fill=rgba((84, 158, 94)))

    # --- sign ---
    fill(2, 1, (214, 198, 162))
    x, y = cell(2, 1)
    d.rectangle([x + 6, y + 9, x + 9, y + 15], fill=rgba((120, 84, 50)))
    d.rectangle([x + 1, y + 2, x + 14, y + 10], fill=rgba((186, 146, 96)))
    d.rectangle([x + 1, y + 2, x + 14, y + 10], outline=rgba((120, 84, 50)))
    for ly in (5, 7):
        d.line([x + 3, y + ly, x + 12, y + ly], fill=rgba((120, 84, 50)))

    # --- bookshelf ---
    fill(3, 1, (96, 66, 40))
    x, y = cell(3, 1)
    for shelf in (1, 8):
        for i, bc in enumerate(((198, 78, 66), (86, 130, 196), (226, 184, 72), (110, 168, 110))):
            d.rectangle([x + 1 + i * 4, y + shelf, x + 3 + i * 4, y + shelf + 5], fill=rgba(bc))
        d.line([x, y + shelf + 6, x + 15, y + shelf + 6], fill=rgba((70, 48, 30)))

    # --- gate: gold bars ---
    fill(0, 2, (214, 198, 162))
    x, y = cell(0, 2)
    for bx in (2, 7, 12):
        d.rectangle([x + bx, y, x + bx + 2, y + 15], fill=rgba((214, 176, 62)))
        d.line([x + bx, y, x + bx, y + 15], fill=rgba((246, 214, 110)))
    d.rectangle([x, y + 6, x + 15, y + 8], fill=rgba((186, 150, 48)))

    # --- entrance: doormat ---
    fill(1, 2, (120, 92, 58))
    x, y = cell(1, 2)
    d.rectangle([x + 1, y + 4, x + 14, y + 13], fill=rgba((158, 124, 80))) 
    d.rectangle([x + 1, y + 4, x + 14, y + 13], outline=rgba((96, 72, 44)))

    # --- puzzle panel off ---
    fill(2, 2, (78, 76, 104))
    x, y = cell(2, 2)
    d.rectangle([x + 1, y + 1, x + 14, y + 14], fill=rgba((62, 60, 86)))
    d.rectangle([x + 4, y + 4, x + 11, y + 11], fill=rgba((52, 50, 74)))

    # --- puzzle panel on ---
    fill(3, 2, (250, 222, 130))
    x, y = cell(3, 2)
    d.rectangle([x + 1, y + 1, x + 14, y + 14], fill=rgba((255, 212, 94)))
    d.rectangle([x + 4, y + 4, x + 11, y + 11], fill=rgba((255, 246, 208)))

    img.save(os.path.join(OUT, 'tiles', 'gym.png'))


def clean():
    # Leaves art-source/ alone; those are source assets, not output.
    for sub in SUBDIRS:
        path = os.path.join(OUT, sub)
        if os.path.isdir(path):
            shutil.rmtree(path)
        os.makedirs(path, exist_ok=True)
    print('sprites removed; the game falls back to placeholder rectangles')


def build():
    from PIL import Image, ImageDraw
    for sub in SUBDIRS:
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)
    # Characters come from the rip; regenerate them only when asked, so a
    # plain run never clobbers tools/extract_overworld.py output.
    if '--characters' in sys.argv:
        build_characters(Image, ImageDraw)
    build_mons(Image, ImageDraw)
    extra = f'{len(CHARACTERS)} characters, ' if '--characters' in sys.argv else ''
    generated = len(MONS) - len(hand_authored() & set(MONS))
    print(f'wrote {extra}{generated} placeholder mons to {OUT}')


if __name__ == '__main__':
    clean() if '--clean' in sys.argv else build()
