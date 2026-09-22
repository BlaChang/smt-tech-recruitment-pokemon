# SMT Tech Gym

A browser RPG that recruits for the Stanford Math Tournament team. Instead of a
Google Form and a stale doc, a candidate meets Professor SymmeTREE, picks a
partner, walks a gym full of people explaining what SMT actually is, solves a
Lights Out floor, beats gym leader Arpit Ransaria, and only then gets to leave
an email. Finishing *is* the filter.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 55 tests, including a full headless playthrough
npm run build    # static dist/, deploys anywhere
```

Keyboard only by design: arrows/WASD to move, `Z`/Enter to talk, `X` to cancel.
Touch devices get a "play this on a laptop" notice rather than a broken canvas.

### Jump to any stage while developing

`?dev=intro` · `play` · `panels` · `hall` · `rival` · `arena` · `battle` · `won` · `registry`

Add `&starter=francis|goose|blobheart` to pick a starter, and `&phase=menu`
to drop straight into battle move-select.

Standing in the panel room also prints a worked Lights Out solution to the
console, refreshed after every press.

All of this is stripped from production builds.

## Where things live

| You want to change... | Edit |
| --- | --- |
| Professor SymmeTREE's opening, the starter pick | `src/content/intro.ts` |
| Every NPC line, Arpit's dialogue, signs | `src/content/dialogue.ts` |
| Who stands where | `src/content/npcs.ts` |
| Room shapes and layout (they are ASCII art) | `src/world/maps/rooms.ts` |
| Which door leads where, and what unlocks it | `WARPS` in `src/world/maps/rooms.ts` |
| Starters, Arpit's team, all stats | `src/battle/teams.ts` |
| Move names, power, effects | `src/battle/moves.ts` |
| The shield-breaker math questions | `src/battle/questions.ts` |
| Application fields | `src/app/registry.ts` |
| Hall of Fame projects and their links | `src/content/projects.ts` |
| UI panel placement and colours | `src/ui/frame.ts` |
| Text rendering and glyph substitution | `src/ui/bitmapFont.ts` |

## The gym

Five rooms in one map, joined by doorways that warp. The camera is clamped to
whichever room you are standing in, so you never see the void between them.

| Room | What happens |
| --- | --- |
| Entrance hall | NPCs, one idea about SMT each |
| Panel room | 3x3 Lights Out on floor buttons; the door north stays shut until all nine are lit |
| Hall of Fame | Six displays, one per shipped project, each able to link out |
| Rival room | Your rival, chosen by your starter; the door north stays shut until you win |
| Arena | Arpit Ransaria |

Rooms are authored as blocks of text in `src/world/maps/rooms.ts` and stamped
into one grid at load. Corners use `{}[]` for the 45-degree cuts that make
rooms octagonal; the arena is cut two tiles deep on every corner.

## Types

PW beats TD beats TECH beats PW. Professor SymmeTREE explains it in the
intro, over a diagram generated from `TYPE_BEATS` itself so the picture
cannot drift from the damage calculation.

Super-effective is 1.4x and resisted is 0.714x, gentler than the games'
2x/0.5x. Every rival is matched to counter your starter, so the multiplier
always runs against you in that fight; at 2x it decided the battle before
skill entered into it.

| Your starter | Rival | They field |
| --- | --- | --- |
| Francis (TECH) | Calista | Goose (TD) |
| Goose (TD) | Ritwin | BlobHeart (PW) |
| BlobHeart (PW) | Blake | Francis (TECH) |

Dialogue is **data, not code** — a small interpreter runs arrays of commands
(`say`, `choice`, `ifFlag`, `battle`, `askName`, `registry`), so rewriting the
pitch never means touching the engine. `{name}` interpolates the nickname.

## Collecting applications

1. Follow the setup comment at the top of `server/Code.gs`.
2. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SHEETS_ENDPOINT` — the Apps Script `/exec` URL
   - `VITE_SUBMIT_TOKEN` — must match `SUBMIT_TOKEN` in `Code.gs`

With no endpoint set, submissions log to the console, so dev never needs the
real sheet.

Two sheets get written: `applications`, and `abandoned` for people who closed
the tab without finishing. Because the gym is hard-gated, that second sheet is
the only way to see what the gate costs you.

## Difficulty is a contract, not a vibe

The gate is hard: no application without beating Arpit. So the numbers are
simulated, not guessed, and `src/__tests__/balance.test.ts` enforces them:

| How the candidate plays | Wins |
| --- | --- |
| Attacks and heals when hurt | ~99% |
| Only ever attacks | ~83% |
| Mashes random moves | ~57% |
| Attacks, but gets the math question wrong twice | ~92% |

Change a stat and those tests tell you if you broke the gate. Losing is still
possible — Arpit re-offers the battle, and nothing is lost.

## Art

Gym characters are extracted from a GBA sprite rip; mons and tiles are
original pixel art generated from code.

```bash
python3 tools/extract_overworld.py          # character sheets from the rip
python3 tools/extract_overworld.py --list   # contact sheet, to pick different ones
python3 tools/extract_tiles.py              # gym tile atlas from the tileset rip
python3 tools/extract_ui.py                 # Emerald battle UI panels
python3 tools/make_font.py                  # bake the pixel font atlas
python3 tools/extract_audio.py              # sound effects (and music, if present)
python3 tools/audition.py                   # browse all 262 SFX to pick different ones
python3 tools/extract_tiles.py --reference  # coordinate-labelled crop, to pick new tiles
python3 tools/import_mon.py                 # mon sprites from art-source/mons/
python3 tools/make_sprites.py               # placeholder mons for the rest
```

Swapping a character is one index in `ASSIGNMENTS` in `extract_overworld.py`;
swapping a tile is one coordinate in `LIFTED` in `extract_tiles.py`.

Source sheets live in `art-source/`, deliberately outside `public/` — anything
under `public/` is copied into the build, and the two rips together are 1 MB.

Every slot degrades gracefully — a missing PNG draws a placeholder rectangle
and logs to the dev console, so art can be replaced one file at a time.
Formats and licensing: `ASSETS.md`. Slots: `src/content/assetManifest.ts`.

`tools/make_test_art.py` writes coordinate-stamped debug frames (each labelled
with its direction row and atlas cell) for verifying the pipeline itself.

## Still to do

- **Sound.**
- **Verify the SMT facts.** Numbers in the copy are placeholders — search for
  `NOTE FOR SMT` in `src/content/dialogue.ts`.
