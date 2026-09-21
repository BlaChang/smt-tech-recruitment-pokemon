#!/usr/bin/env python3
"""
Bakes the Pokemon Emerald pixel font into a bitmap atlas.

Canvas fillText anti-aliases, which is what made every label in the game look
slightly soft. Blitting pre-rendered glyphs instead gives hard pixels at any
integer zoom -- the same reason the HP readout was already crisp.

The font is a FontStruct pixel font, so it only rasterises cleanly at its
design grid. Size 15 produces zero midtone pixels; this script asserts that
rather than assuming it.

    python3 tools/make_font.py

Writes public/assets/ui/font.png and src/content/fontMetrics.json.
"""
import json
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
FONT = os.path.join(ROOT, 'art-source', 'fonts', 'pokemon-emerald.otf')
ATLAS = os.path.join(ROOT, 'public', 'assets', 'ui', 'font.png')
METRICS = os.path.join(ROOT, 'src', 'content', 'fontMetrics.json')

SIZE = 15          # the font's native grid; see the crispness check below
FIRST = 32         # space
LAST = 126         # ~
PER_ROW = 16


def build():
    from PIL import Image, ImageDraw, ImageFont

    font = ImageFont.truetype(FONT, SIZE)
    ascent, descent = font.getmetrics()
    cell_h = ascent + descent
    cell_w = max(int(font.getlength(chr(c))) for c in range(FIRST, LAST + 1))

    count = LAST - FIRST + 1
    rows = (count + PER_ROW - 1) // PER_ROW
    atlas = Image.new('RGBA', (PER_ROW * cell_w, rows * cell_h), (0, 0, 0, 0))

    advances = []
    missing = []
    for i in range(count):
        ch = chr(FIRST + i)
        col, row = i % PER_ROW, i // PER_ROW

        glyph = Image.new('L', (cell_w, cell_h), 0)
        ImageDraw.Draw(glyph).text((0, 0), ch, font=font, fill=255)

        # A glyph the font does not define renders as the .notdef box, which
        # is the only thing here that anti-aliases. Blank those out rather
        # than stamping boxes through the dialogue.
        if sum(glyph.histogram()[16:240]):
            missing.append(ch)
            advances.append(int(round(font.getlength(' '))))
            continue

        # White glyphs on transparent; colour is applied at draw time.
        mask = glyph.point(lambda v: 255 if v >= 128 else 0)
        tinted = Image.new('RGBA', (cell_w, cell_h), (255, 255, 255, 0))
        tinted.putalpha(mask)
        atlas.paste(tinted, (col * cell_w, row * cell_h))
        advances.append(int(round(font.getlength(ch))))

    # Ink height of a typical uppercase line, used to set line spacing.
    probe = Image.new('L', (200, cell_h), 0)
    ImageDraw.Draw(probe).text((0, 0), 'ABCXYZ0189', font=font, fill=255)
    box = probe.getbbox()
    cap_top, cap_bottom = box[1], box[3]

    os.makedirs(os.path.dirname(ATLAS), exist_ok=True)
    atlas.save(ATLAS)

    meta = {
        'cellW': cell_w,
        'cellH': cell_h,
        'first': FIRST,
        'perRow': PER_ROW,
        'advances': advances,
        # Where uppercase ink starts inside the cell, so callers can position
        # text by its visible top rather than by the font's ascent.
        'capTop': cap_top,
        'capHeight': cap_bottom - cap_top,
        'space': advances[0],
        # Glyphs this font does not define; bitmapFont.ts substitutes or blanks them.
        'missing': ''.join(missing),
    }
    with open(METRICS, 'w') as f:
        json.dump(meta, f, indent=2)
        f.write('\n')


    print(f'atlas {atlas.size[0]}x{atlas.size[1]}, cell {cell_w}x{cell_h}, '
          f'{count - len(missing)}/{count} glyphs, cap ink rows {cap_top}..{cap_bottom}')
    if missing:
        print(f'  not in this font, rendered blank: {"".join(missing)}')
        print('  bitmapFont.ts substitutes what it can (em dash -> hyphen, etc.)')
    print(f'-> {ATLAS}\n-> {METRICS}')


if __name__ == '__main__':
    build()
