#!/usr/bin/env python3
"""
Turns a photo or drawing into a character portrait for the intro screen.

Sources live in art-source/ and are never modified. Each is trimmed to its
content, scaled to fit the portrait box and written to public/assets/ui/.

    python3 tools/import_portrait.py

Photos are downscaled a long way, so they are sharpened slightly afterwards;
without it a face turns to mush at this size. The alpha channel is scaled
alongside and re-hardened so the cutout keeps a clean edge instead of a halo
of semi-transparent pixels.
"""
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'ui')

# slot -> (source file relative to art-source/, longest edge in pixels)
PORTRAITS = {
    # 60 is the tallest that clears the starter line-up standing on the
    # lab floor (y 58) without being clipped by the top of the screen.
    'portraitProfessor': ('justin.png', 60),
    # Trainers, shown on the field before they send anything out. The foe's
    # feet line is only 64px down the screen, so anything taller than this
    # has its head cut off by the top edge -- see TRAINER_BOTTOM.
    'trainerCalista': ('calista.png', 58),
    'trainerRitwin': ('ritwin.png', 58),
    'trainerBlake': ('blake.png', 58),
    'trainerArpit': ('arpit.png', 58),
}

# Alpha below this is treated as background, which keeps the cutout crisp.
ALPHA_CUTOFF = 110


def convert(Image, ImageEnhance, src_path, size):
    src = Image.open(src_path).convert('RGBA')
    box = src.getbbox()
    if box is None:
        raise SystemExit(f'{src_path} is fully transparent')
    src = src.crop(box)

    scale = min(size / src.width, size / src.height)
    target = (max(1, round(src.width * scale)), max(1, round(src.height * scale)))

    small = src.resize(target, Image.LANCZOS)
    # Sharpen colour only; sharpening alpha would fray the cutout edge.
    rgb = ImageEnhance.Sharpness(small.convert('RGB')).enhance(1.6)
    alpha = small.getchannel('A').point(lambda v: 255 if v >= ALPHA_CUTOFF else 0)
    out = Image.merge('RGBA', (*rgb.split(), alpha))

    # Drop any row or column left fully transparent by the hardening.
    box = out.getbbox()
    return out.crop(box) if box else out


def build():
    from PIL import Image, ImageEnhance

    os.makedirs(OUT, exist_ok=True)
    for slot, (name, size) in PORTRAITS.items():
        src_path = os.path.join(ROOT, 'art-source', name)
        if not os.path.exists(src_path):
            print(f'  {slot}: no {name} in art-source/, skipping')
            continue
        img = convert(Image, ImageEnhance, src_path, size)
        dst = os.path.join(OUT, f'{slot}.png')
        img.save(dst)
        print(f'  {slot:20s} <- {name}  {img.width}x{img.height}  '
              f'{os.path.getsize(dst) / 1024:.1f} KB')
    print(f'-> {OUT}')


if __name__ == '__main__':
    build()
