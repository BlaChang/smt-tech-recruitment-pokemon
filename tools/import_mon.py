#!/usr/bin/env python3
"""
Turns hand-drawn or generated mon art into a game-ready battle sprite.

Source art lives in art-source/mons/ and is never modified. This script keys
out its flat background, trims it, fits it inside the 64x64 battle frame and
bottom-aligns it, writing the result to public/assets/mons/.

    python3 tools/import_mon.py               # import every source file
    python3 tools/import_mon.py blobheart     # just one

Bottom alignment matters: the battle scene plants sprites feet-on-platform,
so empty rows under the feet show up in-game as the creature hovering.
"""
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
SRC_DIR = os.path.join(ROOT, 'art-source', 'mons')
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'mons')

FRAME = 64
# How far a pixel may sit from the sampled background colour and still count
# as background. Generated art has soft, noisy edges, so this is generous;
# it is safe as long as nothing in the creature shares the backdrop's hue.
KEY_TOLERANCE = 60
# Pixels at least this opaque count as subject when bleeding colour outward.
ALPHA_CUTOFF = 128
# After shrinking, anything fainter than this is a halo rather than art.
FRINGE_CUTOFF = 24


def background_colour(img):
    """Sampled from the corners, which a subject never occupies."""
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    return tuple(sum(c[i] for c in corners) // len(corners) for i in range(3))


def key_out(img, key):
    """Replaces the backdrop with transparency."""
    img = img.convert('RGBA')
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, _ = px[x, y]
            dist = abs(r - key[0]) + abs(g - key[1]) + abs(b - key[2])
            if dist <= KEY_TOLERANCE:
                px[x, y] = (0, 0, 0, 0)
    return img


def bleed(Image, img, rounds=3):
    """
    Pushes opaque colour outward into the transparent margin.

    Without this, downscaling samples the cleared-but-still-coloured backdrop
    and leaves a fringe of it around the sprite.
    """
    for _ in range(rounds):
        px = img.load()
        out = img.copy()
        dst = out.load()
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y][3] != 0:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < img.width and 0 <= ny < img.height and px[nx, ny][3] != 0:
                        r, g, b, _ = px[nx, ny]
                        dst[x, y] = (r, g, b, 0)  # colour only; still transparent
                        break
        img = out
    return img


def shrink(Image, img, size):
    """
    Reduces to the battle-frame size.

    LANCZOS then a light sharpen: at a 14x reduction nothing preserves the
    original pixel grid, so the goal is a clean readable silhouette rather
    than a faithful one. Alpha is deliberately left soft -- hard-thresholding
    it chews ragged holes in the outline at this scale.
    """
    from PIL import ImageEnhance

    out = img.resize(size, Image.LANCZOS)
    rgb = ImageEnhance.Sharpness(out.convert('RGB')).enhance(1.4)
    alpha = out.getchannel('A')
    out = Image.merge('RGBA', (*rgb.split(), alpha))

    # Drop all-but-invisible edge pixels, which would otherwise show as a faint
    # halo of keyed-out backdrop.
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < FRINGE_CUTOFF:
                px[x, y] = (0, 0, 0, 0)
    return out


def already_conformant(img):
    """
    True when the source is already exactly what the game wants: the right
    frame size, real transparency, and content resting on the bottom edge.

    Hand-drawn art at target size is better left alone -- keying, rescaling
    and re-hardening it can only lose pixels the artist placed deliberately.
    """
    if img.mode != 'RGBA' or img.size != (FRAME, FRAME):
        return False
    box = img.getbbox()
    return box is not None and box[3] == FRAME


def convert(Image, path, name):
    src = Image.open(path)
    original = src.size

    if already_conformant(src):
        src.save(os.path.join(OUT_DIR, f"{name}.png"))
        box = src.getbbox()
        print(
            f'{name}: already {FRAME}x{FRAME} with its feet on the bottom edge; '
            f'copied as-is ({box[2] - box[0]}x{box[3] - box[1]} of content)'
        )
        return
    img = key_out(src, background_colour(src.convert('RGB')))

    box = img.getbbox()
    if box is None:
        raise SystemExit(f'{name}: the whole image keyed out; check the background colour')

    img = bleed(Image, img)
    img = img.crop(box)

    # Fit inside the frame without distorting the drawing.
    scale = min(FRAME / img.width, FRAME / img.height)
    target = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    img = shrink(Image, img, target)

    # Re-trim: a fully-empty outer row can survive the reduction.
    box = img.getbbox() or (0, 0, img.width, img.height)
    img = img.crop(box)

    out = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    out.paste(img, ((FRAME - img.width) // 2, FRAME - img.height), img)

    os.makedirs(OUT_DIR, exist_ok=True)
    out.save(os.path.join(OUT_DIR, f'{name}.png'))
    print(
        f'{name}: {original[0]}x{original[1]} -> {img.width}x{img.height} '
        f'placed bottom-centre in {FRAME}x{FRAME}'
    )


def sources():
    if not os.path.isdir(SRC_DIR):
        return []
    found = {}
    # Prefer PNG over JPG when both exist for the same mon.
    for f in sorted(os.listdir(SRC_DIR)):
        stem, ext = os.path.splitext(f)
        if ext.lower() not in ('.png', '.jpg', '.jpeg'):
            continue
        if stem not in found or ext.lower() == '.png':
            found[stem] = os.path.join(SRC_DIR, f)
    return sorted(found.items())


if __name__ == '__main__':
    from PIL import Image

    wanted = [a for a in sys.argv[1:] if not a.startswith('-')]
    items = sources()
    if not items:
        raise SystemExit(f'no source art in {SRC_DIR}')
    if wanted:
        items = [(n, p) for n, p in items if n in wanted]
        if not items:
            raise SystemExit(f'no source art matching {wanted}')
    for name, path in items:
        convert(Image, path, name)
