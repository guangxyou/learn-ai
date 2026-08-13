/**
 * 批注清洗：审阅页导出的 picked → 阅读页要的 notes.json
 *
 *   node tools/clean-notes.mjs --picked 01_Transformer/notes-picked.json \
 *        --paper 01_Transformer/paper-src.html --out 01_Transformer/notes.json
 *
 * 做四件事：
 *   1. 答案 Markdown → 阅读页的简单 HTML（保留公式块、列表、代码）
 *   2. 精简：砍掉复述提问的开场白、重复的结论收尾、超长推导折叠
 *   3. 定锚：问题里若含论文原句，自动在论文里找到最长匹配当 anchor
 *   4. 留底：原始答案整段写进 notes-raw.json，notes.json 里只留 id 指回去
 *
 * 原始对话一个字都不动 —— raw/ 只读，这里所有产物都是派生的。
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = () => {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
  return o;
};
const o = args();

/* ── 论文纯文本，给自动定锚用 ── */
function paperText(file) {
  if (!existsSync(file)) return '';
  let h = readFileSync(file, 'utf8');
  h = h.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, ' ').replace(/<[^>]+>/g, ' ');
  return h.replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
}
const PAPER = paperText(o.paper || '01_Transformer/paper-src.html');

/** 问题里往往直接抄了论文原句。取最长的一段能在论文里找到的英文，作为 anchor */
function autoAnchor(q, sel) {
  if (sel && PAPER.includes(sel.trim())) return sel.trim();
  const en = q.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  if (en.length < 4) return '';
  const words = en.split(' ');
  for (let len = words.length; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const cand = words.slice(i, i + len).join(' ').replace(/^[^A-Za-z]+|[^A-Za-z)]+$/g, '');
      if (cand.length >= 4 && PAPER.includes(cand)) return cand;
    }
  }
  return '';
}

/* ── Markdown → 阅读页 HTML ── */
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** 裸 LaTeX 洗成能直接读的符号。批注是旁注，不值得为它引一套公式引擎 */
const TEX = [
  [/\\(?:mathrm|text|operatorname|mathbf|mathit)\{([^{}]*)\}/g, '$1'],
  [/\\mathbb\s*\{?R\}?/g, 'ℝ'],
  [/\\sqrt\{([^{}]*)\}/g, '√$1'],
  [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2'],
  [/\\sum_\{([^{}]*)\}\^\{([^{}]*)\}/g, 'Σ($1..$2)'],
  [/\\sum/g, 'Σ'],
  [/\^\\top|\^T\b|\^\{T\}/g, 'ᵀ'],
  [/\\times/g, '×'], [/\\cdot/g, '·'], [/\\approx/g, '≈'], [/\\neq/g, '≠'],
  [/\\leq/g, '≤'], [/\\geq/g, '≥'], [/\\in\b/g, '∈'], [/\\infty/g, '∞'],
  [/\\ldots|\\dots|\\cdots/g, '…'], [/\\rightarrow|\\to\b/g, '→'], [/\\quad|\\qquad|\\,|\\;/g, ' '],
  [/\\left|\\right/g, ''],
  [/_\{([^{}]{1,12})\}/g, '_$1'],      // d_{model} → d_model
  [/\^\{([^{}]{1,6})\}/g, '^$1'],
  [/\\begin\{[a-z*]+\}|\\end\{[a-z*]+\}/g, ' '],
  [/\\\\/g, ' '],
  [/\\([a-zA-Z]+)/g, '$1'],            // 兜底：剩下的控制序列去掉反斜杠
];
const detex = (s) => TEX.reduce((x, [re, to]) => x.replace(re, to), s).replace(/[ \t]{2,}/g, ' ');

function inline(s) {
  return esc(detex(s))
    .replace(/\\\[|\\\]|\\\(|\\\)/g, '')                 // LaTeX 定界符，公式本身留着
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<span class="m">$1</span>')
    .replace(/\$([^$]+)\$/g, '<span class="m">$1</span>');
}

/** 开场白：把问题原样复述一遍再回答。这类句子删掉不损失信息 */
const PREAMBLE = [
  /^这句话?(的意思)?是[:：]?$/, /^这段话?在?说的?是[:：]?$/, /^意思是[:：]?$/,
  /^更直白地?说[:：]?$/, /^简单说[:：]?$/, /^也就是说[:：]?$/, /^关键点?[:：]$/,
  /^好的?[，,。]?$/, /^没问题[，,。]?$/, /^对[，,。]?$/,
];
/** 收尾的套话 */
const CODA = [
  /^所以可以?记成一句[:：]?$/, /^一句话概括[:：]?$/, /^一句话[:：]?$/,
  /^总结[一下]*[:：]?$/, /^希望.*帮助/, /^需要我.*吗[？?]?$/, /^要不要我.*[？?]$/,
];

const textLen = (h) => h.replace(/<[^>]+>/g, '').length;

function md2html(md, { max = 240 } = {}) {
  const lines = md.split('\n');
  const out = [];
  let buf = [], list = null, fence = null;

  const flush = () => {
    if (!buf.length) return;
    const t = buf.join(' ').trim();
    buf = [];
    if (!t || PREAMBLE.some((re) => re.test(t)) || CODA.some((re) => re.test(t))) return;
    out.push(`<p>${inline(t)}</p>`);
  };
  const endList = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } };

  for (const raw of lines) {
    const s = raw.trim();
    if (fence !== null) {
      if (/^```/.test(s)) { out.push(`<div class="eg">${esc(detex(fence.join('\n')))}</div>`); fence = null; }
      else fence.push(raw);
      continue;
    }
    if (/^```/.test(s)) { flush(); endList(); fence = []; continue; }
    if (/^---+$/.test(s)) { flush(); endList(); continue; }
    if (/^#{1,6}\s/.test(s)) { flush(); endList(); continue; }        // 小标题在批注里太重，降级成段落分隔
    if (/^>\s?/.test(s)) { buf.push(s.replace(/^>\s?/, '')); continue; }
    const li = /^[-*]\s+(.*)$/.exec(s) || /^\d+\.\s+(.*)$/.exec(s);
    if (li) { flush(); (list ||= []).push(`<li>${inline(li[1])}</li>`); continue; }
    if (!s) { flush(); endList(); continue; }
    buf.push(s);
  }
  flush(); endList();

  // 同类例子留两个就够，后面的并进折叠区
  let egs = 0;
  const head = [], tail = [];
  for (const blk of out) {
    const isEg = blk.startsWith('<div class="eg">');
    if (isEg) egs++;
    // 正文超过 max 字，或者例子超过两个，后面的都收起来
    if (textLen(head.join('')) >= max || (isEg && egs > 2)) tail.push(blk);
    else head.push(blk);
  }
  if (!head.length) return out.join('');
  return tail.length
    ? `${head.join('')}<details class="deep"><summary>展开原答案剩下的 ${textLen(tail.join(''))} 字</summary>${tail.join('')}</details>`
    : head.join('');
}

/* ── 主流程 ── */
const picked = JSON.parse(readFileSync(o.picked || '01_Transformer/notes-picked.json', 'utf8'));
const notes = [], raws = [], noAnchor = [];

for (const p of picked) {
  const anchor = p.anchor || autoAnchor(p.q, p.sel);
  const a = md2html(p.a || '');
  if (!anchor) noAnchor.push(p);
  // sec 带下去：挂不上原句的，阅读页按它落到章节末尾或预备/岔路区
  notes.push({ id: p.id, anchor, kind: p.kind, sec: p.sec, q: p.q, a });
  raws.push({ id: p.id, src: p.src, n: p.n, sec: p.sec, q: p.q, a: p.a });
}

// 只统计一眼能看到的部分：折叠区里的不算，那是留着随时能翻的
const before = picked.reduce((s, p) => s + (p.a || '').replace(/[#*`>\-]/g, '').length, 0);
const visible = notes.reduce((s, n) => s + textLen(n.a.replace(/<details[\s\S]*?<\/details>/g, '')), 0);
console.log(`清洗 ${picked.length} 条`);
console.log(`答案 ${before} → 首屏 ${visible} 字（压掉 ${Math.round((1 - visible / before) * 100)}%，其余进折叠区，一条没删）`);
console.log(`挂得上论文原句的 ${notes.length - noAnchor.length} 条 → 行内高亮`);
console.log(`挂不上的 ${noAnchor.length} 条 → 落到章节末尾 / 预备区 / 岔路区`);
writeFileSync(o.out || '01_Transformer/notes.json', JSON.stringify(notes, null, 1));
writeFileSync(o.raw || '01_Transformer/notes-raw.json', JSON.stringify(raws, null, 1));
console.log(`✓ ${o.out || '01_Transformer/notes.json'}  +  ${o.raw || '01_Transformer/notes-raw.json'}（原始答案留底）`);
