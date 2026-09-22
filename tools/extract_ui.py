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
BACKDROPS = os.path.join(ROOT, 'art-source', 'Emerald UI Pack 1.2', 'Graphics', 'Battlebacks')

# Which battleback the arena uses. Any set in Graphics/Battlebacks works:
# indoor1, indoor2, arena1..5, cave, forest, grass, sea and so on.
BATTLEBACK = 'arena1'
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

# The backdrop pieces, mapped to the slots the battle scene draws.
#   bg     the backdrop behind everything
#   base1  the far platform, under the opponent
#   base0  the near platform, under the player
BACKDROP_PARTS = {'bbBg': 'bg', 'bbBase1': 'base1', 'bbBase0': 'base0'}


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


def halve_resampled(Image, path):
    """
    Halves a backdrop.

    Unlike the UI panels these are not clean 2x upscales -- they carry real
    detail at 512px -- so they have to be resampled. BOX averages whole
    source pixels, which keeps the soft gradients smooth without the ringing
    a sharper filter would add.
    """
    im = Image.open(path).convert('RGBA')
    return im.resize((im.width // 2, im.height // 2), Image.BOX)


# Essentials marks the bottom of the near platform with a solid maroon strip
# that its own message box hides. This game's box sits higher, so it shows.
CUT_MARKER = (128, 0, 0)


def strip_cut_marker(img):
    """
    Drops the maroon cut marker from the bottom of the platform.

    Trailing transparent rows are skipped first: the marker sits above them,
    so stopping at the first empty row would find nothing.
    """
    px = img.load()

    def opaque(y):
        return [px[x, y] for x in range(img.width) if px[x, y][3] > 0]

    height = img.height
    while height > 1 and not opaque(height - 1):
        height -= 1

    while height > 1:
        row = opaque(height - 1)
        marker = sum(1 for p in row if p[0] > 100 and p[1] < 40 and p[2] < 40)
        if row and marker > len(row) * 0.6:
            height -= 1
        else:
            break

    return img.crop((0, 0, img.width, height)) if height < img.height else img


# Rows (top, bottom) each panel draws its name and type on. The Emerald
# databoxes are inset by different amounts and their corners are cut, so the
# usable width is measured on those rows rather than assumed from the frame.
TEXT_ROWS = {
    'databoxPlayer': (3, 15),
    'databoxFoe': (3, 15),
}


def text_span(img, rows):
    """
    Leftmost and rightmost opaque pixel across a band of rows.

    This is the panel's real interior where text goes. Laying text out from
    the frame's own edges instead put the player's name on top of its left
    border and ran a four-letter type straight out the right-hand side.
    """
    px = img.convert('RGBA').load()
    top, bottom = rows
    left, right = img.width, -1
    for y in range(top, min(bottom + 1, img.height)):
        for x in range(img.width):
            if px[x, y][3]:
                left = min(left, x)
                right = max(right, x)
    if right < 0:
        raise SystemExit(f'no opaque pixels on rows {rows}; check TEXT_ROWS')
    return [left, right + 1]


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
        if key in TEXT_ROWS:
            entry['textSpan'] = text_span(img, TEXT_ROWS[key])
        if key == 'numbers':
            if img.width % len(GLYPHS):
                raise SystemExit(f'numbers: {img.width}px does not divide into {len(GLYPHS)} glyphs')
            entry['glyph'] = img.width // len(GLYPHS)
            entry['chars'] = GLYPHS
        meta[key] = entry

    for slot, part in BACKDROP_PARTS.items():
        path = os.path.join(BACKDROPS, f'{BATTLEBACK}_{part}.png')
        if not os.path.exists(path):
            print(f'  {slot}: no {BATTLEBACK}_{part}.png, skipping')
            continue
        img = halve_resampled(Image, path)
        if slot == 'bbBase0':
            img = strip_cut_marker(img)
        img.save(os.path.join(OUT, f'{slot}.png'))
        box = img.getbbox()
        entry = {'w': img.width, 'h': img.height}
        if box:
            # Where the drawn platform sits inside its frame, so the battle
            # scene can line its surface up with a mon's feet.
            entry['content'] = [box[0], box[1], box[2], box[3]]
        meta[slot] = entry

    with open(MAPPING, 'w') as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write('\n')

    for key, entry in sorted(meta.items()):
        extra = ''
        if 'inset' in entry:
            extra = f" nine-slice {entry['inset']}"
        if 'hp' in entry:
            extra = f" hp bar at {entry['hp']}, text {entry.get('textSpan')}"
        if 'glyph' in entry:
            extra = f" {entry['glyph']}px glyphs"
        print(f"  {key:15s} {entry['w']:3d}x{entry['h']:<3d}{extra}")
    print(f'-> {OUT}\n-> {MAPPING}')


if __name__ == '__main__':
    build()
