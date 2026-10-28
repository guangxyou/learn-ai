# 配音校对：用 Whisper 把每句 TTS 转回文字，和讲稿逐字比。
# 同音字（它/他）不算错；讲稿里是多音字、而转写出了别的字，就标出来（「一行」读成 xíng 会被转成「一型」）。
# 用法：python asr_check.py jobs.json out.json   （out.json 里已有、且音频没变的句子直接沿用上次的转写）
import os
import difflib
import json
import re
import sys

import cn2an
import mlx_whisper
from pypinyin import lazy_pinyin, pinyin

jobs = json.load(open(sys.argv[1]))
cache = {}
if os.path.exists(sys.argv[2]):
    cache = {(r["wav"], r.get("size")): r["heard"] for r in json.load(open(sys.argv[2])) if "wav" in r}
CJK = re.compile(r"[一-鿿]")


def norm(s):
    # 数字两边统一成中文读法，「224」和「二百二十四」算一样
    s = s.replace("×", "乘").replace(" ", "")
    s = re.sub(r"(?<=[A-Za-z])-(?=\d)", "", s)  # GPT-2 这类型号里的连字符不是负号
    try:
        s = cn2an.transform(s, "an2cn")
    except Exception:
        pass
    return s.replace("两", "二")


def cjk(s):
    return [c for c in norm(s) if CJK.match(c)]


def latin(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def polyphone(c):
    return len({p for p in pinyin(c, heteronym=True, style=0)[0]}) > 1


report = []
for j in jobs:
    size = os.path.getsize(j["wav"])
    heard = cache.get((j["wav"], size))
    if heard is None:
        r = mlx_whisper.transcribe(j["wav"], path_or_hf_repo="mlx-community/whisper-large-v3-turbo", language="zh",
                                   initial_prompt="以下是普通话的科普讲解。")
        heard = r["text"].strip()
    a, b = cjk(j["say"]), cjk(heard)
    issues = []
    for op, i1, i2, k1, k2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == "equal":
            continue
        sa, sb = "".join(a[i1:i2]), "".join(b[k1:k2])
        if op == "replace" and len(sa) == len(sb):
            bad = [(x, y) for x, y in zip(sa, sb) if lazy_pinyin(x) != lazy_pinyin(y) or polyphone(x)]
            if not bad:
                continue
        issues.append({"op": op, "script": sa, "heard": sb})
    lat = difflib.SequenceMatcher(None, latin(re.sub(CJK, "", norm(j["say"]))), latin(re.sub(CJK, "", norm(heard)))).ratio()
    report.append({**{k: j[k] for k in ("scene", "line", "say", "wav")}, "size": size, "heard": heard, "issues": issues, "latin_ratio": round(lat, 2)})
    flag = issues or lat < 0.5
    print(("!! " if flag else "ok ") + f"{j['scene']}.{j['line']}  {heard}" + (f"   <- {issues}" if issues else "") + (f"  latin={lat:.2f}" if lat < 0.5 else ""), flush=True)

json.dump(report, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
n = sum(1 for r in report if r["issues"] or r["latin_ratio"] < 0.5)
print(f"asr check: {n} / {len(report)} lines need a listen")
