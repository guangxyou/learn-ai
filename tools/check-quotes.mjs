// 把某一篇的批注里所有英文原句和论文原文逐字比一遍。
//   node tools/check-quotes.mjs <notes.json> <论文纯文本或 html>
//
// 只查像英文散文的引用：带 = √ · [] () 这些的是公式，nn.Dropout 这类是代码标识，
// 带省略号的是节选，都跳过。论文题名（Searching for Activation Functions 这种）
// 和举例句会被误报，人工过一眼即可。
//
// 归一化时把连字符也压成空格，所以 inter-dependent 对 interdependent 会报错 ——
// 这正是要抓的那类（AlexNet 批注 28 就是这么查出来的）。
import { readFileSync } from 'node:fs';

const [notesPath, paperPath] = process.argv.slice(2);
if (!notesPath || !paperPath) {
  console.error('用法: node tools/check-quotes.mjs <notes.json> <paper.txt|paper.html>');
  process.exit(2);
}
const norm = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'")
  .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  .replace(/×/g, 'x').replace(/[⁡⁢]/g, '')
  .replace(/[\s\-]+/g, ' ').trim().toLowerCase();

let paper = readFileSync(paperPath, 'utf8');
if (/\.html?$/i.test(paperPath)) {
  paper = paper.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
}
const P = norm(paper);

const isProse = (q) => !/[=√·⁻∈×→[\]{}()]|\d\/\d/.test(q)
  && q.split(/\s+/).length >= 4
  && [...q].filter((c) => /[a-zA-Z\s]/.test(c)).length / q.length > 0.9;

// 从 PDF 抽出来的正文会被双栏排版打断：一句话中间插进表格图注，
// 有时还把两个词粘成一个（full.txt 里就有 "ilsvrcin"）。这类噪声没法自动判，
// 所以留一个白名单：notes.json 同目录下的 quotes-ok.txt，一行一条已经人工核过的引文，
// # 开头是注释。写进去的必须真的翻原文核过，不是拿来消警告的。
const okPath = notesPath.replace(/[^/]+$/, 'quotes-ok.txt');
let OK = [];
try {
  OK = readFileSync(okPath, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map(norm);
} catch { /* 没有这个文件就是没有豁免 */ }

const notes = JSON.parse(readFileSync(notesPath, 'utf8'));
let total = 0; const bad = []; const split = [];
notes.forEach((n, i) => {
  const body = (n.a || '') + (n.q || '');
  for (const m of body.matchAll(/<span class="m">([\s\S]*?)<\/span>/g)) {
    const q = m[1].replace(/<[^>]+>/g, '').trim();
    if (q.includes('...') || q.includes('…') || !isProse(q)) continue;
    total += 1;
    const nq = norm(q);
    if (P.includes(nq)) continue;
    (OK.includes(nq) ? split : bad).push([i + 1, q]);
  }
});
console.log(`散文式英文引用 ${total} 处，引错 ${bad.length} 处，白名单放行 ${split.length} 处`);
for (const [i, q] of bad) console.log(`  ! 批注 ${i}：「${q.slice(0, 110)}」`);
for (const [i, q] of split) console.log(`  · 批注 ${i} 已人工核过：「${q.slice(0, 56)}…」`);
process.exit(bad.length ? 1 : 0);
