#!/usr/bin/env python3
"""
Extracts overworld character sprites from art-source/overworld_sprites.png
into the per-character sheets the game loads.

The source sheet lives outside public/ on purpose: anything under public/ is
copied verbatim into the production build, and shipping a 189 KB sheet to
every player to use nine 16x24 sprites from it would more than double the
download.

The source sheet is a ripped GBA overworld rip laid out as a 12-column grid:
cells are 16x24 on a 17x25 pitch. Rows come in two shapes:

    12 frames  cols 0-2 down, 3-5 up, 6-8 left, 9-11 right
               (each group is idle, step A, step B)
     4 frames  cols 0-3 are down, up, left, right -- a standing NPC with no
               walk cycle. Its single frame is repeated across all three
               animation columns, which is harmless: only the player ever
               animates, and NPCs are drawn from the idle column.

Either shape is re-packed into the 3x4 sheet `characterSprite.ts` expects.

Backgrounds are keyed out by exact colour match. Per the sheet's own legend,
orange is "used" and green is "unused"; both are just background. Matching
exactly rather than with a tolerance matters -- the art is indexed with only
174 colours and several real skin and red tones sit within a few points of
the orange key.

    python3 tools/extract_overworld.py           # write character sheets
    python3 tools/extract_overworld.py --list    # dump an indexed contact sheet

Mons and tiles are not in this sheet; those stay with tools/make_sprites.py.
"""
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
SOURCE = os.path.join(ROOT, 'art-source', 'overworld_sprites.png')
OUT = os.path.join(ROOT, 'public', 'assets', 'characters')

CELL_W, CELL_H = 16, 24
PITCH_X, PITCH_Y = 17, 25
ORIGIN_X = 9
COLUMNS = 12
KEYS = {(255, 127, 39), (34, 177, 76)}

# Which source row each game character is taken from. Indices are positions in
# the Characters section, top to bottom -- run with --list to see them all.
ASSIGNMENTS = {
    'player': 0,       # red-capped protagonist
    'greeter': 12,     # pink-haired attendant, reads as a front desk
    'warstory': 27,    # white-haired old-timer
    'build': 34,       # blue overalls, reads as an engineer
    'scale': 49,       # white cap and coat, reads as an official
    'professor': 51,   # white lab coat -- Professor SymmeTREE
    'leader': 62,      # grey spiked hair, dark outfit -- Arpit
    'wacky': 73,       # big curly hair, bright dress -- the gremlin
    'hint': 22,        # purple hair -- the puzzler
    # Rivals, one per starter. Emerald's overworld sprites share a single
    # skin palette and no eyewear, so these are picked on hair and outfit --
    # swap the index if you want someone different.
    'rivalCalista': 63,  # dark bobbed hair
    'rivalRitwin': 71,   # dark hair, plain shirt
    'rivalBlake': 72,    # dark hair; glasses are added below
}

# Characters to draw glasses onto, since the rip has none.
WEARS_GLASSES = {'rivalBlake'}


def find_character_rows(im):
    """Y offset of every 24px-tall band of sprites in the Characters section."""
    px = im.load()
    w, h = im.size
    bands, start = [], None
    for y in range(h):
        hit = any(px[x, y] in KEYS for x in range(w))
        if hit and start is None:
            start = y
        elif not hit and start is not None:
            bands.append((start, y - start))
            start = None
    if start is not None:
        bands.append((start, h - start))
    # 24px bands above the "Pokemon" header are the character rows.
    return [y for y, height in bands if height == CELL_H and y < 2183]


def frame_count(im, y):
    """12 for a walking character, 4 for a standing one."""
    px = im.load()
    count = 0
    for col in range(COLUMNS):
        x = ORIGIN_X + col * PITCH_X
        keyed = sum(
            1
            for yy in range(y, y + CELL_H)
            for xx in range(x, x + CELL_W)
            if px[xx, yy] in KEYS
        )
        if keyed > 20:
            count += 1
    return count


def cell(im, col, y):
    x = ORIGIN_X + col * PITCH_X
    return im.crop((x, y, x + CELL_W, y + CELL_H))


def add_glasses(Image, sheet, frame_w, frame_h):
    """
    Draws a pair of glasses over the eyes on every facing.

    The rip has no eyewear at this size, so the frames are drawn from the
    sprite's own eye pixels: find the dark dots on each frame and bridge
    them. Up-facing frames show the back of the head and are skipped.
    """
    px = sheet.load()
    for row in range(4):
        if row == 1:  # facing away; no eyes to cover
            continue
        for col in range(3):
            ox, oy = col * frame_w, row * frame_h
            eyes = [
                (x, y)
                for y in range(6, frame_h // 2 + 4)
                for x in range(2, frame_w - 2)
                if px[ox + x, oy + y][3] == 255 and sum(px[ox + x, oy + y][:3]) < 200
                and px[ox + x, oy + y - 1][3] == 255 and sum(px[ox + x, oy + y - 1][:3]) > 330
            ]
            if not eyes:
                continue
            eye_y = min(y for _, y in eyes)
            band = [x for x, y in eyes if y == eye_y]
            lo, hi = min(band), max(band)
            ink = (40, 40, 56, 255)
            for x in range(max(1, lo - 1), min(frame_w - 1, hi + 2)):
                if px[ox + x, oy + eye_y][3]:
                    px[ox + x, oy + eye_y] = ink
            # A stem back towards the ear on each side.
            for x in (max(1, lo - 2), min(frame_w - 2, hi + 2)):
                if px[ox + x, oy + eye_y][3]:
                    px[ox + x, oy + eye_y] = ink
    return sheet


def key_out(img):
    """Replace both background keys with transparency."""
    img = img.convert('RGBA')
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            if (r, g, b) in KEYS:
                px[x, y] = (0, 0, 0, 0)
    return img


def build(Image):
    im = Image.open(SOURCE).convert('RGB')
    rows = find_character_rows(im)
    os.makedirs(OUT, exist_ok=True)
    walkers, standers = [], []

    for name, index in ASSIGNMENTS.items():
        if index >= len(rows):
            raise SystemExit(f'{name}: index {index} is past the last character ({len(rows) - 1})')
        y = rows[index]
        frames = frame_count(im, y)
        if frames not in (4, 12):
            raise SystemExit(f'{name}: row {index} has {frames} frames, expected 4 or 12')

        sheet = Image.new('RGBA', (CELL_W * 3, CELL_H * 4), (0, 0, 0, 0))
        for row in range(4):
            for col in range(3):
                # 4-frame rows have one cell per direction; reuse it for every
                # animation column rather than reading past into page background.
                source = row if frames == 4 else row * 3 + col
                frame = key_out(cell(im, source, y))
                sheet.paste(frame, (col * CELL_W, row * CELL_H), frame)
        if name in WEARS_GLASSES:
            sheet = add_glasses(Image, sheet, CELL_W, CELL_H)
        sheet.save(os.path.join(OUT, f'{name}.png'))
        walkers.append(name) if frames == 12 else standers.append(name)

    print(
        f'extracted {len(ASSIGNMENTS)} characters ({CELL_W}x{CELL_H}) from {len(rows)} available\n'
        f'  animated ({len(walkers)}): {", ".join(walkers)}\n'
        f'  standing ({len(standers)}): {", ".join(standers)}'
    )


def contact_sheet(Image, ImageDraw):
    im = Image.open(SOURCE).convert('RGB')
    rows = find_character_rows(im)
    zoom, per_row = 3, 16
    cols = min(per_row, len(rows))
    height = (len(rows) + per_row - 1) // per_row
    out = Image.new('RGB', (cols * (CELL_W * zoom + 14), height * (CELL_H * zoom + 16)), (18, 18, 28))
    d = ImageDraw.Draw(out)
    for i, y in enumerate(rows):
        cx = (i % per_row) * (CELL_W * zoom + 14)
        cy = (i // per_row) * (CELL_H * zoom + 16)
        out.paste(cell(im, 0, y).resize((CELL_W * zoom, CELL_H * zoom), Image.NEAREST), (cx + 2, cy + 12))
        d.text((cx + 2, cy + 1), str(i), fill=(200, 205, 235))
    path = os.path.join(ROOT, 'character-index.png')
    out.save(path)
    print(f'wrote {path} -- {len(rows)} characters, index shown above each')


if __name__ == '__main__':
    from PIL import Image, ImageDraw
    if '--list' in sys.argv:
        contact_sheet(Image, ImageDraw)
    else:
        build(Image)
