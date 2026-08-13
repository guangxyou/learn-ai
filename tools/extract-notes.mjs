/**
 * 原始对话 → 批注候选池
 *
 *   node tools/extract-notes.mjs --raw 01_Transformer/raw --out 01_Transformer/notes-pool.json
 *
 * 227 轮 ChatGPT + Codex 的用户提问，逐条切出来、分类、把口语改成书面语，
 * 再按提问序号落到论文章节上。分类和归属都是「猜」，最终以人工审阅页的取舍为准 ——
 * 所以每条都带 auto 字段，标明哪些是脚本判的。
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/* ── 分类 ────────────────────────────────────────────────
   词义     一个词 / 词组是什么意思
   句意     这句话在说什么、整段翻译
   公式     推导、维度、算法本身
   概念     论文点名的概念（end-to-end memory、BPE、LayerNorm）
   补基础   论文没讲、但不懂就读不下去的前置（矩阵乘法、卷积、embedding）
   工程对照 现在的模型怎么做（GQA、DeepSeek 的维度、batch 多大）
   岔路     读着读着岔到别的题目（NSA、FlashAttention、GPT 的 Scaling）
   噪音     环境报错、语音转写残句、对助手的吐槽 —— 默认丢弃
   ──────────────────────────────────────────────────── */

/** 提问序号 → 论文位置。区间是照着 raw 里的实际顺序读出来的 */
const RANGES = [
  [1, 42, '预备', '读正文之前补的：算力名词、softmax、LayerNorm、BPE'],
  [43, 80, '§2–§3.1', 'Background 与编码器/解码器堆栈'],
  [81, 83, '岔路·NSA', ''],
  [84, 102, '§3.2.1', '缩放点积注意力'],
  [103, 118, '§3.2.2', '多头注意力，连带现代模型对照'],
  [119, 121, '岔路·arXiv', ''],
  [122, 139, '岔路·NSA/GQA', ''],
  [140, 151, '岔路·FlashAttention', ''],
  [152, 163, '§3.3', '逐位置前馈网络'],
  [164, 174, '§3.4–§3.5', '嵌入与位置编码'],
  [175, 190, '§4', '为什么用自注意力'],
  [191, 213, '§5–§6.2', '训练配置与结果'],
  [214, 227, '§6.3–§7', '句法分析与结论'],
];

/** 口语 → 书面语。只改问法，不改问题本身 */
const SPOKEN = [
  [/^啥意思[？?]?$/, '这个词是什么意思'],
  [/啥意思/g, '是什么意思'],
  [/(.+?)是啥[？?]?$/, '$1是什么'],
  [/为啥/g, '为什么'],
  [/咋/g, '怎么'],
  [/多少个?啊/g, '多少'],
  [/(?<![什怎多那这这么])么([？?])?$/, '吗$1'],   // 句末的「么」→「吗」，但别动「什么/怎么」
  [/^解释下?/, '解释一下'],
  [/^说下/, '说明一下'],
  [/有木有/g, '有没有'],
  [/、\s*$/, ''],
];

/** 一眼就是噪音的：环境、语音残句、对助手说的话、导出工具吐的壳 */
const NOISE = [
  /^#\s*(Response annotations|Files mentioned|Selected text)/i,
  /^Each item contains text selected/i,
  /^Traceback|^\/opt\/|^\/Users\/|^export PATH|pip3? install|brew install|\.venv|python3? --version/i,
  /^你太啰嗦|^继续$|^没了$|^OK[，,。]?$|^哦|^嗯|^好的$|^没翻译|^你为啥不画|^直接作图/,
  /^[一-龥\s]{0,6}[,，。\-]{2,}/,          // 语音转写的断续残句
  /把当前会话|导出.*(会话|对话)|整理成一个 Markdown/,
];

/** 关键词 → 类型。命中越靠前越优先 */
const RULES = [
  ['噪音', /安装|报错|Traceback|版本|路径|退出|清晰度|画图|生成图片|png|pdf 文档/i],
  ['工程对照', /deepseek|gqa|mqa|kv ?head|主流模型|现在的模型|最新一代|实际中的?大模型|batch|显存|kv ?cache|参数量|params/i],
  ['岔路', /\bnsa\b|flash ?attention|hbm|sram|gpt-?[123]|scaling|思维链|chain of thought|reasoning|test time|arxiv 平台|投稿/i],
  ['补基础', /矩阵|标量|向量|转置|维度是什么|卷积|softmax 函数|layer ?norm|embedding 的?学习|tensor|张量|梯度|loss|optimizer|adam/i],
  ['公式', /公式|推导|维度|d_?k|d_?model|dff|计算过程|怎么算|为什么除|缩放|点积|相乘|求和|复杂度/i],
  ['概念', /是指|是什么模型|谁提出|什么时候发明|有哪些|区别|关系/],
  ['句意', /翻译|这句|这段|什么意思(?!.*词)|在说什么/],
];

const args = () => {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
  return o;
};

const clean = (s) => s.replace(/\s+/g, ' ').trim();

/** 把一轮里的用户提问抠出来：可能裹着 Selected text / My request 的壳 */
function askOf(block) {
  let u = (block.split(/^### 助手$/m)[0] || '').replace(/^### 用户\s*/m, '');
  let sel = '';
  const m = /##\s*Selection \d+\s*([\s\S]*?)(?=##\s*My request|$)/.exec(u);
  if (m) { sel = clean(m[1]); u = u.slice(u.indexOf('My request') >= 0 ? u.indexOf('My request') : 0); }
  u = u.replace(/^#?\s*Selected text:\s*/m, '');
  u = u.replace(/My request for \w+:\s*/m, '');
  u = u.replace(/\[User attached \d+ image[^\]]*\]/g, '〔带图〕');
  return { q: clean(u), sel };   // 选中的原文单独放，不跟问题混在一起
}

/** 答案要留着换行 —— 列表、代码块、公式全靠它，压成一行就没法再精简了 */
function answerOf(block) {
  const a = block.split(/^### 助手$/m)[1] || '';
  return a.replace(/^\s*---\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

function polish(q) {
  let s = q;
  for (const [re, to] of SPOKEN) s = s.replace(re, to);
  s = s.replace(/^[,，。、\s]+|[,，、\s]+$/g, '');
  if (s && !/[？?。！!〕]$/.test(s) && /^(什么|为什么|怎么|哪|谁|多少|是否)|吗$|什么$/.test(s)) s += '？';
  return s;
}

function classify(q, a, place) {
  if (NOISE.some((re) => re.test(q))) return '噪音';
  if (place.startsWith('岔路')) return '岔路';
  // 提问就是一个英文词 / 短词组 —— 那是在查词
  if (/^[A-Za-z][A-Za-z\s\-']{0,28}$/.test(q) && q.split(/\s+/).length <= 4) return '词义';
  for (const [kind, re] of RULES) if (re.test(q)) return kind;          // 先只看问题
  for (const [kind, re] of RULES) if (re.test(a.slice(0, 160))) return kind;  // 问题看不出来才翻答案
  return /^[A-Za-z][A-Za-z\s,.\-']{20,}$/.test(q) ? '句意' : '概念';
}

const place = (n) => RANGES.find(([a, b]) => n >= a && n <= b) || [0, 0, '未归位', ''];

/* ── 主流程 ── */
const o = args();
const dir = o.raw || '01_Transformer/raw';
const pool = [];

const cg = `${dir}/Conversation-ChatGPT.md`;
if (existsSync(cg)) {
  const src = readFileSync(cg, 'utf8');
  const parts = src.split(/\n## 第 (\d+) 轮\n/);
  for (let i = 1; i < parts.length; i += 2) {
    const n = +parts[i], block = parts[i + 1];
    const { q: raw, sel } = askOf(block), a = answerOf(block);
    if (!raw) continue;
    const [, , sec, hint] = place(n);
    const q = polish(raw);
    pool.push({
      id: `C${String(n).padStart(3, '0')}`, src: 'ChatGPT', n, sec, hint,
      kind: classify(raw, a, sec),
      q, qRaw: raw !== q ? raw : undefined, sel: sel || undefined,
      a: a.slice(0, 2600), aLen: a.length,
      keep: null,                       // 待人工定夺
    });
  }
}

const cx = `${dir}/Conversation-Codex.md`;
if (existsSync(cx)) {
  const src = readFileSync(cx, 'utf8');
  const blocks = src.split(/\n## 用户\n/).slice(1);
  blocks.forEach((b, i) => {
    const { q: raw, sel } = askOf('### 用户\n' + b.split(/\n## 助手\n/)[0]);
    const a = (b.split(/\n## 助手\n/)[1] || '').replace(/\n{3,}/g, '\n\n').trim();
    if (!raw || raw.length < 4) return;
    const q = polish(raw);
    pool.push({
      id: `X${String(i + 1).padStart(3, '0')}`, src: 'Codex', n: i + 1, sec: '未归位', hint: '',
      kind: classify(raw, a, ''), q, qRaw: raw !== q ? raw : undefined, sel: sel || undefined,
      a: a.slice(0, 2600), aLen: a.length, keep: null,
    });
  });
}

// 已经收进阅读页的，预先标成保留
if (existsSync('01_Transformer/notes.json')) {
  const done = JSON.parse(readFileSync('01_Transformer/notes.json', 'utf8'));
  for (const d of done) {
    const hit = pool.find((p) => p.q.includes(d.q.slice(0, 8)) || d.q.includes(p.q.slice(0, 8)));
    if (hit) { hit.keep = true; hit.inPage = true; hit.anchor = d.anchor; hit.kind = d.kind; }
  }
}

const by = (k) => pool.reduce((m, x) => (m[x[k]] = (m[x[k]] || 0) + 1, m), {});
console.log(`共 ${pool.length} 条`);
console.log('按类型:', JSON.stringify(by('kind'), null, 0));
console.log('按位置:', JSON.stringify(by('sec'), null, 0));
console.log('口语已改写:', pool.filter((p) => p.qRaw).length, '条；已在阅读页:', pool.filter((p) => p.inPage).length, '条');
writeFileSync(o.out || '01_Transformer/notes-pool.json', JSON.stringify(pool, null, 1));
console.log('✓', o.out || '01_Transformer/notes-pool.json');
