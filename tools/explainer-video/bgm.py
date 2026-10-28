# 本地合成背景音乐：慢速和弦铺底 + 稀疏的琶音点缀，不用任何外部素材。
# 用法：python bgm.py <秒数> <输出.wav> [种子]
import sys

import numpy as np
import soundfile as sf

T = float(sys.argv[1])
out = sys.argv[2]
rng = np.random.default_rng(int(sys.argv[3]) if len(sys.argv) > 3 else 1)
SR = 48000
n = int(T * SR)
t = np.arange(n) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# Am - F - C - G，每个和弦 8 秒
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
BAR = 8.0
pad = np.zeros(n)
for k in range(int(np.ceil(T / BAR)) + 1):
    notes = CHORDS[k % 4]
    t0 = k * BAR - 1.5
    a, b = max(0, int(t0 * SR)), min(n, int((t0 + BAR + 3.0) * SR))
    if a >= b:
        continue
    tt = t[a:b] - t0
    env = np.clip(tt / 2.5, 0, 1) * np.clip((BAR + 3.0 - tt) / 2.5, 0, 1)
    sig = np.zeros(b - a)
    for m in notes + [notes[0] - 12]:
        f = hz(m)
        for d in (-0.0012, 0.0, 0.0012):
            sig += np.sin(2 * np.pi * f * (1 + d) * tt + rng.uniform(0, 6.28)) * (0.5 if m < notes[0] else 0.33)
    pad[a:b] += sig * env

# 琶音：每拍一个和弦音，高八度，指数衰减，随机跳过一部分
arp = np.zeros(n)
beat = 0.75
for j in range(int(T / beat)):
    if rng.random() < 0.45:
        continue
    t0 = j * beat
    notes = CHORDS[int(t0 // BAR) % 4]
    f = hz(rng.choice(notes) + 12)
    a = int(t0 * SR)
    L = min(n - a, int(2.2 * SR))
    tt = np.arange(L) / SR
    tone = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)
    arp[a:a + L] += tone * np.exp(-tt * 2.6) * np.clip(tt / 0.01, 0, 1) * rng.uniform(0.5, 1.0)


try:
    from scipy.signal import butter, sosfilt
    pad = sosfilt(butter(2, 1400, fs=SR, output='sos'), pad)
    arp = sosfilt(butter(2, 3200, fs=SR, output='sos'), arp)
except ImportError:
    pass

mix = pad * 0.55 + arp * 0.35
fade = np.clip(t / 2.5, 0, 1) * np.clip((T - t) / 3.5, 0, 1)
mix *= fade
mix /= np.max(np.abs(mix)) + 1e-9
sf.write(out, (mix * 0.5).astype(np.float32), SR)
print(f"bgm {T:.1f}s -> {out}")
