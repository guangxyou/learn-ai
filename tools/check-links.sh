#!/bin/sh
# 把三篇的 refnotes.json 和 resources.json 里的外链全查一遍。
#   sh tools/check-links.sh
#
# 判读：200 正常；202 是 doi.org 转到 IEEE / ACM 之后对方返回的，浏览器里能开；
# 403 是出版社挡 curl 的 UA（SIAM、MIT Press、ACM DL），DOI 本身解析成功。
# 真正要管的是 404 和 000（连不上）。
set -e
cd "$(dirname "$0")/.."
python3 - <<'PY' > /tmp/_links.txt
import json, io, os
srcs = [('resnet',   'content/resnet/refnotes.json'),
        ('resnet',   'content/resnet/resources.json'),
        ('alexnet',  'content/alexnet/refnotes.json'),
        ('alexnet',  'content/alexnet/resources.json'),
        ('transformer', 'content/attention-is-all-you-need/refnotes.json'),
        ('transformer', 'content/attention-is-all-you-need/resources.json')]
for tag, p in srcs:
    if not os.path.exists(p):
        continue
    d = json.load(io.open(p, encoding='utf-8'))
    items = d.values() if isinstance(d, dict) and 'tools' not in d else \
            [x for k in ('tools', 'videos') for x in d.get(k, [])]
    for i, v in enumerate(items):
        if not isinstance(v, dict):
            continue
        if v.get('url'):
            print(tag, i, v['url'])
        for _, u in v.get('links', []):
            print(tag, i, u)
PY
: > /tmp/_res.txt
while read -r tag num url; do
  # curl 超时/中断会退非 0，配上 set -e 会把整轮检查悄悄掐掉，所以要兜住。
  # 但不能写成 `|| echo 000` —— curl 常常先把状态码打出来再失败（PDF、DOI 跳转
  # 收完头就断），那样会拼成「200000」；真出现 404 同时又中断就是「404000」，
  # 底下按 $1=="404" 过滤就漏了。把退出码单独记一列，状态码保持三位。
  cerr=0
  code=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 20 \
    -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" "$url") || cerr=$?
  [ -n "$code" ] || code=000
  printf "%s\t%s\t%s\t%s\t%s\n" "$code" "$cerr" "$tag" "$num" "$url" >> /tmp/_res.txt
done < /tmp/_links.txt

echo "共 $(wc -l < /tmp/_res.txt | tr -d ' ') 条"
cut -f1 /tmp/_res.txt | sort | uniq -c | sort -rn
awk -F'\t' '$2!=0 {n++} END{if(n) printf "其中 %d 条是收完响应头后传输中断（正文没下全），状态码本身有效\n", n}' /tmp/_res.txt
bad=$(awk -F'\t' '$1=="404" || $1=="000" || $1=="410" || length($1)!=3' /tmp/_res.txt)
if [ -n "$bad" ]; then echo "\n打不开的："; echo "$bad"; exit 1; fi
echo "\n没有失效链接"
