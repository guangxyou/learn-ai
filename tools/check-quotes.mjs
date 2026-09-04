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

const notes = JSON.parse(readFileSync(notesPath, 'utf8'));
let total = 0; const bad = [];
notes.forEach((n, i) => {
  const body = (n.a || '') + (n.q || '');
  for (const m of body.matchAll(/<span class="m">([\s\S]*?)<\/span>/g)) {
    const q = m[1].replace(/<[^>]+>/g, '').trim();
    if (q.includes('...') || q.includes('…') || !isProse(q)) continue;
    total += 1;
    if (!P.includes(norm(q))) bad.push([i + 1, q]);
  }
});
console.log(`散文式英文引用 ${total} 处，原文对不上 ${bad.length} 处`);
for (const [i, q] of bad) console.log(`  ! 批注 ${i}：「${q.slice(0, 110)}」`);
process.exit(bad.length ? 1 : 0);
