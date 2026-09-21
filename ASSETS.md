# Assets

Art comes from two places.

## Overworld characters — ripped GBA sprites

The nine characters in the gym are extracted from `art-source/overworld_sprites.png`,
a Pokémon overworld sprite rip supplied by the team.

```bash
python3 tools/extract_overworld.py          # rebuild the character sheets
python3 tools/extract_overworld.py --list   # indexed contact sheet of all 77
```

To swap any character, change one index in `ASSIGNMENTS` at the top of that
script and re-run. Current picks:

| Slot | Row | Why |
| --- | --- | --- |
| player | 0 | red-capped protagonist |
| greeter | 12 | pink-haired attendant, reads as a front desk |
| hint | 22 | purple hair — the puzzler |
| warstory | 27 | white-haired old-timer |
| build | 34 | blue overalls, reads as an engineer |
| scale | 49 | white cap and coat, reads as an official |
| professor | 51 | white lab coat — Professor SymmeTREE |
| leader | 62 | grey spiked hair, dark outfit — Arpit |
| wacky | 73 | big curly hair, bright dress — the gremlin |

Rows come in two shapes: 12 frames (a full walk cycle) or 4 (one standing
frame per direction). Both are handled. Only the player animates, so a
standing-only NPC costs nothing.

**These are Nintendo's sprites.** Putting them on a public, Stanford-affiliated
recruiting page carries a takedown risk. This was raised and the team chose to
proceed; recording it here so the decision is documented rather than
accidental. Reverting is one command — `python3 tools/make_sprites.py --characters`
writes original stand-ins in the same format.

The source sheet deliberately sits in `art-source/`, not `public/`: anything
under `public/` is copied verbatim into the build, and shipping a 189 KB sheet
to every player to use nine sprites from it more than doubled the download.

## Gym tiles — ripped, from the Battle Factory

`art-source/interiortilesets.png` is an interior tileset compilation. The gym
uses the Battle Factory block at x1280..1408: its octagonal floor, dark walls
and hazard-striped doorways. The blue and yellow floor buttons come from
(832,768) and (832,752) in the same sheet.

```bash
python3 tools/extract_tiles.py              # rebuild the atlas
python3 tools/extract_tiles.py --reference  # labelled crop, for picking new tiles
```

Four shapes the rip does not contain are composed in that script from the
*same* wall and floor pixels, so they match rather than look painted on: the
45-degree corner cuts, the crates, their sockets, and the rotating gates.

## Audio

**Sound effects** come from the Emerald SFX rip in `art-source/audio/sfx/`,
262 clips named only by hex ID.

```bash
python3 tools/audition.py        # play them all in a browser and pick
python3 tools/extract_audio.py   # build public/assets/audio/
```

The mapping from role to hex ID lives at the top of `extract_audio.py` and is
a **best guess** — the rip carries no names. `audition.py` writes a page that
plays every clip and highlights the ones currently wired in, so correcting a
pick is one line and a re-run.

Conditioning is pure standard library: downmix to mono, halve to 22.05 kHz
(an exact 2:1 decimation from 44.1 kHz, so no resampling filter is needed),
trim silence, peak-normalise. If ffmpeg is present the result is then encoded
to mp3 — 284 KB of wav becomes 41 KB — and if it is not, the trimmed wav
ships instead. A missing or broken ffmpeg costs build size, not the build.

Which format was produced is recorded in `src/content/audioManifest.json`, so
the game loads what actually exists rather than guessing at an extension.

**Music** comes from `art-source/soundtrack/`, one looping track per scene:

| Track | Plays during |
| --- | --- |
| Departure From the Hoenn Region | title, professor's lab, name entry, starter pick |
| Littleroot Town | every room of the gym |
| Semifinal Battle | the fight with Arpit |

Sources are matched on a substring of the filename (see `MUSIC` in
`extract_audio.py`), so the rip's track numbering can change without breaking
the mapping. Re-encoded to 96 kbps, which takes the three from 9.6 MB to
4.8 MB.

Tracks are **fetched lazily** — nothing downloads until a scene asks for it,
so the battle theme, much the largest file, costs a visitor nothing unless
they reach Arpit. Switching crossfades over ~300 ms rather than cutting.

> The earlier `pokemon-emerald-gba-soundtrack.zip` **could not be used.** It
> contains `.minigsf` files: 146-byte stubs that index into a shared
> `.gsflib`, describing note sequences for the GBA sound chip rather than
> containing any audio. Playing one means emulating the hardware, and nothing
> available here does that — ffmpeg 9 has no GSF decoder, and vgmstream only
> handles streamed audio. Hence the mp3s.

Audio never blocks the game: a missing file degrades to silence. `M` mutes,
and the choice is remembered.

## Font — "Pokemon Emerald" by aztecwarrior28

`art-source/fonts/pokemon-emerald.otf`, from FontStruct.
<https://fontstruct.com/fontstructions/show/1975556>

**Licensed CC BY-SA 3.0**, which requires attribution and share-alike. This is
the only asset in the project with a licence that asks something of you:
credit "Pokemon Emerald font by aztecwarrior28 (CC BY-SA 3.0)" wherever the
game is published, and keep `readme.txt` and `license.txt` beside the .otf if
the font file itself is ever redistributed.

```bash
python3 tools/make_font.py   # bake public/assets/ui/font.png + fontMetrics.json
```

All in-game text is blitted from this baked atlas rather than drawn with
canvas `fillText`, which anti-aliases and was making every label look soft.
Two details the baker handles:

- It is a FontStruct pixel font, so it only rasterises cleanly on its design
  grid. Size 15 yields zero midtone pixels; the script asserts that and
  refuses to run at a size where it would blur.
- Thirteen glyphs are absent from the font (``#*@[\]^_`{|}~``) and render as
  the .notdef box. Those are baked blank, and `bitmapFont.ts` substitutes what
  it can — em dash to hyphen, curly quotes to straight, and so on.

Because a bitmap font has one true size, requested text sizes snap to whole
multiples (the title is drawn at 2x). Anything else would resample and
reintroduce the blur the font exists to remove.

## Interface — Emerald UI Pack 1.2

`art-source/Emerald UI Pack 1.2/` supplies the battle interface: the teal
message box, the HP databoxes, the HP gradient, the digit font and the
fight panels.

```bash
python3 tools/extract_ui.py   # rebuild public/assets/ui/ + src/content/uiAtlas.json
```

The pack targets Pokemon Essentials, whose screen is 512x384 — exactly twice
this game's 240x160. Every graphic is a clean 2x upscale (the extractor
verifies each 2x2 block is one colour and refuses to proceed otherwise), so
halving is lossless rather than a resample.

The one mismatch is width: Essentials panels are 256 wide, this screen is
240. Rather than rescale by a non-integer factor and blur the pixels, the
frames are **nine-sliced** at runtime — corners stay pixel-exact, middles
stretch. Insets and the HP-bar rectangles live in `src/content/uiAtlas.json`,
generated alongside the images so they cannot drift.

Two adjustments the pack needs for this game:

- `databoxPlayer` is cropped to drop the EXP bar; there is no levelling here,
  and a permanently empty EXP strip reads as a bug.
- `panel` is `message` with its opaque window backing trimmed off. Invisible
  behind a full-width text box, but a small menu drawn with the untrimmed
  frame looks like it is sitting on a grey slab.

Every UI slot falls back to the plain frame the game used before, so a missing
file degrades rather than crashes.

**These are ripped Nintendo assets**, same caveat as the sprites above.

## Mons — original

BlobHeart, Goose, Francis, May Trix and Tess Elation are original characters
with no Pokémon equivalent, so none of them come from a rip.

**Hand-drawn art** goes in `art-source/mons/<name>.png` at any size, with a
flat background colour. One command turns it into a battle sprite:

```bash
python3 tools/import_mon.py            # import every source file
python3 tools/import_mon.py blobheart  # just one
```

It keys out the background, trims, fits the drawing inside the 64x64 frame
without distorting it, and bottom-aligns it so the creature stands on the
platform instead of hovering.

**Placeholders** for mons with no art yet are generated:

```bash
python3 tools/make_sprites.py          # placeholder mons only
python3 tools/make_sprites.py --clean  # remove; game falls back to rectangles
```

`make_sprites.py` skips any mon that has a file in `art-source/mons/`, so
regenerating placeholders can never overwrite real art.

Art already at 64x64 with real transparency and its content resting on the
bottom edge is **copied through untouched** -- rescaling and re-hardening
hand-made pixel art can only lose pixels that were placed deliberately.
Anything else (a photo, an oversized drawing) is keyed, trimmed, fitted and
bottom-aligned.

| Mon | Art |
| --- | --- |
| blobheart | photo, downscaled and keyed from `art-source/mons/blobheart.png` |
| francis | pixel art at target size, used verbatim |
| goose | pixel art at target size, used verbatim |
| maytrix, pieuler | generated placeholder |

One sprite serves both sides of the battlefield, so art drawn facing the
wrong way for a slot is mirrored at draw time rather than edited on disk.
Set `faces: 'right'` on the mon's spec in `src/battle/teams.ts` when a
drawing points right, as GOOSE does; left is the default.

## Formats

| | Files | Format |
| --- | --- | --- |
| Characters | player, professor, greeter, scale, build, warstory, wacky, hint, leader | 48x96 sheet: 16x24 frames, 3 cols (idle, step A, step B) x 4 rows (down, up, left, right) |
| Mons | blobheart, goose, francis, maytrix, tesselation | 64x64 single frame, bottom-aligned (GBA battle-sprite size) |
| Tiles | gym.png | 128x48 atlas of 16x16 cells, generated with `src/content/tileAtlas.json` |

A 16x24 character sits as a 16x16 body on the tile with an 8px head overhang.
`drawCharacter` derives that from `frameH`, so a taller sheet needs no code
change — only `frameH` in `src/content/assetManifest.ts`.
