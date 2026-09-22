#!/usr/bin/env python3
"""
Prepares the game's audio from art-source/audio/.

Sound effects come from the Emerald SFX rip, whose files are named only by
their hex ID. The mapping below is a best guess at which ID is which effect:
run `python3 tools/audition.py` to open a page that plays all 262 and shows
the current assignment, then correct any line here and re-run.

Music is whatever sits in art-source/audio/music/ -- see the note in
ASSETS.md about why the .minigsf soundtrack cannot be used directly.

    python3 tools/extract_audio.py

Clips are downmixed to mono, halved to 22.05kHz, trimmed of silence and
peak-normalised using only the standard library. If ffmpeg is present they
are then encoded to mp3, which is about eight times smaller; if it is not,
the trimmed wav is used as-is. Either way the pipeline works, so a broken
ffmpeg degrades the build size rather than breaking it.

A manifest is written to src/content/audioManifest.json so the game loads
whichever format was produced instead of guessing.
"""
import array
import glob
import json
import os
import shutil
import subprocess
import sys
import wave

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
SFX_DIR = os.path.join(ROOT, 'art-source', 'audio', 'sfx')
MUSIC_DIR = os.path.join(ROOT, 'art-source', 'soundtrack')
OUT = os.path.join(ROOT, 'public', 'assets', 'audio')
MANIFEST = os.path.join(ROOT, 'src', 'content', 'audioManifest.json')

# role -> either a hex id from the rip (becomes emerald_<id>.wav) or a literal
# filename in art-source/audio/sfx/. Hex ids are a best guess at which clip is
# which; confirm with tools/audition.py.
SFX = {
    'select':  '0005',   # confirming a menu choice
    'cursor':  '0006',   # moving the cursor
    'text':    'pokemon_a_button.mp3',  # pressing A for the next page
    'bump':    '0007',   # walking into a wall
    'miss':    '0007',   # a move missing (same clip as the wall bump)
    'door':    '0047',   # stepping through a doorway
    'panel':   '002A',   # a light panel toggling
    'crate':   '0016',   # shoving a crate
    'gate':    '0023',   # a gate swinging round
    'solved':  '000E',   # a puzzle completing
    'hit':     '0014',   # a move connecting in battle
    'heal':    '00EF',   # a healing move restoring HP
    'debuff':  '00F5',   # a move lowering an opponent's stat
    'lowHp':   '005A',   # the warning beep while your mon is in the red
    'badge':   '0032',   # beating Arpit
}

SFX_BITRATE = '48k'
MUSIC_BITRATE = '96k'

# Music tracks, keyed by where they play. Sources are matched on a substring
# of the filename so the rip's track numbering can change without breaking.
MUSIC = {
    'menu':   'departure',   # title, professor's lab, name entry, starter pick
    'gym':    'littleroot',  # every room of the gym
    'rival':  'rival',       # Calista, Ritwin or Blake
    'battle': 'semifinal',   # Arpit, and the default for any other fight
}

# 44100 -> 22050 is an exact 2:1 decimation, so no resampling filter is needed.
TARGET_RATE = 22050
SILENCE = 0.01      # amplitude below which a sample counts as silence

# Roles to shorten, in seconds of audio kept after the leading silence is
# trimmed. Used to cut a reverb tail off a clip that was recorded wet.
MAX_LENGTH = {
    'text': 0.12,   # the A-button click, without its echo
}
# Faded out over this long so the cut does not land as a click of its own.
FADE_OUT = 0.02
HEADROOM = 0.89     # peak-normalise to just under full scale


def load_mono(path):
    """Reads a WAV as a list of floats in [-1, 1], downmixing to mono."""
    with wave.open(path) as w:
        channels, width, rate, frames = (
            w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        )
        raw = w.readframes(frames)

    if width != 2:
        raise SystemExit(f'{os.path.basename(path)}: expected 16-bit PCM, got {width * 8}-bit')

    samples = array.array('h')
    samples.frombytes(raw)
    if sys.byteorder == 'big':
        samples.byteswap()

    if channels == 2:
        samples = [(samples[i] + samples[i + 1]) / 2 for i in range(0, len(samples) - 1, 2)]
    return [s / 32768 for s in samples], rate


def resample_half(samples):
    """Averages sample pairs: exact for a 2:1 rate change."""
    return [(samples[i] + samples[i + 1]) / 2 for i in range(0, len(samples) - 1, 2)]


def trim(samples):
    """Drops leading and trailing silence, which is most of some clips."""
    start = 0
    while start < len(samples) and abs(samples[start]) < SILENCE:
        start += 1
    end = len(samples)
    while end > start and abs(samples[end - 1]) < SILENCE:
        end -= 1
    return samples[start:end]


def normalise(samples):
    peak = max((abs(s) for s in samples), default=0)
    if peak < 1e-6:
        return samples
    gain = HEADROOM / peak
    return [s * gain for s in samples]


def write_wav(path, samples, rate):
    out = array.array('h', (int(max(-1.0, min(1.0, s)) * 32767) for s in samples))
    if sys.byteorder == 'big':
        out.byteswap()
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(out.tobytes())


def ffmpeg_path():
    return shutil.which('ffmpeg')


def encode_mp3(src, dst, bitrate, mono):
    cmd = [ffmpeg_path(), '-y', '-loglevel', 'error', '-i', src]
    if mono:
        cmd += ['-ac', '1']
    cmd += ['-c:a', 'libmp3lame', '-b:a', bitrate, dst]
    subprocess.run(cmd, check=True)


def source_path(value):
    """A bare hex id refers to the rip; anything with an extension is literal."""
    name = value if '.' in value else f'emerald_{value}.wav'
    return os.path.join(SFX_DIR, name)


def as_wav(src, scratch):
    """
    Decodes a non-wav source so the trimming pipeline can read it.

    The conditioning below is all `wave`-module work, which only understands
    PCM wav, so anything else is decoded first.
    """
    if src.lower().endswith('.wav'):
        return src, False
    if not ffmpeg_path():
        raise SystemExit(f'{os.path.basename(src)} needs ffmpeg to decode; brew install ffmpeg')
    subprocess.run(
        [ffmpeg_path(), '-y', '-loglevel', 'error', '-i', src, '-c:a', 'pcm_s16le', scratch],
        check=True,
    )
    return scratch, True


def cut(samples, rate, seconds):
    """Shortens to `seconds`, fading the tail so the edit is inaudible."""
    keep = int(seconds * rate)
    if keep >= len(samples):
        return samples
    samples = samples[:keep]
    fade = min(int(FADE_OUT * rate), len(samples))
    for i in range(fade):
        samples[len(samples) - fade + i] *= 1 - (i + 1) / fade
    return samples


def convert_sfx(src, dst, role=None):
    samples, rate = load_mono(src)
    while rate > TARGET_RATE and rate % 2 == 0:
        samples = resample_half(samples)
        rate //= 2
    samples = trim(samples)
    limit = MAX_LENGTH.get(role)
    if limit:
        samples = cut(samples, rate, limit)
    samples = normalise(samples)
    write_wav(dst, samples, rate)
    return len(samples) / rate


def build():
    os.makedirs(OUT, exist_ok=True)
    for stale in glob.glob(os.path.join(OUT, '*')):
        os.remove(stale)

    ffmpeg = ffmpeg_path()
    if not ffmpeg:
        print('  ffmpeg not found; writing wav (larger, but works)')
    missing = []
    manifest = {}

    for role, value in SFX.items():
        src = source_path(value)
        if not os.path.exists(src):
            missing.append(f'{role} ({os.path.basename(src)})')
            continue

        scratch = os.path.join(OUT, f'_{role}_decoded.wav')
        decoded, temporary = as_wav(src, scratch)

        trimmed = os.path.join(OUT, f'{role}.wav')
        seconds = convert_sfx(decoded, trimmed, role)
        if temporary:
            os.remove(decoded)

        if ffmpeg:
            final = os.path.join(OUT, f'{role}.mp3')
            encode_mp3(trimmed, final, SFX_BITRATE, mono=True)
            os.remove(trimmed)
        else:
            final = trimmed

        manifest[role] = os.path.basename(final)
        print(f'  sfx {role:8s} <- {os.path.basename(src):24s} {seconds:.2f}s  '
              f'{os.path.getsize(final)/1024:.1f} KB')

    if missing:
        print(f'  missing sources: {", ".join(missing)}')

    # Music, one track per scene.
    sources = []
    if os.path.isdir(MUSIC_DIR):
        sources = [
            f for f in sorted(os.listdir(MUSIC_DIR))
            if f.lower().endswith(('.mp3', '.ogg', '.wav', '.m4a', '.flac'))
        ]

    music_manifest = {}
    for role, needle in MUSIC.items():
        match = next((f for f in sources if needle in f.lower().replace(' ', '')
                      or needle in f.lower()), None)
        if not match:
            print(f'  no track matching "{needle}" for {role}')
            continue

        src = os.path.join(MUSIC_DIR, match)
        if ffmpeg:
            dst = os.path.join(OUT, f'bgm-{role}.mp3')
            encode_mp3(src, dst, MUSIC_BITRATE, mono=False)
        else:
            # Without an encoder the file is copied through untouched.
            ext = os.path.splitext(match)[1].lower()
            dst = os.path.join(OUT, f'bgm-{role}{ext}')
            shutil.copyfile(src, dst)

        music_manifest[role] = os.path.basename(dst)
        before = os.path.getsize(src) / 1024
        after = os.path.getsize(dst) / 1024
        print(f'  bgm {role:7s} <- {match[:38]:38s} {before:6.0f} -> {after:5.0f} KB')

    if music_manifest:
        manifest['music'] = music_manifest
    else:
        print(f'  no music found in {MUSIC_DIR}; the game runs silent until one is added')

    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
        f.write('\n')

    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'-> {OUT}  ({total/1024:.0f} KB total)')
    print(f'-> {MANIFEST}')


if __name__ == '__main__':
    build()
