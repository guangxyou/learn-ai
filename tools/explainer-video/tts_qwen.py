# 批量跑 Qwen3-TTS（mlx-audio），模型只加载一次。
# 用法：python tts_qwen.py jobs.json   jobs.json = {"model","voice","instruct","lang","jobs":[{"text","out"}]}
# 克隆模式：model 用 Base，给 ref_audio（24 kHz wav）和 ref_text，不用 voice/instruct
import json
import sys
import time

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

cfg = json.load(open(sys.argv[1]))
model = load_model(model_path=cfg["model"])
t0 = time.time()
for i, job in enumerate(cfg["jobs"]):
    kw = dict(text=job["text"], lang_code=cfg.get("lang", "chinese"), verbose=False)
    if cfg.get("ref_audio"):
        # Base 模型克隆：每句都从同一段参考音频取音色，比 CustomVoice 逐句随机更稳
        kw.update(ref_audio=cfg["ref_audio"], ref_text=cfg["ref_text"])
    else:
        kw["voice"] = job.get("voice", cfg["voice"])
        ins = job.get("instruct", cfg.get("instruct"))
        if ins:
            kw["instruct"] = ins
    if cfg.get("temperature") is not None:
        kw["temperature"] = cfg["temperature"]
    audio = np.concatenate([np.asarray(r.audio, dtype=np.float32) for r in model.generate(**kw)])
    sf.write(job["out"], audio, model.sample_rate)
    print(f"[{i + 1}/{len(cfg['jobs'])}] {len(audio) / model.sample_rate:.1f}s  {time.time() - t0:.0f}s  {job['text'][:24]}", flush=True)
