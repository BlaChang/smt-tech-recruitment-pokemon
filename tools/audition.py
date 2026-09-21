#!/usr/bin/env python3
"""
Writes an audition page for the Emerald SFX rip and opens it.

The rip names files only by hex ID, so picking the right beep means listening
to them. This lists all of them with play buttons, highlights the ones
currently wired up in extract_audio.py, and shows the role each is assigned
to so a swap is obvious.

    python3 tools/audition.py
"""
import glob
import os
import webbrowser

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
SFX_DIR = os.path.join(ROOT, 'art-source', 'audio', 'sfx')
PAGE = os.path.join(ROOT, 'sfx-audition.html')


def build():
    from extract_audio import SFX

    assigned = {v: k for k, v in SFX.items()}
    files = sorted(glob.glob(os.path.join(SFX_DIR, '**', '*.wav'), recursive=True))
    if not files:
        raise SystemExit(f'no wavs in {SFX_DIR}')

    rows = []
    for path in files:
        name = os.path.basename(path)
        sid = name.replace('emerald_', '').replace('.wav', '')
        role = assigned.get(sid)
        rel = os.path.relpath(path, ROOT)
        tag = f'<b class="role">{role}</b>' if role else ''
        rows.append(
            f'<div class="row{" on" if role else ""}">'
            f'<code>{sid}</code>{tag}'
            f'<audio controls preload="none" src="{rel}"></audio></div>'
        )

    html = f"""<!doctype html><meta charset="utf-8"><title>SFX audition</title>
<style>
 body {{ background:#14131f; color:#e8e6df; font:13px ui-monospace,Menlo,monospace; padding:20px; }}
 h1 {{ font-size:16px; color:#ffd45e; }}
 p {{ opacity:.7; max-width:70ch; line-height:1.6; }}
 .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:6px; }}
 .row {{ display:flex; align-items:center; gap:8px; padding:5px 8px; background:#1d1c2b; border-radius:4px; }}
 .row.on {{ background:#2a2540; outline:1px solid #ffd45e; }}
 code {{ color:#8fa9ff; width:42px; }}
 .role {{ color:#ffd45e; width:62px; }}
 audio {{ height:30px; flex:1; }}
</style>
<h1>Emerald SFX audition &mdash; {len(files)} clips</h1>
<p>Highlighted rows are the ones currently wired into the game. To change one,
edit the <code>SFX</code> map at the top of <code>tools/extract_audio.py</code>
so the role points at the hex ID you prefer, then run
<code>python3 tools/extract_audio.py</code>.</p>
<div class="grid">{''.join(rows)}</div>
"""
    with open(PAGE, 'w') as f:
        f.write(html)
    print(f'wrote {PAGE} ({len(files)} clips)')
    webbrowser.open('file://' + PAGE)


if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    build()
