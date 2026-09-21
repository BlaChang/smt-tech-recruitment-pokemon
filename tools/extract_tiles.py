#!/usr/bin/env python3
"""
Builds the gym tile atlas from public/assets/interiortilesets.png.

Most tiles are lifted straight out of the Battle Factory block (x1280..1408)
of the rip. A few shapes the rip does not contain -- the 45-degree corner
walls that give rooms their octagonal footprint, boulders and rotating gates
-- are composed here from the *same* wall and floor pixels, so they match the
ripped tiles instead of looking painted on.

    python3 tools/extract_tiles.py             build the atlas
    python3 tools/extract_tiles.py --reference  dump a coordinate-labelled
                                                crop, for picking new tiles

The source sheet lives in art-source/ rather than public/: everything under
public/ is copied verbatim into the build, and shipping an 850 KB tileset to
every player to use two dozen 16x16 tiles from it would dwarf the whole game.

Writes:
    public/assets/tiles/gym.png     the packed atlas
    src/content/tileAtlas.json      name -> [col, row], imported by tilemap.ts

The JSON is generated so the atlas layout and the TypeScript tile table can
never drift apart.
"""
import json
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
SOURCE = os.path.join(ROOT, 'art-source', 'interiortilesets.png')
ATLAS = os.path.join(ROOT, 'public', 'assets', 'tiles', 'gym.png')
MAPPING = os.path.join(ROOT, 'src', 'content', 'tileAtlas.json')

TILE = 16
COLUMNS = 8

# Straight lifts from the sheet: name -> (x, y)
LIFTED = {
    # Battle Factory walls
    'wallCap':   (1280, 224),   # lit top edge of a wall run
    'wall':      (1280, 240),   # dark navy wall face
    'wallBase':  (1280, 256),   # pale skirting where wall meets floor
    # Octagon floor, a seamless 2x2 -- the Battle Factory's signature
    'floorA':    (1360, 320),
    'floorB':    (1376, 320),
    'floorC':    (1360, 336),
    'floorD':    (1376, 336),
    # Plainer floor for rooms that should feel different
    'floorFlat': (1344, 384),
    # Fixtures
    'door':      (1344, 240),   # yellow hazard-striped doorway panel
    'pillar':    (1328, 240),
    'console':   (1280, 192),   # bank of machinery
    'shelf':     (1296, 192),
    # Puzzle buttons (blue = off, yellow = on)
    'buttonOff': (832, 768),
    'buttonOn':  (832, 752),
}

# Corner cuts: name -> which half of the tile is wall.
# Each is built from the real wall and floor pixels, not drawn fresh.
SLANTS = {
    'slantNW': lambda x, y: x + y < TILE,
    'slantNE': lambda x, y: (TILE - 1 - x) + y < TILE,
    'slantSW': lambda x, y: x + (TILE - 1 - y) < TILE,
    'slantSE': lambda x, y: (TILE - 1 - x) + (TILE - 1 - y) < TILE,
}

ORDER = [
    'wall', 'wallCap', 'wallBase', 'floorA', 'floorB', 'floorC', 'floorD', 'floorFlat',
    'door', 'pillar', 'console', 'shelf', 'buttonOff', 'buttonOn', 'slantNW', 'slantNE',
    'slantSW', 'slantSE', 'boulder', 'socket', 'socketFilled', 'gateHub', 'gateArmH', 'gateArmV',
]


def average(img, box=None):
    px = img.load()
    w, h = img.size
    tot = [0, 0, 0]
    n = 0
    for y in range(h):
        for x in range(w):
            if box and not box(x, y):
                continue
            p = px[x, y]
            for i in range(3):
                tot[i] += p[i]
            n += 1
    return tuple(v // max(1, n) for v in tot)


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c[:3])


def build():
    from PIL import Image, ImageDraw

    src = Image.open(SOURCE).convert('RGBA')
    tiles = {}

    for name, (x, y) in LIFTED.items():
        tiles[name] = src.crop((x, y, x + TILE, y + TILE))

    wall = tiles['wall']
    floor = tiles['floorA']
    wall_px, floor_px = wall.load(), floor.load()
    edge = shade(average(wall), 0.6)

    # Corner cuts, composed from the real wall and floor pixels.
    for name, is_wall in SLANTS.items():
        out = Image.new('RGBA', (TILE, TILE))
        o = out.load()
        for y in range(TILE):
            for x in range(TILE):
                o[x, y] = wall_px[x, y] if is_wall(x, y) else floor_px[x, y]
        # A darker line along the cut reads as a bevelled edge.
        d = ImageDraw.Draw(out)
        for y in range(TILE):
            for x in range(TILE):
                if not is_wall(x, y):
                    continue
                if any(
                    0 <= x + dx < TILE and 0 <= y + dy < TILE and not is_wall(x + dx, y + dy)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                ):
                    d.point((x, y), fill=(*edge, 255))
        tiles[name] = out

    metal = average(wall)
    pale = average(floor)

    # Boulder: a rounded block in the wall's own palette so it reads as part
    # of the facility rather than an outdoor rock.
    boulder = floor.copy()
    d = ImageDraw.Draw(boulder)
    d.ellipse([1, 2, 14, 15], fill=(*shade(metal, 1.5), 255), outline=(*shade(metal, 0.7), 255))
    d.ellipse([4, 5, 9, 9], fill=(*shade(metal, 2.1), 255))
    d.arc([2, 3, 13, 14], 20, 160, fill=(*shade(metal, 0.8), 255))
    tiles['boulder'] = boulder

    # Socket: the recess a boulder has to be pushed into.
    socket = floor.copy()
    d = ImageDraw.Draw(socket)
    d.ellipse([2, 3, 13, 14], fill=(*shade(pale, 0.55), 255), outline=(*shade(pale, 0.4), 255))
    d.ellipse([5, 6, 10, 11], fill=(*shade(pale, 0.42), 255))
    tiles['socket'] = socket

    filled = floor.copy()
    d = ImageDraw.Draw(filled)
    d.ellipse([2, 3, 13, 14], fill=(*shade(pale, 0.5), 255))
    d.ellipse([1, 2, 14, 15], fill=(*shade(metal, 1.35), 255), outline=(*shade(metal, 0.7), 255))
    d.ellipse([5, 6, 9, 9], fill=(*shade(metal, 1.9), 255))
    tiles['socketFilled'] = filled

    # Rotating gate: a hub with bar arms, in the facility's metal tones.
    bar = shade(metal, 1.7)
    dark = shade(metal, 0.75)

    hub = floor.copy()
    d = ImageDraw.Draw(hub)
    d.ellipse([3, 3, 12, 12], fill=(*bar, 255), outline=(*dark, 255))
    d.ellipse([6, 6, 9, 9], fill=(*dark, 255))
    tiles['gateHub'] = hub

    arm_h = floor.copy()
    d = ImageDraw.Draw(arm_h)
    d.rectangle([0, 5, 15, 10], fill=(*bar, 255))
    d.rectangle([0, 5, 15, 5], fill=(*shade(metal, 2.0), 255))
    d.rectangle([0, 10, 15, 10], fill=(*dark, 255))
    tiles['gateArmH'] = arm_h

    arm_v = floor.copy()
    d = ImageDraw.Draw(arm_v)
    d.rectangle([5, 0, 10, 15], fill=(*bar, 255))
    d.rectangle([5, 0, 5, 15], fill=(*shade(metal, 2.0), 255))
    d.rectangle([10, 0, 10, 15], fill=(*dark, 255))
    tiles['gateArmV'] = arm_v

    missing = [n for n in ORDER if n not in tiles]
    if missing:
        raise SystemExit(f'tiles missing from ORDER: {missing}')

    rows = (len(ORDER) + COLUMNS - 1) // COLUMNS
    atlas = Image.new('RGBA', (COLUMNS * TILE, rows * TILE), (0, 0, 0, 0))
    mapping = {}
    for i, name in enumerate(ORDER):
        col, row = i % COLUMNS, i // COLUMNS
        atlas.paste(tiles[name], (col * TILE, row * TILE))
        mapping[name] = [col, row]

    os.makedirs(os.path.dirname(ATLAS), exist_ok=True)
    atlas.save(ATLAS)
    with open(MAPPING, 'w') as f:
        json.dump(mapping, f, indent=2, sort_keys=True)
        f.write('\n')

    print(f'atlas {atlas.size[0]}x{atlas.size[1]} with {len(ORDER)} tiles -> {ATLAS}')
    print(f'mapping -> {MAPPING}')


def reference(x0=1152, x1=1536, y0=240, y1=660, zoom=5):
    """
    Writes a magnified crop with absolute pixel coordinates drawn on, so new
    tiles can be located by eye and pasted straight into LIFTED.
    """
    from PIL import Image, ImageDraw

    im = Image.open(SOURCE).convert('RGB')
    out = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * zoom, (y1 - y0) * zoom), Image.NEAREST)
    d = ImageDraw.Draw(out)
    for ty in range(y0, y1, TILE):
        yy = (ty - y0) * zoom
        d.line([0, yy, (x1 - x0) * zoom, yy], fill=(255, 0, 255))
        d.text((3, yy + 2), str(ty), fill=(255, 255, 0))
    for tx in range(x0, x1, TILE):
        xx = (tx - x0) * zoom
        d.line([xx, 0, xx, (y1 - y0) * zoom], fill=(255, 0, 255))
        if (tx // TILE) % 2 == 0:
            d.text((xx + 3, 3), str(tx), fill=(0, 255, 255))
    path = os.path.join(ROOT, 'tile-reference.png')
    out.save(path)
    print(f'wrote {path} -- cyan is x, yellow is y, cells are {TILE}px')


if __name__ == '__main__':
    import sys
    reference() if '--reference' in sys.argv else build()
