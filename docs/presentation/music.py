"""Synthesises the soundtrack for a showcase cut: python music.py a|b  ->  out/music-<cut>.wav
Mixes a 120 bpm chiptune-ish groove with the sound effects the film exported to out/sfx-<cut>.json.
Everything is generated here (no samples, no third-party audio), so there are no licensing questions."""
import json, os, sys, wave
import numpy as np

SR = 44100
CUT = sys.argv[1] if len(sys.argv) > 1 else 'a'
DUR = {'c': 33, 'd': 41}.get(CUT, 61)
N = SR * DUR
BEAT = 0.5
mix = np.zeros(N, dtype=np.float32)
rng = np.random.default_rng({'a': 7, 'b': 11, 'c': 23, 'd': 31}[CUT])
midi = lambda m: 440.0 * 2 ** ((m - 69) / 12)


def put(sig, t, g=1.0):
    i = int(t * SR)
    if i < 0 or i >= N:
        return
    j = min(N, i + len(sig))
    mix[i:j] += (sig[: j - i] * g).astype(np.float32)


def tt(n):
    return np.arange(n) / SR


def lp(x, k):
    return np.convolve(x, np.ones(k) / k, mode='same')


def kick(g=1.0):
    t = tt(int(0.32 * SR))
    ph = 2 * np.pi * np.cumsum(46 + 120 * np.exp(-t * 26)) / SR
    return np.sin(ph) * np.exp(-t * 8) * g


def clap():
    n = int(0.22 * SR)
    t = tt(n)
    x = rng.standard_normal(n)
    e = np.zeros(n)
    for off in (0, 0.011, 0.022):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: n - i]) * 28)
    return np.diff(lp(x, 3), prepend=0) * e * 1.6


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    return np.diff(rng.standard_normal(n), prepend=0) * np.exp(-tt(n) * (14 if open_ else 70)) * 0.5


def snare():
    n = int(0.2 * SR)
    t = tt(n)
    return (np.diff(rng.standard_normal(n), prepend=0) * 0.8 + np.sin(2 * np.pi * 190 * t) * 0.5) * np.exp(-t * 20)


def bass(m, dur=0.45):
    n = int(dur * SR)
    t = tt(n)
    f = midi(m)
    saw = 2 * ((t * f) % 1) - 1
    return lp(saw, 6) * np.minimum(t / 0.004, 1) * np.exp(-t * 3.2)


def lead(m, dur=0.22, duty=0.25):
    n = int(dur * SR)
    t = tt(n)
    w = (((t * midi(m)) % 1) < duty) * 2.0 - 1.0
    return w * np.minimum(t / 0.003, 1) * np.exp(-t * 11) * 0.5


def chord(ms, dur):
    n = int(dur * SR)
    t = tt(n)
    x = sum(np.sin(2 * np.pi * midi(m) * t) + 0.4 * np.sin(4 * np.pi * midi(m) * t) for m in ms)
    return x * np.minimum(t / 0.05, 1) * np.exp(-t * 1.6) * 0.18


def riser(dur):
    n = int(dur * SR)
    t = tt(n)
    u = t / dur
    ph = 2 * np.pi * np.cumsum(200 + 3200 * u ** 2) / SR
    return (np.sin(ph) * 0.4 + np.diff(rng.standard_normal(n), prepend=0) * 0.5 * u) * u ** 1.5


def whoosh(dur=0.5, up=True):
    n = int(dur * SR)
    t = tt(n)
    u = t / dur
    bell = np.sin(np.pi * u) ** 2
    f = 300 + 2600 * (u if up else 1 - u)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + np.diff(rng.standard_normal(n), prepend=0) * 0.6
    return x * bell


def pop(f0=700, f1=220):
    n = int(0.12 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t * 40)) / SR) * np.exp(-t * 30)


def ding():
    n = int(0.9 * SR)
    t = tt(n)
    return (np.sin(2 * np.pi * 1320 * t) + 0.5 * np.sin(2 * np.pi * 1980 * t)) * np.exp(-t * 5) * 0.6


def hit():
    n = int(1.4 * SR)
    t = tt(n)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-t * 14)) / SR) * np.exp(-t * 3.5)
    crash = np.diff(rng.standard_normal(n), prepend=0) * np.exp(-t * 2.4) * 0.5
    return boom + crash


def scratch():
    n = int(0.35 * SR)
    t = tt(n)
    f = 900 * np.exp(-t * 7) + 60
    return (2 * ((np.cumsum(f) / SR) % 1) - 1) * np.exp(-t * 6) * 0.6


def tick():
    n = int(0.03 * SR)
    return np.diff(rng.standard_normal(n), prepend=0) * np.exp(-tt(n) * 160) * 0.7


def confetti():
    h, p = hat(True) * 1.4, pop(1800, 900) * 0.4
    out = np.zeros(max(len(h), len(p)))
    out[: len(h)] += h
    out[: len(p)] += p
    return out


def ping():
    n = int(0.16 * SR)
    t = tt(n)
    return (np.sin(2 * np.pi * 1760 * t) + 0.4 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 26) * 0.5


def spawn():
    n = int(0.5 * SR)
    t = tt(n)
    f = np.where(t < 0.1, 392, np.where(t < 0.2, 523, np.where(t < 0.3, 659, 1046)))
    return ((((np.cumsum(f) / SR) % 1) < 0.5) * 2.0 - 1.0) * np.exp(-t * 6) * 0.35


def zap():
    n = int(0.45 * SR)
    t = tt(n)
    u = t / 0.45
    return np.sin(2 * np.pi * np.cumsum(300 + 1700 * u ** 2) / SR) * np.sin(np.pi * u) * 0.4


def stamp():
    n = int(0.35 * SR)
    t = tt(n)
    return (np.sin(2 * np.pi * np.cumsum(90 + 140 * np.exp(-t * 30)) / SR) * np.exp(-t * 12) + np.diff(rng.standard_normal(n), prepend=0) * np.exp(-t * 60) * 0.5) * 0.9


SFX = {'ping': ping, 'spawn': spawn, 'zap': zap, 'stamp': stamp, 'whoosh': lambda: whoosh(0.5), 'whoosh2': lambda: whoosh(0.4, False), 'pop': pop, 'ding': ding, 'hit': hit,
       'scratch': scratch, 'tick': tick, 'confetti': confetti, 'click': lambda: pop(1400, 900) * 0.6}


def groove(t0, t1, root, prog, swing=0.0, arp=True, kick_on=True, notes=(0, 7, 12, 15, 12, 7, 3, 7)):
    """Drums + bass + arp between t0 and t1 (seconds). prog = chord roots (midi) per 2 beats."""
    t = t0
    step = 0
    while t < t1 - 1e-6:
        b = step * 0.25
        beat = int(b)
        pos = b - beat
        sw = swing * 0.25 * 0.5 if (step % 2 == 1) else 0
        tm = t + sw
        if pos == 0 and kick_on:
            put(kick(), tm, 0.9)
        if pos == 0 and beat % 2 == 1:
            put(clap(), tm, 0.6)
        if step % 4 == 2 or (pos != 0 and step % 2 == 0 and False):
            put(hat(True), tm, 0.35)
        elif step % 2 == 1:
            put(hat(), tm, 0.28)
        i2 = int(b / 2) % len(prog)
        if step % 4 in (0, 3) or (CUT == 'b' and step % 8 == 5):
            put(bass(prog[i2] + (12 if step % 8 == 3 else 0)), tm, 0.55)
        if arp:
            put(lead(prog[i2] + 24 + notes[step % 8]), tm, 0.22)
        step += 1
        t = t0 + step * 0.125 if False else t0 + step * 0.25 * BEAT * 2 / 2
    return


def compose_a():
    # 0 - 7.5s hectic build: snare roll accelerates, riser climbs
    put(riser(7.5), 0, 0.8)
    t = 0.0
    while t < 7.5:
        gap = max(0.07, 0.5 * (1 - t / 7.5) ** 1.2)
        put(snare(), t, 0.5 + 0.4 * t / 7.5)
        if t < 5:
            put(kick(), t, 0.7)
        t += gap
    for i in range(30):
        put(hat(), i * 0.25, 0.3)
    put(scratch(), 7.5, 0.9)
    put(riser(1.0), 8.0, 0.35)
    put(hit(), 9.0, 1.0)
    groove(9.0, 55.0, 45, [45, 45, 48, 52, 41, 41, 43, 43], arp=True)
    put(hit(), 55.0, 0.9)
    put(chord([57, 60, 64, 69], 4.5), 55.0, 1.0)
    put(ding(), 56.0, 0.8)


def compose_b():
    put(riser(3.5), 0, 0.7)
    for i in range(14):
        put(snare(), 0.5 * (i / 2) + 0, 0.4 + 0.05 * i)
    put(hit(), 3.5, 1.0)
    groove(3.5, 53.5, 48, [48, 48, 51, 55, 44, 44, 46, 46], swing=0.35, arp=True)
    put(hit(), 53.5, 0.9)
    put(chord([60, 63, 67, 72], 6.0), 53.5, 1.0)
    put(ding(), 55.0, 0.8)


def compose_c():
    # 0 - 3 s pain: low drone + accelerating heartbeat and clock ticks, riser into the drop, no kick yet
    n = int(3.0 * SR)
    t = tt(n)
    drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 58 * t)) * np.minimum(t / 1.0, 1) * 0.22
    put(drone * np.minimum((3.0 - t) / 0.08, 1), 0, 1.0)
    tk = 0.0
    while tk < 2.9:
        put(tick(), tk, 0.35 + 0.35 * tk / 3)
        tk += max(0.12, 0.5 * (1 - tk / 3.2))
    for hb in (0.2, 0.9, 1.5, 2.0, 2.4, 2.7):
        put(kick(), hb, 0.35)
    put(riser(1.75), 1.2, 0.7)
    # 3 s drop: boom, then 4-on-the-floor with bass + arp; fills lead into each section change
    put(hit(), 3.0, 1.0)
    groove(3.0, 30.0, 45, [45, 45, 48, 52, 41, 41, 43, 43], arp=True)
    for fill in (5.5, 17.0, 21.0, 25.0):
        for i in range(8):
            put(snare(), fill + 0.5 + i * 0.0625 * 2, 0.25 + 0.05 * i)
    for tr in (5.5, 17.0, 21.0, 25.0):
        put(riser(1.0), tr, 0.28)
    put(hit(), 30.0, 0.9)
    put(chord([57, 60, 64, 69], 3.0), 30.0, 1.0)
    put(ding(), 30.9, 0.7)


def compose_d():
    # 0 - 3 s hook: drone + accelerating ticks and heartbeat, riser into the drop (no kick yet)
    n = int(3.0 * SR)
    t = tt(n)
    drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 58 * t)) * np.minimum(t / 1.0, 1) * 0.22
    put(drone * np.minimum((3.0 - t) / 0.08, 1), 0, 1.0)
    tk = 0.0
    while tk < 2.9:
        put(tick(), tk, 0.35 + 0.35 * tk / 3)
        tk += max(0.12, 0.5 * (1 - tk / 3.2))
    for hb in (0.2, 0.9, 1.5, 2.0, 2.4, 2.7):
        put(kick(), hb, 0.35)
    put(riser(1.75), 1.2, 0.7)
    # 3 s drop: brighter, major-key groove (4-on-the-floor, bass, arp); a snare fill + riser before each section change
    put(hit(), 3.0, 1.0)
    groove(3.0, 39.0, 48, [48, 48, 55, 52, 53, 53, 55, 55], arp=True, notes=(0, 7, 12, 16, 12, 7, 4, 7))
    for fill in (7.0, 13.0, 25.0, 34.0):
        for i in range(8):
            put(snare(), fill + 0.5 + i * 0.0625 * 2, 0.25 + 0.05 * i)
        put(riser(1.0), fill, 0.28)
    put(hit(), 35.0, 0.9)
    put(chord([60, 64, 67, 72], 4.0), 35.0, 1.0)
    put(ding(), 36.2, 0.6)


{'a': compose_a, 'b': compose_b, 'c': compose_c, 'd': compose_d}[CUT]()
sfx_path = os.path.join(os.path.dirname(__file__), 'out', f'sfx-{CUT}.json')
if os.path.exists(sfx_path):
    for t, name in json.load(open(sfx_path)):
        if name in SFX:
            put(SFX[name](), t, 0.55)

peak = np.percentile(np.abs(mix), 99.9) or 1.0  # level on the loud-but-not-extreme part, then soft-clip the stray peaks
mix = np.tanh(mix / peak * 0.8) * 0.85
pcm = (mix * 32767).astype('<i2')
out = os.path.join(os.path.dirname(__file__), 'out', f'music-{CUT}.wav')
os.makedirs(os.path.dirname(out), exist_ok=True)
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(np.repeat(pcm[:, None], 2, axis=1).tobytes())
print('wrote', out)
