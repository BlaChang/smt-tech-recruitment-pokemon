#!/usr/bin/env python3
"""
Builds the game's UI art from the Emerald UI Pack.

The pack targets Pokemon Essentials, whose screen is 512x384 -- exactly twice
this game's GBA-native 240x160. Every UI graphic in it is a clean 2x upscale
(verified: each 2x2 block is a single colour), so halving is lossless rather
than a resample.

The one mismatch is width: Essentials panels are 256 wide and this screen is
240. Rather than rescale by a non-integer factor and blur the pixels, the
wide frames are nine-sliced at runtime, so their middles stretch and their
corners stay pixel-exact.

    python3 tools/extract_ui.py

Writes public/assets/ui/*.png and src/content/uiAtlas.json (sizes, nine-slice
insets, and where the HP bar sits inside each databox).
"""
import json
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'art-source', 'Emerald UI Pack 1.2', 'Graphics', 'UI', 'Battle')
OUT = os.path.join(ROOT, 'public', 'assets', 'ui')
MAPPING = os.path.join(ROOT, 'src', 'content', 'uiAtlas.json')

# name -> (source file, optional crop in 1x coordinates)
PIECES = {
    'message':    ('overlay_message', None),
    # The Essentials frame carries an opaque window backing around its red
    # border. That is invisible behind a full-width message box, but a small
    # menu drawn with it looks like it is sitting on a grey slab -- so menus
    # get a variant with the backing trimmed off.
    'panel':      ('overlay_message', (3, 4, 253, 46)),
    'fightMoves': ('overlay_fight', (0, 0, 174, 48)),
    'fightInfo':  ('overlay_fight', (178, 0, 256, 48)),
    # Cropped to drop the EXP bar: there is no levelling in this game, and an
    # always-empty EXP strip reads as a bug rather than as authenticity.
    'databoxPlayer': ('databox_normal', (0, 0, 130, 37)),
    'databoxFoe':    ('databox_normal_foe', None),
    'hpFill':     ('overlay_hp', None),
    'numbers':    ('icon_numbers', None),
}

# Nine-slice borders (left, right, top, bottom), measured from the art.
INSETS = {
    'message': (13, 13, 9, 7),
    'panel': (10, 10, 5, 5),
    'fightMoves': (7, 8, 7, 7),
    'fightInfo': (7, 7, 7, 7),
}

# Where the HP fill goes inside each databox: x, y, width, height.
HP_RECTS = {
    'databoxPlayer': (68, 19, 48, 2),
    'databoxFoe': (59, 19, 48, 2),
}

# icon_numbers is "0123456789/" in one strip.
GLYPHS = '0123456789/'


def half(Image, name):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    if im.width % 2 or im.height % 2:
        raise SystemExit(f'{name}: odd dimensions, cannot halve losslessly')
    px = im.load()
    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            c = px[x, y]
            if px[x + 1, y] != c or px[x, y + 1] != c or px[x + 1, y + 1] != c:
                raise SystemExit(f'{name}: not a clean 2x upscale; halving would lose detail')
    return im.resize((im.width // 2, im.height // 2), Image.NEAREST)


def build():
    from PIL import Image

    os.makedirs(OUT, exist_ok=True)
    meta = {}

    for key, (source, crop) in PIECES.items():
        img = half(Image, source)
        if crop:
            img = img.crop(crop)
        img.save(os.path.join(OUT, f'{key}.png'))

        entry = {'w': img.width, 'h': img.height}
        if key in INSETS:
            l, r, t, b = INSETS[key]
            if l + r >= img.width or t + b >= img.height:
                raise SystemExit(f'{key}: insets {INSETS[key]} do not fit {img.size}')
            entry['inset'] = [l, r, t, b]
        if key in HP_RECTS:
            entry['hp'] = list(HP_RECTS[key])
        if key == 'numbers':
            if img.width % len(GLYPHS):
                raise SystemExit(f'numbers: {img.width}px does not divide into {len(GLYPHS)} glyphs')
            entry['glyph'] = img.width // len(GLYPHS)
            entry['chars'] = GLYPHS
        meta[key] = entry

    with open(MAPPING, 'w') as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write('\n')

    for key, entry in sorted(meta.items()):
        extra = ''
        if 'inset' in entry:
            extra = f" nine-slice {entry['inset']}"
        if 'hp' in entry:
            extra = f" hp bar at {entry['hp']}"
        if 'glyph' in entry:
            extra = f" {entry['glyph']}px glyphs"
        print(f"  {key:15s} {entry['w']:3d}x{entry['h']:<3d}{extra}")
    print(f'-> {OUT}\n-> {MAPPING}')


if __name__ == '__main__':
    build()
