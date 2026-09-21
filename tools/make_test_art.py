#!/usr/bin/env python3
"""
Generates labelled placeholder art so the sprite pipeline can be verified
without any real assets.

Every frame is stamped with its own coordinates: characters show D/U/L/R for
the direction row, tiles show "<row><col>" of their atlas cell. If a sprite
draws with the wrong row, column, or mirroring, you can read it off the screen.

    python3 tools/make_test_art.py          # write test art
    python3 tools/make_test_art.py --clean  # remove it again

Requires Pillow. This is a dev tool; real art replaces these files.
"""
import os
import shutil
import sys

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')

CHARACTERS = {
    'player': (255, 224, 189), 'professor': (255, 230, 200), 'greeter': (240, 200, 170),
    'scale': (230, 190, 160), 'build': (220, 180, 150), 'warstory': (250, 210, 180),
    'wacky': (235, 195, 165), 'hint': (225, 185, 155), 'leader': (245, 205, 175),
}
MONS = {
    'blobheart': (200, 90, 70), 'goose': (80, 130, 200), 'francis': (70, 160, 110),
    'maytrix': (140, 95, 170), 'tesselation': (210, 165, 50),
}
DIR_COLORS = [(220, 70, 60), (70, 140, 220), (80, 190, 120), (230, 180, 60)]
DIR_LABELS = ['D', 'U', 'L', 'R']
TILE_COLORS = [
    [(60, 62, 100), (210, 195, 160), (190, 175, 140), (170, 150, 205)],
    [(140, 105, 70), (60, 125, 75), (150, 120, 90), (110, 80, 50)],
    [(200, 165, 60), (110, 85, 60), (80, 78, 100), (255, 215, 100)],
]


def clean():
    for sub in ('characters', 'mons', 'tiles'):
        path = os.path.join(OUT, sub)
        if os.path.isdir(path):
            shutil.rmtree(path)
            os.makedirs(path, exist_ok=True)
    print('test art removed')


def build():
    from PIL import Image, ImageDraw

    for sub in ('characters', 'mons', 'tiles'):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)

    # 3 columns (idle, step A, step B) x 4 rows (down, up, left, right) of 16x32.
    for name, tint in CHARACTERS.items():
        img = Image.new('RGBA', (48, 96), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        for row in range(4):
            for col in range(3):
                x, y = col * 16, row * 24
                shade = 1.0 - col * 0.22
                body = tuple(int(c * shade) for c in DIR_COLORS[row])
                d.rectangle([x + 3, y + 6, x + 12, y + 22], fill=body + (255,))
                d.rectangle([x + 4, y + 1, x + 11, y + 7], fill=tint + (255,))
                d.text((x + 5, y + 9), DIR_LABELS[row], fill=(255, 255, 255, 255))
                # Foot marker shifts per column so the walk cycle is visible.
                d.rectangle([x + 3 + col * 3, y + 21, x + 6 + col * 3, y + 23], fill=(20, 20, 20, 255))
        img.save(os.path.join(OUT, 'characters', f'{name}.png'))

    # 4x3 atlas of 16x16 cells, each stamped with its row and column.
    img = Image.new('RGBA', (64, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r in range(3):
        for c in range(4):
            x, y = c * 16, r * 16
            d.rectangle([x, y, x + 15, y + 15], fill=TILE_COLORS[r][c] + (255,))
            d.rectangle([x, y, x + 15, y + 15], outline=(0, 0, 0, 90))
            d.text((x + 4, y + 4), f'{r}{c}', fill=(255, 255, 255, 200))
    img.save(os.path.join(OUT, 'tiles', 'gym.png'))

    for name, col in MONS.items():
        m = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
        md = ImageDraw.Draw(m)
        md.ellipse([2, 6, 37, 39], fill=col + (255,))
        md.text((6, 16), name[:5].upper(), fill=(255, 255, 255, 255))
        m.save(os.path.join(OUT, 'mons', f'{name}.png'))

    print(f'test art written to {os.path.normpath(OUT)}')


if __name__ == '__main__':
    clean() if '--clean' in sys.argv else build()
