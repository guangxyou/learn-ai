/**
 * 论文阅读页生成器：论文 HTML（LaTeXML / ar5iv 版）→ 带批注的阅读页
 *
 * 用法：
 *   node tools/make-paper.mjs --src <论文.html> --notes <批注.json> --out <输出.html>
 *
 * 正文、公式、图、表全部沿用来源 HTML 的原始标记 —— 公式本来就是 MathML，表本来就是 <table>，
 * 图是内联的 data URI。之前从 PDF 抽的那套（重排文字、裁矢量图）到此作废：
 * poppler 导 SVG 会把根号那类它转不了的部分塞成低分辨率位图，怎么调都糊。
 *
 * 这里只做四件事：
 *   1. 把来源拆成 标题 / 作者 / 摘要 / 章节 / 段落 / 公式 / 图表 / 参考文献
 *   2. 每个段落包一层 .blk，右栏挂 notes.json 里的批注（anchor 命中原句就包 <mark>）
 *   3. 补目录、章节锚点、引用跳转、参考文献折叠
 *   4. 附录里横躺的图转正
 *
 * anchor 找不到就报错退出 —— 宁可构建失败，也不要页面上悄悄少一条批注。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { KINDS } from './note-kinds.mjs';

/** 附录三张注意力可视化：图本身是横的，但里面的词是竖排的，歪着头才读得了。
 *  这里在构建期把<b>图片本身</b>转 90°，不是用 CSS transform ——
 *  transform 不改变布局盒子，得靠负 margin 去凑，图注会被压住、还会莫名其妙拖出横向滚动条。
 *  真正转过的图片是竖版的，max-height、flex 这些就都按常识生效了。 */
const ROTATE = ['Sx1.F3', 'Sx1.F4', 'Sx1.F5'];
/** --sxs 里列出的图：源里是并列的两幅 <img>，默认上下堆着，改成左右各占一半 */
let SXS = [];

/** PNG / JPEG 的 data URI 里读出像素尺寸，读不出来就返回 null */
function imgSize(uri) {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(uri);
  if (!m) return null;
  const b = Buffer.from(m[2], 'base64');
  if (m[1] === 'png' && b.length > 24) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (m[1] === 'jpeg' || m[1] === 'jpg') {           // 扫 SOF 段
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xFF) { i++; continue; }
      const mk = b[i + 1];
      if (mk >= 0xC0 && mk <= 0xCF && mk !== 0xC4 && mk !== 0xC8 && mk !== 0xCC)
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** 并排图：给每幅 <img> 挂上 flex:<长宽比> 1 0，宽度按长宽比分，高度就齐了 */
function sideBySide(html) {
  let n = 0;
  const out = html.replace(/<img src="(data:[^"]+)"([^>]*)>/g, (all, uri, rest) => {
    const d = imgSize(uri);
    if (!d || !d.h) return all;
    n++;
    return `<img src="${uri}"${rest} style="flex:${(d.w / d.h).toFixed(4)} 1 0">`;
  });
  return { html: out, n };
}

/** 把 data URI 里的图转 90°（顺时针）。优先 ImageMagick，退回 macOS 自带的 sips */
function rotateDataURI(uri) {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/s.exec(uri);
  if (!m) return uri;
  const dir = join(tmpdir(), 'paper-rot');
  mkdirSync(dir, { recursive: true });
  const inF = join(dir, `in.${m[1]}`), outF = join(dir, `out.${m[1]}`);
  writeFileSync(inF, Buffer.from(m[2], 'base64'));
  try {
    try { execFileSync('magick', [inF, '-rotate', '90', outF], { stdio: 'ignore' }); }
    catch { execFileSync('sips', ['-r', '90', inF, '--out', outF], { stdio: 'ignore' }); }
  } catch {
    // 悄悄返回原图 = 出一版附录图歪着的页面，还看不出来。宁可让构建停下。
    throw new Error('转图失败：装一下 imagemagick，或在 macOS 上跑（有 sips）');
  }
  const out = `data:image/${m[1]};base64,${readFileSync(outF).toString('base64')}`;
  rmSync(inF, { force: true }); rmSync(outF, { force: true });
  return out;
}

/** 把某个 figure 里所有 <img> 的 src 换成转过的版本 */
function rotateFigure(html) {
  let n = 0;
  // 存下来的 HTML 里 src 可能不带引号，两种都要认
  const out = html.replace(/(<img\b[^>]*?\bsrc=)(["']?)([^"'\s>]+)\2/g, (all, a, q, src) => {
    if (!src.startsWith('data:image')) return all;
    n++;
    return `${a}"${rotateDataURI(src)}"`;
  }).replace(/\s(width|height)=["']?\d+["']?/g, '');   // 原来的宽高属性转完就不对了
  return { html: out, n };
}

/* ══════════════════ 小工具 ══════════════════ */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/[\u200B\u2060\uFEFF]/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const norm = (s) => strip(s).replace(/[“”"']/g, '"');
const wan = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : String(n));   // 跟站点其它页同一个写法

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
  if (!o.src || !o.out) {
    console.error('用法: node tools/make-paper.mjs --src <论文.html> --notes <批注.json> --out <输出.html>');
    process.exit(1);
  }
  return o;
}

/** 从 i 处的开标签开始，数嵌套取出整个元素 */
function sliceTag(h, i, tag) {
  const open = new RegExp(`<${tag}\\b`, 'g'), close = new RegExp(`</${tag}>`, 'g');
  open.lastIndex = i + 1; close.lastIndex = i;
  let depth = 1, at = i;
  while (depth > 0) {
    close.lastIndex = Math.max(close.lastIndex, at);
    const c = close.exec(h);
    if (!c) return h.slice(i);
    open.lastIndex = at + 1;
    let o = open.exec(h), inner = 0;
    while (o && o.index < c.index) { inner++; o = open.exec(h); }
    depth += inner - 1;
    at = c.index + c[0].length;
  }
  return h.slice(i, at);
}

/* ══════════════════ 一、拆来源 ══════════════════ */

function parse(src) {
  // MathML 里 <annotation> 存的是 TeX 备份，不渲染但会被 strip 成重复文本 ——
  // 「values h times」会变成「values h h times」，锚点一跨公式就对不上。先整体摘掉。
  src = src.replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, '');

  const doc = { title: '', notice: '', authors: [], abstract: '', items: [], refs: [] };

  doc.title = strip((/<h1[^>]*ltx_title_document[^>]*>([\s\S]*?)<\/h1>/.exec(src) || [, ''])[1]);

  doc.authors = parseAuthors(src);
  doc.fnotes = parseAuthorNotes(src);

  const abs = /<h6[^>]*ltx_title_abstract[^>]*>[\s\S]*?<p\b[^>]*\bltx_p\b[^>]*>([\s\S]*?)<\/p>/.exec(src);
  // 摘要也当成一个普通段落块，这样挂批注、划重点都能扫到它
  if (abs) doc.absBlk = { kind: 'p', html: abs[1] };

  // 正文：从第一个章节标题起，中间把参考文献整块挖掉（附录在它后面，不能一起切掉）
  const start = src.search(/<h2[^>]*ltx_title_section/);
  const bi = src.search(/<(?:ul|ol)\b[^>]*\bltx_biblist\b/);
  const body = bi > 0
    ? src.slice(start, bi) + src.slice(bi + sliceTag(src, bi, src[bi + 1] === 'u' ? 'ul' : 'ol').length)
    : src.slice(start);

  // 保存下来的 HTML 属性没引号、顺序也不固定（<div id=S1.p1 class=ltx_para>），匹配要放宽
  const BLOCK = new RegExp(
    // paragraph 级也要收：Encoder: / Decoder: / Residual Dropout / Label Smoothing / Acknowledgements
    // appendix 也要收：ar5iv 把附录标成 ltx_title_section，arXiv 新版 HTML 标成 ltx_title_appendix，
    // 后者不收的话三个附录会连标题一起消失，正文却还留着 —— 比整块丢掉更难发现
    '<h([2-6])\\b[^>]*\\bltx_title_(?:section|subsection|subsubsection|paragraph|appendix)\\b[^>]*>([\\s\\S]*?)<\\/h\\1>' +
    '|<div\\b[^>]*\\bltx_para\\b[^>]*>' +
    '|<table\\b[^>]*\\b(?:ltx_equation|ltx_equationgroup)\\b[^>]*>' +
    '|<figure\\b[^>]*\\b(ltx_figure|ltx_table)\\b[^>]*>', 'g');
  let m;
  while ((m = BLOCK.exec(body))) {
    const tag = m[0];
    if (m[1]) {
      const raw = m[2];
      const num = strip((/<span[^>]*\bltx_tag_(?:section|subsection|subsubsection|appendix)\b[^>]*>([\s\S]*?)<\/span>/.exec(raw) || [, ''])[1]);
      const text = strip(raw.replace(/<span[^>]*\bltx_tag_[\s\S]*?<\/span>/, ''));
      // 正文里的「见 3.2 节」指向 LaTeXML 的 section id，一并留个锚点，不然点了不动
      const sec = body.lastIndexOf('<section', m.index);
      const lxid = sec < 0 ? '' : (/\bid=["']?([\w.]+)/.exec(body.slice(sec, sec + 120)) || [, ''])[1];
      // 标题也保留一份仅供正文渲染的 HTML：批注可以高亮标题，
      // 但目录仍使用纯文本 text，避免把 <mark>/<sup> 带进 TOC。
      doc.items.push({ kind: 'h', level: +m[1] - 1, num, text, html: esc(text), lxid });
      continue;
    }
    const id = (/\bid=["']?([\w.]+)/.exec(tag) || [, ''])[1];
    if (tag.startsWith('<table')) {
      const el = sliceTag(body, m.index, 'table');
      doc.items.push({ kind: 'eq', html: el }); BLOCK.lastIndex = m.index + el.length; continue;
    }
    if (tag.startsWith('<figure')) {
      const el = sliceTag(body, m.index, 'figure');
      doc.items.push({ kind: 'float', id, html: el }); BLOCK.lastIndex = m.index + el.length; continue;
    }
    const el = sliceTag(body, m.index, 'div');
    BLOCK.lastIndex = m.index + el.length;
    // 段落里可能夹着行间公式和 itemize，拆开
    for (const part of splitPara(el)) doc.items.push(part);
  }

  for (const b of src.slice(bi < 0 ? 0 : bi).matchAll(/<li\b[^>]*\bid=["']?(bib\.bib(\d+))["']?[^>]*>([\s\S]*?)<\/li>/g))
    doc.refs.push({ id: b[1], num: +b[2], html: b[3], cites: [] });

  collectCites(doc);

  return doc;
}


/** 页首的全景图：整张外部 SVG 塞进页面。
 *  它自带 <style> 和 marker id —— 不隔离的话 .ph、.box 这些类会串到正文，
 *  两张图的 marker id 还会互相覆盖。所以：选择器限定到自己，id 加前缀，宽高交给 CSS。 */
/** 海报自己留了天头，页面上方又已经有大标题和 tab —— 两份叠一起，图上方就空出一大条。
 *  嵌进页面时把 viewBox 上沿抬一截，源文件单独打开还是原来的留白。 */
const POSTER_TRIM = 16;

function poster(svg, i) {
  const scope = `pg${i}`;
  svg = svg.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  svg = svg.replace(/<svg\b([^>]*)>/, (m, a) =>
    `<svg${a.replace(/\s(?:width|height)="[^"]*"/g, '')
            .replace(/viewBox="0 0 (\d+) (\d+)"/,
              (_, w, h) => `viewBox="0 ${POSTER_TRIM} ${w} ${h - POSTER_TRIM}"`)} class="${scope}">`);
  for (const id of [...new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]) {
    svg = svg.replace(new RegExp(`\\sid="${id}"`, 'g'), ` id="${scope}-${id}"`)
             .replace(new RegExp(`url\\(#${id}\\)`, 'g'), `url(#${scope}-${id})`);
  }
  return svg.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) =>
    `<style>${css.replace(/(^|\})\s*([^{}@]+)\{/g, (_, end, sel) =>
      `${end}${sel.split(',').map((x) => `svg.${scope} ${x.trim()}`).join(',')}{`)}</style>`);
}

/** 参考文献的链接：一律来自 refnotes.json 里逐条核实过的地址（发表处 + 直链）。
 *  没配到的才退回从正文里抠 arXiv 号 —— 构建时会报出来。 */
function refURL(text, note) {
  if (note?.url) return { href: note.url, kind: note.venue || '原文' };
  const a = /(?:abs\/|arXiv:)\s*(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})/.exec(text);
  if (a) return { href: `https://arxiv.org/abs/${a[1]}`, kind: 'arXiv' };
  return null;
}

/** 扫一遍正文，记下每条文献被引用在哪一句、哪一节 —— 这部分完全来自论文本身 */
function collectCites(doc) {
  const byNum = new Map(doc.refs.map((r) => [r.num, r]));
  let sec = '';
  for (const it of doc.items) {
    if (it.kind === 'h') { if (it.level <= 2 && it.num) sec = it.num; continue; }
    // 表格里的引用（表 2、表 4 的基线行）没有句子可摘，就记成「出现在某张表」
    if (it.kind === 'float') {
      const cap = strip((/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(it.html) || [, ''])[1]);
      const label = cap.split(/[:：]/)[0] || '图表';
      for (const m of strip(it.html).matchAll(/\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/g))
        for (const num of m[1].split(/\s*,\s*/).map(Number))
          byNum.get(num)?.cites.push({ sec, sent: `列在 ${label} 的对照行里`, float: true });
      continue;
    }
    if (it.kind !== 'p') continue;
    const text = strip(it.html);
    // 句子切分：句点 + 空格 + 大写开头
    for (const sent of text.split(/(?<=\.)\s+(?=[A-Z(])/)) {
      // strip() 把 <a> 换成了空格，所以是「[ 13 ]」「[ 2 , 19 ]」这种形态
      for (const m of sent.matchAll(/\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/g))
        for (const num of m[1].split(/\s*,\s*/).map(Number))
          byNum.get(num)?.cites.push({ sec, sent: sent.trim().replace(/\[\s*([\d\s,]+?)\s*\]/g, (_, d) => `[${d.replace(/\s+/g, '')}]`) });
    }
  }
}

/** 一个 ltx_para 里可能既有正文 <p> 又有行间公式表格，按出现顺序拆开 */
function splitPara(el) {
  const out = [];
  const RE = /<p\b[^>]*\bltx_p\b[^>]*>|<table\b[^>]*\b(?:ltx_equation|ltx_equationgroup)\b[^>]*>/g;
  let m;
  while ((m = RE.exec(el))) {
    if (m[0].startsWith('<p')) {
      const p = sliceTag(el, m.index, 'p');
      RE.lastIndex = m.index + p.length;
      const inner = p.replace(/^<p[^>]*>/, '').replace(/<\/p>$/, '');
      // itemize 的每一项也是个 ltx_para，整个 <ul> 又套在引子那段的 div 里，
      // 所以只能逐段回看：前面有没有一个还没闭合的 <li>
      const li = /<li\b[^>]*\bltx_item\b[^>]*>(?:(?!<\/li>)[\s\S])*$/.test(el.slice(0, m.index));
      if (strip(inner)) out.push({ kind: 'p', li, ...pullFootnotes(inner) });
    } else {
      const t = sliceTag(el, m.index, 'table');
      RE.lastIndex = m.index + t.length;
      out.push({ kind: 'eq', html: t });
    }
  }
  return out;
}

/** 段落里的脚注：正文只留角标，注文摘出来，交给 render 攒到章节末尾。
 *  原件把注文塞在句子中间（LaTeXML 的 ltx_note_outer），直接展开会把句子劈成两半，
 *  句号被甩到下一行 —— 论文里它本来就该在页脚。 */
function pullFootnotes(html) {
  const fn = [];
  let out = '', at = 0;
  const RE = /<span\b[^>]*\bltx_note\b[^>]*\bltx_role_footnote\b[^>]*>/g;
  let m;
  while ((m = RE.exec(html))) {
    const el = sliceTag(html, m.index, 'span');
    const mark = (/<sup\b[^>]*\bltx_note_mark\b[^>]*>([^<]*)<\/sup>/.exec(el) || [, String(fn.length + 1)])[1];
    const ci = el.search(/<span\b[^>]*\bltx_note_content\b[^>]*>/);
    let body = ci < 0 ? '' : sliceTag(el, ci, 'span').replace(/^<span[^>]*>/, '').replace(/<\/span>$/, '');
    body = body.replace(/<sup\b[^>]*\bltx_note_mark\b[^>]*>[^<]*<\/sup>/, '')
      .replace(/<span\b[^>]*\bltx_tag_note\b[^>]*>[\s\S]*?<\/span>/, '');
    fn.push({ mark, html: body });
    // 正文只留角标；角标前那个空格也去掉，免得读成「gradients ¹.」中间空一格
    out += html.slice(at, m.index).replace(/\s+$/, '') + `<sup class="fnm">${esc(mark)}</sup>`;
    at = m.index + el.length;
    RE.lastIndex = at;
  }
  return { html: out + html.slice(at), fn };
}

/** 论文里作者角标是 * † ‡，LaTeXML 一律换成了数字，这里换回去 */
const MARKS = ['*', '†', '‡', '§'];

/** LaTeXML 把作者角标压平了：八个人全标成 1，Ashish 连 1 都没有（他那条被当成脚注定义吃掉了）。
 *  实际角标以 PDF 为准 —— * 是全体等贡献，† ‡ 各只挂一个人。 */
const EXTRA_MARKS = { 'Aidan N. Gomez': '†', 'Illia Polosukhin': '‡' };

/** PDF 首页页脚的会议行。它由 NeurIPS 的样式文件在编译时注入，LaTeX 源里没有，
 *  所以 LaTeXML 版也没有 —— 照 PDF 补上，不然首页比 PDF 少一行。 */
const VENUE_DEFAULT = '31st Conference on Neural Information Processing Systems (NIPS 2017), Long Beach, CA, USA.';
/** 页脚会议行由 --venue 覆盖 —— AlexNet 是 NIPS 2012，Transformer 是 NIPS 2017 */
const VENUE = () => o.venue ?? VENUE_DEFAULT;

/** 作者：ltx_personname 里是「姓名 <br> 机构 <br> 邮箱」，多位作者用 & 连着，名字后面挂脚注角标 */
function parseAuthors(src) {
  const people = [];
  for (const m of src.matchAll(/<span\b[^>]*\bltx_personname\b[^>]*>/g)) {
    const chunk = sliceTag(src, m.index, 'span');
    if (!strip(chunk)) continue;
    for (const one of chunk.split(/&amp;|&(?![a-z]+;)/)) {
      const marks = [...one.matchAll(/<sup\b[^>]*\bltx_note_mark\b[^>]*>(\d+)<\/sup>/g)]
        .map((x) => MARKS[+x[1] - 1] || '*');
      const lines = one.replace(/<sup\b[^>]*\bltx_note_mark\b[^>]*>\d+<\/sup>/g, '')
        .split(/<br[^>]*>/).map((s) => strip(s)).filter(Boolean);
      if (lines.length) people.push({ lines, mark: [...new Set(marks)].join('') });
    }
  }
  // 等贡献那条挂在所有人头上；† ‡ 按 PDF 补
  const shared = people.some((p) => p.mark.includes('*')) ? '*' : '';
  for (const p of people) {
    const extra = EXTRA_MARKS[p.lines[0]] || '';
    p.mark = (p.mark.includes('*') ? p.mark : shared + p.mark) + extra;
  }
  return people;
}

/** 首页页脚那段 \thanks：LaTeXML 把三条拍平成一段纯文字了，按已知的起头切回三条 */
function parseAuthorNotes(src) {
  const i = src.search(/<span\b[^>]*\bltx_author_notes\b[^>]*>/);
  if (i < 0) return [];
  // sliceTag 而不是非贪婪正则：arXiv 新版这块里套着 ltx_contact / ltx_contact_name，
  // `([\s\S]*?)<\/span>` 只截到第一个 </span>，结果就剩一个「Affiliation:」。
  const el = sliceTag(src, i, 'span');
  // 两种形态：ar5iv 是 per-author 的 \thanks（有角标）；
  // arXiv 新版是全体共用的单位和邮箱（ltx_contact，不该给角标）。
  if (/\bltx_role_(?:affiliation|email|address)\b/.test(el)) {
    const out = [];
    for (const m of el.matchAll(/<span\b[^>]*\bltx_contact\b[^>]*>/g)) {
      const c = sliceTag(el, m.index, 'span');
      const t = strip(c.replace(/<span\b[^>]*\bltx_contact_name\b[^>]*>[\s\S]*?<\/span>/, ''));
      if (t) out.push({ mark: '', text: t });
    }
    return out;
  }
  return strip(el).split(/(?=Work performed while at)/)
    .map((t, k) => ({ mark: MARKS[k] || '*', text: t.trim() })).filter((n) => n.text);
}

/* ══════════════════ 二、批注 ══════════════════ */

/** 批注分三路：挂得上原句的做行内高亮；挂不上但属于某节的落到该节末尾；
 *  预备和岔路各自成区。返回后两路，交给 render 摆位置。 */
function attach(items, notes) {
  // 先定位，再按「在论文里出现的先后」编号 —— 编号不跟 notes.json 的数组顺序走，
  // 否则后补的一条会顶着很大的号码插在正文靠前的位置。
  const placed = [], loose = [];
  for (const n of notes) {
    // 标题批注必须显式声明 target: "heading"，避免与正文同名的旧批注被标题抢走。
    const targetKinds = n.target === 'heading' ? new Set(['h']) : new Set(['p', 'float']);
    const all = n.anchor
      ? items.filter((b) => targetKinds.has(b.kind) && norm(b.html).includes(norm(n.anchor)))
      : [];
    // skip: 同一个词在多段里出现时，跳过前 n 段。比写长 anchor 好 —— 高亮范围还能保持在那个词上
    const skip = n.skip || 0;
    if (all.length > 1 && !skip) console.warn(`  ! 「${n.anchor}」在 ${all.length} 个段落里都有，挂在了第一个；` +
      '要挂到别处就加 "skip": N');
    const hit = all[skip];
    if (!hit) { loose.push(n); continue; }
    placed.push({ n, hit, bi: items.indexOf(hit), at: norm(hit.html).indexOf(norm(n.anchor)) });
  }
  placed.sort((a, b) => a.bi - b.bi || a.at - b.at);
  placed.forEach((x, i) => { x.n.id = i + 1; (x.hit.notes ||= []).push(x.n); });
  loose.forEach((n, i) => { n.id = placed.length + i + 1; });
  // 同一段里从后往前包，先插进去的 <sup> 数字才不会挪动前面锚点的定位
  for (const x of [...placed].reverse()) {
    const before = x.hit.html;
    x.hit.html = markUp(x.hit.html, x.n.anchor, x.n.id, x.n.kind);
    if (x.hit.html === before) console.warn(`  ! 第 ${x.n.id} 条包不上 <mark>：「${x.n.anchor.slice(0, 40)}…」`);
  }
  return loose;
}

/** 候选池里的位置 → 落在哪一节末尾。§2–§3.1 这种跨节的，落在区间最后一节 */
const SEC_TAIL = {
  '§2–§3.1': '3.1', '§3.2.1': '3.2.1', '§3.2.2': '3.2.2', '§3.3': '3.3',
  '§3.4–§3.5': '3.5', '§4': '4', '§5–§6.2': '6.2', '§6.3–§7': '7',
};
/** 上面那张表是 Transformer 那篇的候选池标签（一个标签可能跨几节）。
 *  直接写「§3.1」这种单节号的也认 —— 后来的篇目不必再往表里加一行。 */
const secTail = (sec) => SEC_TAIL[sec] ?? (/^§([\d.]+)$/.exec(String(sec || '')) || [])[1];

/** 批注里的行内公式：把 d_model、h_t、h_(t-1) 这类写法排成正文那样的
 *  斜体变量 + 真下标。代码块（.eg）和等宽片段（.m）里的不动 —— 那儿本来就是 ASCII 对齐的。 */
function mathify(html) {
  const keep = [];
  // 先把不该动的段落挖出来占位
  // SVG 也要挖出来 —— 往 <text> 里塞 <span><sub> 会直接把图打散
  html = html.replace(/<svg[\s\S]*?<\/svg>|<div class="eg">[\s\S]*?<\/div>|<span class="m">[\s\S]*?<\/span>/g,
    (m) => `\u0000${keep.push(m) - 1}\u0000`);
  // 下标和上标一起处理：分两遍做的话，第一遍产出的 </span> 会被第二遍当成上标的底数
  const PART = '(?:\\{[^}]+\\}|\\([^)]+\\)|[A-Za-z0-9]+)';
  // 底数允许多字母（log_k、d_model^(-0.5) 这种），单个拉丁字母才斜体
  const RE = new RegExp(`(\\b[A-Za-z]+|ℝ|\\b\\d+)(?:_(${PART}))?(?:\\^(${PART}))?`, 'g');
  const bare = (x) => x.replace(/^[{(]|[)}]$/g, '');
  // 上下标里还可能套着上下标（ℝ^(d_model×d_k)），所以递归一层
  const scripts = (txt, depth = 0) => txt.replace(RE, (m, v, sb, sp) => {
    if (!sb && !sp) return m;
    const base = /^[A-Za-z]$/.test(v) ? `<i>${v}</i>` : v;   // 单个拉丁字母才斜体
    const inner = (x) => (depth < 2 ? scripts(bare(x), depth + 1) : bare(x));
    return `<span class="mf">${base}${sb ? `<sub>${inner(sb)}</sub>` : ''}${sp ? `<sup>${inner(sp)}</sup>` : ''}</span>`;
  });
  html = scripts(html);
  return html.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
}

/** 划重点：把一段纯文本包上红色下划线。和批注是两层东西 —— 批注是当时的问答，
 *  重点是读完之后想留给下一个读者看的句子，所以隐藏批注时它不跟着消失。 */
function keyUp(html, text) {
  return wrapText(html, text, '<u class="key">', '</u>');
}

/** 在带标签的 HTML 里高亮一段纯文本：逐字符走，跳过标签与实体，命中区间包 <mark> */
function markUp(html, anchor, id, kind) {
  // 取纯文本的逻辑只留 wrapText 里那一份 —— 之前这儿有个副本，改了一处没改另一处，
  // 结果锚点跨行内公式时「卡片在、正文没高亮」
  return wrapText(html, anchor,
    `<mark data-n="${id}" data-k="${esc(kind || '')}">`, `<sup>${id}</sup></mark>`);
}

/** 逐字符走一遍 HTML，跳过标签与实体，把纯文本里命中的区间用 open/close 包起来 */
function wrapText(html, text, open, close, pre) {
  let plain, map, s, idx;
  if (pre) ({ plain, map, s, idx } = pre);
  else {
    plain = []; map = [];
    for (let i = 0; i < html.length; i++) {
      // 标签要当成一个空格 —— strip() 就是这么做的，两边规则必须一致，
      // 否则锚点一跨行内公式（<math>…</math>）就会「attach 找得到、markUp 找不到」，
      // 结果卡片在、正文却没有高亮
      if (html[i] === '<') { plain.push(' '); map.push(i); while (i < html.length && html[i] !== '>') i++; continue; }
      // MathML 里的不可见连接符（U+200B 之类）在 strip 里算空白，这里也得一致
      if (/[\u200B\u2060\uFEFF]/.test(html[i])) { plain.push(' '); map.push(i); continue; }
      if (html[i] === '&') {
        const semi = html.indexOf(';', i);
        if (semi > 0 && semi - i < 8) { plain.push(' '); map.push(i); i = semi; continue; }
      }
      plain.push(html[i]); map.push(i);
    }
    s = plain.join('').replace(/\s+/g, ' ');
    idx = []; let last = -1;
    plain.forEach((c, k) => { const sp = /\s/.test(c); if (sp && last === 1) return; idx.push(k); last = sp ? 1 : 0; });
  }
  const t = norm(text);
  const at = s.indexOf(t);
  if (at < 0) return html;
  let a = map[idx[at]], b = (map[idx[at + t.length - 1]] ?? map[map.length - 1]) + 1;
  // 起止点不能落在 <math> 内部：MathML 里插 <mark> 会把 DOM 撑坏，
  // 旁注会被挤进 <mi>，整块布局跟着崩
  const inMath = (i) => {
    const head = html.slice(0, i);
    return (head.match(/<math\b/g) || []).length > (head.match(/<\/math>/g) || []).length;
  };
  // 锚点扫到半个公式时，把边界推到整块公式之外 —— 高亮可以包住一整个 <math>，
  // 但绝不能插进 <math> 内部，那会把旁注挤进 <mi>，整块布局跟着崩
  if (inMath(a)) { const o = html.lastIndexOf('<math', a); if (o >= 0) a = o; }
  if (inMath(b)) { const c = html.indexOf('</math>', b); if (c >= 0) b = c + 7; }
  if (inMath(a) || inMath(b)) {
    console.warn(`  ! 锚点「${text.slice(0, 30)}…」的起止落在公式内部，跳过高亮；换一段纯文字当锚点`);
    return html;
  }
  return html.slice(0, a) + open + html.slice(a, b) + close + html.slice(b);
}

/* ══════════════════ 三、出页面 ══════════════════ */

function render(doc, notes, loose, refnotes = {}, posters = [], res = null, docs = []) {
  const secs = [];
  const parts = [];

  // 挂不上原句的分两拨：属于某节的落到节末，预备/岔路的另开区
  const tailOf = {}, extra = { 预备: [], 岔路: [] };
  for (const n of loose) {
    const t = secTail(n.sec);
    if (t) (tailOf[t] ||= []).push(n);
    else if (String(n.sec).startsWith('岔路')) (extra.岔路[n.sec] ||= (extra.岔路[n.sec] = [])).push(n);
    else extra.预备.push(n);
  }
  // 岔路按具体话题分组
  const detours = {};
  for (const n of loose) if (String(n.sec).startsWith('岔路')) (detours[n.sec.replace(/^岔路·/, '')] ||= []).push(n);

  parts.push(`<section class="front">
    <h2 class="ptitle">${esc(doc.title)}</h2>
    <div class="agrid">${authorHTML(doc.authors)}</div>
    ${doc.fnotes.length ? `<div class="fnotes">${doc.fnotes.map((n) =>
      `<p>${n.mark ? `<sup>${n.mark}</sup>` : ''}${esc(n.text)}</p>`).join('')}${
      VENUE() ? `<p class="venue">${esc(VENUE())}</p>` : ''}</div>` : ''}
  </section>`);

  if (doc.absBlk) {
    secs.push({ id: 'sabstract', num: '', text: 'Abstract', level: 1 });
    parts.push(`<h2 class="ph" id="sabstract">Abstract</h2>`);
    parts.push(blk(doc.absBlk));
  }

  // 脚注攒到本节末尾再出，不插在句子中间
  let pending = [];
  const flush = () => {
    if (!pending.length) return;
    parts.push(`<div class="fnsec"><span class="fnsec-h">脚注</span>${pending.map((n) =>
      `<p><sup>${esc(n.mark)}</sup>${n.html}</p>`).join('')}</div>`);
    pending = [];
  };

  // 某节的散落批注，等这一节走完（下一个同级或更高级标题）再摆出来
  let openTail = null;
  const flushTail = (num) => {
    if (!openTail) return;
    if (num && (num === openTail.num || num.startsWith(openTail.num + '.'))) return;
    parts.push(noteBlock(`§${openTail.num} 这一节还问过`, openTail.list));
    openTail = null;
  };

  for (const it of doc.items) {
    if (it.kind === 'p' && it.fn?.length) pending.push(...it.fn);
    if (it.kind === 'h') {
      flushTail(it.num);
      // 下一个正式章节标题出现，就说明带脚注的上一节已经结束。不能只等一级标题，
      // 否则 §3.2.1 的脚注会一路拖到 §4；段落级小标题（level 4）不算章节边界。
      if (it.level < 4) flush();
      const id = 's' + (it.num || it.text).replace(/[.:\s]+/g, '-').toLowerCase().replace(/-$/, '');
      // 段落级标题（Encoder: / Decoder: / Acknowledgements）只进正文，不进目录，否则目录被撑散
      if (it.level < 4) secs.push({ id, num: it.num, text: it.text, level: it.level });
      const tag = it.level === 1 ? 'h2' : it.level < 4 ? 'h3' : 'h4';
      const lxa = it.lxid ? `<span class="lxa" id="${it.lxid}"></span>` : '';
      const heading = `<${tag} class="ph" id="${id}">${
        it.num ? `<span class="hn">${esc(it.num)}</span>` : ''}${it.html || esc(it.text)}</${tag}>`;
      parts.push(it.notes
        ? `${lxa}<div class="blk hblk hot">${heading}<div class="side">${it.notes.map(noteCard).join('')}</div></div>`
        : `${lxa}${heading}`);
      if (it.num && tailOf[it.num]) openTail = { num: it.num, list: tailOf[it.num] };
    } else if (it.kind === 'eq') {
      parts.push(`<div class="eqbox">${it.html}</div>`);
    } else if (it.kind === 'float') {
      let fh = it.html;
      if (ROTATE.includes(it.id)) {
        const r = rotateFigure(fh); fh = r.html;
        console.log(`  · ${it.id} 转正 ${r.n} 张图`);
      }
      if (SXS.includes(it.id)) {
        const r = sideBySide(fh); fh = r.html;
        console.log(`  · ${it.id} 并排 ${r.n} 幅，宽度按长宽比分`);
      }
      const cls = (ROTATE.includes(it.id) ? ' rot' : '') + (SXS.includes(it.id) ? ' sxs' : '');
      const fbox = `<div class="floatbox${cls}">${fh}</div>`;
      // 图上挂了批注，就和段落一样套进 .blk 网格 —— 卡片进右侧旁注栏，不占正文
      parts.push(it.notes
        ? `<div class="blk float hot">${fbox}<div class="side">${it.notes.map(noteCard).join('')}</div></div>`
        : fbox);
    } else {
      parts.push(blk(it));
    }
  }

  flushTail(null);
  flush();


  // 预备：读正文之前补的底子
  if (extra.预备.length) {
    secs.push({ id: 'sprep', num: '', text: '预备', level: 1 });
    parts.push(`<h2 class="ph area" id="sprep">读之前补的底子<span class="n">${extra.预备.length} 条</span></h2>`);
    parts.push(`<p class="area-note">这些不在论文里，是开读之前先要过一遍的东西 —— 不补的话正文读不动。</p>`);
    parts.push(noteBlock('', extra.预备));
  }
  // 岔路：读着读着岔出去的
  const dk = Object.keys(detours);
  if (dk.length) {
    const total = dk.reduce((s2, k) => s2 + detours[k].length, 0);
    secs.push({ id: 'sdetour', num: '', text: '岔路', level: 1 });
    parts.push(`<h2 class="ph area" id="sdetour">岔路<span class="n">${dk.length} 条 · ${total} 问</span></h2>`);
    parts.push(`<p class="area-note">读到某一句突然想起别的事，就岔出去了。放在这儿，不打断正文的节奏。</p>`);
    for (const k of dk) {
      parts.push(`<h3 class="ph" id="sd-${k.replace(/[^\w]/g, '-')}">${esc(k)}<span class="n">${detours[k].length} 问</span></h3>`);
      parts.push(noteBlock('', detours[k]));
    }
  }

  parts.push(`<details class="refs" id="sreferences"><summary>References<span>${doc.refs.length} 条</span></summary>
    <ol>${doc.refs.map((r) => refHTML(r, refnotes)).join('')}</ol></details>`);
  secs.push({ id: 'sreferences', num: '', text: 'References', level: 1 });

  const toc = secs.map((s) =>
    `<a href="#${s.id}" data-ol="${s.id}" class="${s.level > 1 ? 'sub' : ''}">${s.num ? esc(s.num) + ' ' : ''}${esc(s.text)}</a>`).join('');

  /** 标题底下那行数：全从批注本身数出来，改一条批注它就跟着变，不会和正文对不上。
   *  字数只算人写的话 —— 整段 <svg> 先剔掉，图里的坐标轴标签、图例不该算进字数。
   *  data-chars 留给 src/build.mjs：列表页的卡片直接读它，两处数字只有这一个来源。 */
  //  strip() 把每个标签换成一个空格，用来数字数会虚高（<b>、<span class="m"> 这类行内标签满篇都是），
  //  所以这里标签直接去掉不留空 —— 数的是读者眼睛看得到的那些字符。
  const words = (h) => String(h || '').replace(/<svg\b[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, 'x').replace(/\s+/g, ' ').trim().length;
  const chars = notes.reduce((n, x) => n + words(x.q) + words(x.a), 0);
  const figs = notes.reduce((n, x) => n + (String(x.a || '').match(/<svg\b/gi) || []).length, 0);
  const meta = `<div class="ep-meta" data-chars="${chars}">` + [
    // 「万字」整个留在常规体里，别让粗细断在词中间
    [notes.length, ' 条批注'], [wan(chars).split(' ')[0], ' ' + (wan(chars).split(' ')[1] || '') + '字'], [figs, ' 张插图'],
  ].map(([n, k]) => `<span><b>${n}</b>${k}</span>`).join('') + '</div>';

  // 全景图不进正文 —— 它有 1560 宽，跟正文抢版面就会压到目录上。
  // 单独成两个视图，跟论文一起挂在顶部的三个 tab 下，各自占满整幅。
  const views = posters.map((pg, i) =>
    `<div class="mapview" id="view-map-${i + 1}">`
    + (pg.note ? `<p class="area-note">${esc(pg.note)}</p>` : '')
    + `<div class="pbox"><div class="pin">${poster(pg.svg, i + 1)}</div></div></div>`).join('');

  return shell(parts.join('\n'), toc, meta, doc.title, o.home || '#', posters,
    views + docViews(docs) + resView(res), !!res, docs);
}

/** 独立内容 tab：整页 HTML 片段，和论文正文并列成一个 tab。
 *  用来放不属于任何一句话的东西 —— 比赛沿革、这一篇的贡献与局限。
 *  片段自己只写 <h2>/<p>/<table>/<svg>，版式由下面的 .docview 统一管。 */
function docViews(docs) {
  return docs.map((d, i) =>
    `<div class="docview" id="view-doc-${i + 1}"><article class="doc">${d.html}</article></div>`).join('');
}

/** 资源 tab：站外的视频、文章。内容全在 content/<条目>/resources.json 里，
 *  这里只负责摆版。播放器主源用 B 站官方双语版 —— 国内直连 0.2s，YouTube 从国内
 *  打不开，嵌了也只是个灰框；标题仍然指回 YouTube 原片当出处。
 *  仍然不预加载：进页面谁都不碰，封面用自己截的图，点了才现建 iframe。
 *  章节跳转靠重建 iframe 带 t=秒数（B 站和 YouTube 都认这个参数）—— 换 IFrame
 *  Player API 能做到不重新缓冲，但得引第三方脚本，这一页不引。
 *  时间戳两边通用：B 站官方那版简介里带的就是同一份时间轴，核对过。 */
function resView(res) {
  if (!res) return '';
  const secs = (t) => t.split(':').reduce((a, b) => a * 60 + +b, 0);
  const card = (v) => {
    const chaps = v.chapters.map(([t, label]) =>
      `<li><button type="button" class="vch" data-t="${secs(t)}"><b>${t}</b>${esc(label)}</button></li>`).join('');
    const shots = (v.shots || []).map(([f, g, cap]) =>
      `<figure class="shot"><img src="__ASSETS__/3b1b/${f}-t.jpg" data-full="__ASSETS__/3b1b/${f}.jpg"`
      + ` alt="${esc(cap)}" loading="lazy" decoding="async">`
      + `<figcaption><i>${esc(g)}</i>${esc(cap)}</figcaption></figure>`).join('');
    const cover = v.shots && v.shots.length ? `__ASSETS__/3b1b/${v.shots[0][0]}-t.jpg` : '';
    return `<article class="vcard" data-yt="${esc(v.yt)}"${v.bv ? ` data-bv="${esc(v.bv)}"` : ''}>
      <div class="vhd">
        <h4><a href="https://www.youtube.com/watch?v=${esc(v.yt)}" target="_blank" rel="noreferrer">${esc(v.title)} ↗</a></h4>
        ${v.zh ? `<p class="vzh">${esc(v.zh)}</p>` : ''}
        <p class="vmeta"><span class="vsrc">${esc(v.author || '3Blue1Brown')}</span><time>${esc(v.date)}</time>
          ${v.article ? `<a href="${esc(v.article)}" target="_blank" rel="noreferrer">配套文章 ↗</a>` : ''}
          ${v.bv ? `<a href="https://www.bilibili.com/video/${esc(v.bv)}" target="_blank" rel="noreferrer">B 站官方双语 ↗</a>` : ''}</p>
      </div>
      <div class="vbody">
        <div class="vwrap"><button class="vplay" type="button" aria-label="加载并播放"
          ${cover ? `style="background-image:url(${cover})"` : ''}><span class="vtri"></span></button></div>
        <ol class="vchap">${chaps}</ol>
      </div>
      ${shots ? `<details class="vshots"><summary>相关截图<span>点开看大图</span></summary>
        <div class="shots">${shots}</div></details>` : ''}
    </article>`;
  };
  const link = (t) => `<article class="vcard rcard">
      <h4><a href="${esc(t.url)}" target="_blank" rel="noreferrer">${esc(t.title)} ↗</a></h4>
      ${t.zh ? `<p class="vzh">${esc(t.zh)}</p>` : ''}
      <p class="vmeta"><span class="vsrc">${esc(t.by)}</span>
        ${(t.links || []).map(([n, u]) =>
          `<a href="${esc(u)}" target="_blank" rel="noreferrer">${esc(n)}</a>`).join('')}</p>
    </article>`;
  const groups = [];
  if ((res.tools || []).length) groups.push(['工具', res.tools.map(link).join('')]);
  if ((res.videos || []).length) groups.push(['视频', res.videos.map(card).join('')]);
  return `<div class="resview" id="view-res">${groups.map(([t, html]) =>
    `<section class="res-sec"><h3 class="res-h">${esc(t)}</h3>${html}</section>`).join('')}</div>`;
}

/** 一条参考文献：可展开，里面是简述 + 本文引用它的原句 */
function refHTML(r, notes) {
  const note = notes[r.num];
  r.url = refURL(strip(r.html), note);
  const cites = r.cites.filter((c, i, a) => a.findIndex((x) => x.sent === c.sent) === i);
  const body = (note?.sum ? `<p class="rn">${note.sum}</p>` : '') +
    (cites.length ? `<div class="rc"><b>本文在这些地方引用它</b>${cites.map((c) =>
      `<p>${c.sec ? `<i>§${esc(c.sec)}</i>` : ''}${esc(c.sent)}</p>`).join('')}</div>` : '');
  const link = r.url ? `<a class="rl" href="${r.url.href}" target="_blank" rel="noreferrer">${esc(r.url.kind)} ↗</a>` : '';
  if (!note?.sum) console.warn(`  ! 文献 [${r.num}] 没有简述`);
  if (!r.url) console.warn(`  ! 文献 [${r.num}] 没有链接`);
  if (!cites.length) console.warn(`  ! 文献 [${r.num}] 没找到正文引用处`);
  return `<li id="${r.id}"><details><summary>${r.html}${link}</summary>${body}</details></li>`;
}

function authorHTML(people) {
  const rows = [people.slice(0, 4), people.slice(4, 7), people.slice(7)];
  return rows.filter((r) => r.length).map((r) =>
    `<div class="arow">${r.map((p) =>
      `<div class="acell">${p.lines.map((t, i) =>
        `<span class="${['an', 'aa', 'ae'][i] || 'aa'}">${esc(t)}${
          i === 0 && p.mark ? `<sup class="amk">${p.mark}</sup>` : ''}</span>`).join('')}</div>`).join('')}</div>`).join('');
}

/** 一组不挂原句的批注，铺成一列卡片 */
function noteBlock(title, list) {
  return `<div class="nblock">${title ? `<div class="nb-h">${esc(title)}<span>${list.length} 条</span></div>` : ''}
    <div class="nb-list">${list.map(noteCard).join('')}</div></div>`;
}

function noteCard(n) {
  return `<div class="nt" data-n="${n.id}">
      <button class="nt-q" type="button"><span class="num" data-k="${esc(n.kind)}">${n.id}</span><span class="qt">${n.q}</span><span class="tag" data-k="${esc(n.kind)}">${n.kind}</span></button>
      <div class="nt-a">${mathify(n.a)}</div>
    </div>`;
}

function blk(b) {
  const notes = (b.notes || []).map((n) => `
    <div class="nt" data-n="${n.id}">
      <button class="nt-q" type="button"><span class="num" data-k="${esc(n.kind)}">${n.id}</span><span class="qt">${n.q}</span><span class="tag" data-k="${esc(n.kind)}">${n.kind}</span></button>
      <div class="nt-a">${mathify(n.a)}</div>
    </div>`).join('');
  return `<div class="blk${b.notes ? ' hot' : ''}${b.li ? ' li' : ''}">
    ${b.notes ? `<span class="dot">${b.notes.length}</span>` : ''}
    <p class="pp">${b.html}</p>
    ${notes ? `<div class="side">${notes}</div>` : ''}
  </div>`;
}

/** 标题结尾防孤字：中文可以在任意两字之间断行，"…论文精读" 很容易只剩 "精读"
 *  甚至 "读" 落在第二行。把末尾一小段裹进 nowrap，保证最后一行至少有这么多字。
 *  只影响断点，不改文字本身，也不进 <title>。 */
function h1HTML(t, tail = 5) {
  const s = String(t);
  if (s.length <= tail) return esc(s);
  return esc(s.slice(0, -tail)) + `<span class="nb">${esc(s.slice(-tail))}</span>`;
}

function shell(body, toc, meta, paperTitle, home = '#', posters = [], views = '', hasRes = false, docs = []) {
  return `<!doctype html>
<html lang="zh-Hans"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title || '逐句啃 Attention is All You Need')}</title>
${o.desc ? `<meta name="description" content="${esc(o.desc)}">` : ''}
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : ''}
<style>${CSS}</style></head><body>
<header class="topbar"><div class="wrap">
  <a class="back" href="${home}">‹ 全部条目</a>
</div></header>

<div class="wrap"><section class="ep-head">
  <div class="ep-kicker"><span class="topic">论文</span>
    <span>《${esc(paperTitle)}》 · ${esc(o.kicker || 'NeurIPS 2017')} ·
      <a href="${esc(o.srcurl || 'https://arxiv.org/abs/1706.03762')}" target="_blank" rel="noreferrer">${esc(o.srclabel || 'arXiv:1706.03762')} ↗</a></span>
  </div>
  <h1>${h1HTML(o.h1 || '逐字、逐句理解 Transformer')}</h1>
  ${meta}
</section></div>

<div class="bar"><div class="wrap">
  <div class="tabs" role="tablist">
    <button class="tb on" type="button" role="tab" data-v="paper" aria-selected="true">论文</button>
    ${posters.map((pg, i) =>
      `<button class="tb" type="button" role="tab" data-v="map-${i + 1}" aria-selected="false">${esc(pg.label)}</button>`).join('')}
    ${docs.map((d, i) =>
      `<button class="tb" type="button" role="tab" data-v="doc-${i + 1}" aria-selected="false">${esc(d.label)}</button>`).join('')}
    ${hasRes ? `<button class="tb" type="button" role="tab" data-v="res" aria-selected="false">资源</button>` : ''}
  </div>
  <div class="legend">
    ${Object.entries(KINDS).map(([k, v]) =>
      `<span class="lg" title="${esc(v.desc)}"><i style="background:${v.c};border-color:${v.ln}"></i>${k}</span>`).join('')}
    <span class="lg" title="读完之后想留给下一个读者看的句子"><u class="key">划重点</u></span>
  </div>
  <div class="swbox">
    <button class="sw" id="sw-all" type="button" aria-pressed="false"><i></i>展开全部批注</button>
    <button class="sw" id="sw-off" type="button" aria-pressed="false"><i></i>隐藏所有批注</button>
  </div>
</div></div>

<div class="wrap main">
  <aside class="toc"><h4>论文目录</h4><div>${toc}</div></aside>
  <div class="paper">${body}</div>
  ${views}
</div>

<div class="lb" id="lightbox"><button class="lb-nav lb-prev" type="button" aria-label="上一张">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="lb-nav lb-next" type="button" aria-label="下一张">›</button></div>

<div class="scrim" id="scrim"></div>
<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
  <div class="sheet-grab"></div>
  <div class="sheet-hd"><span class="num"></span><span class="qt" id="sheet-t"></span>
    <span class="tag"></span><button class="sheet-x" type="button" aria-label="关闭">×</button></div>
  <div class="sheet-bd"></div>
</div>

<script>
(function(){
  /* 埋点 —— 跟站点其它页打同一个 /analytics（产品 learn_ai），
     visitor_id 复用同一个 localStorage 键 la-vid，不然 UV 会把同一个人数两遍。
     这一页是自包含的、不引 assets/app.js，所以这段是照着它抄过来的一份。
     不引第三方脚本、不放 cookie。 */
  var TRACK_URL='/analytics/api/events';
  var VID=(function(){
    try{
      var v=localStorage.getItem('la-vid');
      if(!v){ v=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2)+Date.now().toString(36));
              localStorage.setItem('la-vid',v); }
      return v;
    }catch(e){ return ''; }        // 隐私模式下取不到就退回服务端的 hash(ip|ua)
  })();
  function track(event,extra){
    try{
      var d={product:'learn_ai',event:event,visitor_id:VID,
             path:location.pathname,referrer:document.referrer};
      for(var k in extra)d[k]=extra[k];
      var body=JSON.stringify(d);
      if(navigator.sendBeacon)navigator.sendBeacon(TRACK_URL,new Blob([body],{type:'application/json'}));
      else fetch(TRACK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true});
    }catch(e){ /* 统计失败不能影响页面 */ }
  }
  track('page_view');

  /* 阅读进度：25/50/75/100 各打一次 —— 一篇论文全文摊在这儿，
     光看 PV 分不出「点进来就走」和「真读完了」。 */
  (function(){
    var doc=document.querySelector('.paper'), hit={};
    if(!doc)return;
    addEventListener('scroll',function(){
      var r=doc.getBoundingClientRect();
      var seen=Math.min(1,Math.max(0,(innerHeight-r.top)/r.height))*100;
      [25,50,75,100].forEach(function(m){ if(seen>=m&&!hit[m]){ hit[m]=1; track('read_progress',{detail:m+'%'}); } });
    },{passive:true});
  })();

  // 刷新后的落点交给浏览器（现在布局稳定了，恢复得准）。
  // 只处理带 #锚点 的情况：图片解码完布局会再变一次，所以 load 之后补一帧。
  function place(){
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    if (el) el.scrollIntoView();
  }
  if (location.hash) addEventListener('load', function(){ place(); requestAnimationFrame(place); });

  // 目录高亮
  var links=[].slice.call(document.querySelectorAll('[data-ol]'));
  var io=new IntersectionObserver(function(es){es.forEach(function(en){
    if(!en.isIntersecting)return;
    links.forEach(function(a){a.classList.toggle('on',a.dataset.ol===en.target.id);});
  });},{rootMargin:'-130px 0px -70% 0px'});
  document.querySelectorAll('.ph').forEach(function(h){io.observe(h);});

  /* ---- 顶部三个视图：论文 / 两张全景图 ---- */
  var view='paper', scrollAt={}, VKEY='aiayn-view';
  var mem={ get:function(){try{return sessionStorage.getItem(VKEY)}catch(e){return null}},
            set:function(v){try{sessionStorage.setItem(VKEY,v)}catch(e){}} };
  function showView(v){
    if(v===view)return;
    // 抽屉开着时 body 是 fixed 的，scrollY 恒为 0 —— 先关掉，记下来的位置才是真的
    if(typeof sheet!=='undefined'&&sheet&&sheetOn())closeSheet();
    scrollAt[view]=scrollY;                      // 切走前记住位置，切回来还在原处
    view=v; document.body.dataset.view=v; mem.set(v); track('tab_view',{detail:v});
    document.querySelectorAll('.mapview,.resview,.docview').forEach(function(el){
      el.classList.toggle('on', el.id==='view-'+v);
    });
    document.querySelectorAll('.tb').forEach(function(b){
      var on=b.dataset.v===v; b.classList.toggle('on',on); b.setAttribute('aria-selected',String(on));
    });
    void document.documentElement.scrollHeight;   // 先让新视图排完版，否则位置会被旧高度截掉
    scrollTo(0,scrollAt[v]||0);
  }
  document.body.dataset.view='paper';
  // 刷新之后停在原来那个 tab —— 只记在本次会话里，重新打开还是从论文开始
  var saved=mem.get();
  if(saved&&saved!=='paper'&&document.getElementById('view-'+saved))showView(saved);
  document.addEventListener('click',function(e){
    var b=e.target.closest('.tb'); if(b){showView(b.dataset.v);return;}
    var a=e.target.closest('a[href^="#map-"]'); if(a){showView(a.getAttribute('href').slice(1));}
  });
  if(/^#map-\d/.test(location.hash))showView(location.hash.slice(1));

  /* ---- 资源 tab：iframe 点了才建，章节按钮直接跳到那一秒 ---- */
  document.querySelectorAll('.vcard').forEach(function(card){
    var bv=card.dataset.bv, id=card.dataset.yt, wrap=card.querySelector('.vwrap');
    function play(t){
      var f=wrap.querySelector('iframe');
      if(!f){
        f=document.createElement('iframe');
        f.allow='accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture';
        f.setAttribute('allowfullscreen',''); f.setAttribute('title',bv?'哔哩哔哩':'YouTube');
        f.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
        f.setAttribute('scrolling','no'); f.setAttribute('frameborder','0');
        wrap.innerHTML=''; wrap.appendChild(f);
      }
      f.src = bv
        ? 'https://player.bilibili.com/player.html?bvid='+bv+'&p=1&autoplay=1&high_quality=1&danmaku=0&t='+(t||0)
        : 'https://www.youtube-nocookie.com/embed/'+id+'?rel=0&autoplay=1&start='+(t||0);
      track('res_play',{detail:(bv||id)+'@'+(t||0)});
    }
    var btn=card.querySelector('.vplay');
    if(btn)btn.addEventListener('click',function(){play(0);});
    card.querySelectorAll('.vch').forEach(function(b){
      b.addEventListener('click',function(){
        play(+b.dataset.t);
        card.querySelectorAll('.vch').forEach(function(x){x.classList.toggle('on',x===b);});
      });
    });
  });

  /* ---- 截图灯箱：左右可切，切的范围是同一个视频下面那一组 ---- */
  var lb=document.getElementById('lightbox');
  if(lb){
    var lbList=[], lbAt=-1;
    function lbShow(i){
      if(!lbList.length)return;
      lbAt=(i+lbList.length)%lbList.length;
      var im=lbList[lbAt], big=lb.querySelector('img');
      big.src=im.dataset.full; big.alt=im.alt;
      lb.querySelector('figcaption').textContent=
        im.alt+(lbList.length>1?'　·　'+(lbAt+1)+' / '+lbList.length:'');
      lb.querySelectorAll('.lb-nav').forEach(function(b){ b.hidden=lbList.length<2; });
      track('res_shot',{detail:im.dataset.full.split('/').pop()});
    }
    document.addEventListener('click',function(e){
      var im=e.target.closest('.shot img');
      if(im){
        lbList=[].slice.call(im.closest('.shots').querySelectorAll('img'));
        lb.classList.add('on'); lbShow(lbList.indexOf(im)); return;
      }
      if(!lb.classList.contains('on'))return;
      var nav=e.target.closest('.lb-nav');
      if(nav){ lbShow(lbAt+(nav.classList.contains('lb-next')?1:-1)); return; }
      lb.classList.remove('on');                       // 点图外任何地方都关
    });
    addEventListener('keydown',function(e){
      if(!lb.classList.contains('on'))return;
      if(e.key==='Escape'){ lb.classList.remove('on'); }
      else if(e.key==='ArrowRight'){ e.preventDefault(); lbShow(lbAt+1); }
      else if(e.key==='ArrowLeft'){ e.preventDefault(); lbShow(lbAt-1); }
    });
  }

  /* ---- 手机：批注从底部推上来 ---- */
  var sheet=document.getElementById('sheet'), scrim=document.getElementById('scrim');
  var phone=matchMedia('(max-width:859px)');
  function sheetOn(){ return sheet.classList.contains('on'); }
  /* 背景不动，靠的是「什么都不改」：正文始终在文档流里，一个像素都不重排。
     滚动只是被拦住 —— 遮罩上 touch-action:none 挡手势，这里再挡一次滚轮
     （窄窗口用鼠标的情况），抽屉内部由 overscroll-behavior:contain 兜住。
     之前那版给 body 加 position:fixed + top:-scrollY，位置是对的，但 body
     进出文档流各触发一次整页重排，开一下关一下就闪两下。 */
  function eatWheel(e){ e.preventDefault(); }
  function closeSheet(){
    sheet.classList.remove('on'); scrim.classList.remove('on');
    scrim.removeEventListener('wheel',eatWheel);
    document.querySelectorAll('mark.on').forEach(function(m){m.classList.remove('on');});
  }
  function openSheet(nt){
    var q=nt.querySelector('.nt-q');
    sheet.querySelector('.num').textContent=q.querySelector('.num').textContent;
    sheet.querySelector('.num').style.background=getComputedStyle(q.querySelector('.num')).backgroundColor;
    sheet.querySelector('.num').style.color=getComputedStyle(q.querySelector('.num')).color;
    sheet.querySelector('.qt').textContent=q.querySelector('.qt').textContent;
    sheet.querySelector('.tag').textContent=q.querySelector('.tag').textContent;
    // 图是按卡片宽度画的，这里整段克隆过来，尺寸交给 CSS
    sheet.querySelector('.sheet-bd').innerHTML=nt.querySelector('.nt-a').innerHTML;
    sheet.querySelector('.sheet-bd').scrollTop=0;
    sheet.classList.add('on'); scrim.classList.add('on');
    scrim.addEventListener('wheel',eatWheel,{passive:false});
  }
  scrim.addEventListener('click',closeSheet);
  sheet.querySelector('.sheet-x').addEventListener('click',closeSheet);
  addEventListener('keydown',function(e){ if(e.key==='Escape'&&sheetOn())closeSheet(); });
  // 往下一拖就关
  var y0=null;
  sheet.addEventListener('touchstart',function(e){ y0=e.touches[0].clientY; },{passive:true});
  sheet.addEventListener('touchend',function(e){
    if(y0!==null&&e.changedTouches[0].clientY-y0>70&&sheet.querySelector('.sheet-bd').scrollTop<=0)closeSheet();
    y0=null;
  },{passive:true});

  function openNote(nt,on){
    nt.classList.toggle('open',on); nt.classList.toggle('on',on);
    var mk=document.querySelector('mark[data-n="'+nt.dataset.n+'"]');
    if(mk)mk.classList.toggle('on',on);
  }

  document.addEventListener('click',function(e){
    var mk=e.target.closest('mark[data-n]');
    if(mk){
      var nt=document.querySelector('.nt[data-n="'+mk.dataset.n+'"]');
      if(nt&&phone.matches&&!document.body.classList.contains('notes-inline')){
        document.querySelectorAll('mark.on').forEach(function(m){m.classList.remove('on');});
        mk.classList.add('on'); openSheet(nt); track('note_open',{detail:nt.dataset.n});
        e.preventDefault(); return;
      }
      if(nt){
        var was=nt.classList.contains('open');
        document.querySelectorAll('.nt.open').forEach(function(n){if(n!==nt)openNote(n,false);});
        openNote(nt,!was);
        // 只记从正文点开的那一次；「展开全部批注」会一口气调 66 次 openNote，不能算
        if(!was)track('note_open',{detail:nt.dataset.n});
        if(!was)nt.scrollIntoView({block:'nearest'});
      }
      e.preventDefault(); return;
    }
    var q=e.target.closest('.nt-q');
    if(q){ openNote(q.parentElement,!q.parentElement.classList.contains('open')); return; }
    // 点引用编号先把折叠的参考文献打开
    var cite=e.target.closest('a[href^="#bib.bib"]');
    if(cite){ var d=document.querySelector('.refs'); if(d)d.open=true; }
  });

  function sw(el,cls,fn){ el.addEventListener('click',function(){
    var on=el.getAttribute('aria-pressed')==='false';
    el.setAttribute('aria-pressed',String(on));
    if(cls)document.body.classList.toggle(cls,on);
    if(fn)fn(on);
  });}
  sw(document.getElementById('sw-all'),null,function(on){
    // 手机上默认不在正文里插卡片，展开全部就等于把它们摊回来
    document.body.classList.toggle('notes-inline',on);
    if(on&&sheetOn())closeSheet();
    document.querySelectorAll('.nt').forEach(function(n){openNote(n,on);});
  });
  // 隐藏批注：连高亮和段落底色一起收掉，页面回到一份干净的论文
  sw(document.getElementById('sw-off'),'no-notes',function(on){
    var all=document.getElementById('sw-all');
    all.disabled=on; all.style.opacity=on?.4:1;
    if(on){document.querySelectorAll('.nt').forEach(function(n){openNote(n,false);});
      document.body.classList.remove('notes-inline');
      if(sheetOn())closeSheet();
      all.setAttribute('aria-pressed','false');}
  });
})();
</script>
</body></html>`;
}

/* ══════════════════ 样式 ══════════════════ */

const CSS = `
:root{--accent:#0F766E;--accent-soft:#E6F4F1;--accent-line:#B8DED8;--accent-ink:#0B5750;
--bg:#FBFAF8;--bg-elev:#FFF;--bg-sunken:#F3F1ED;--bg-hover:#F1EFEA;
--text:#14161A;--text-2:#4E5560;--text-3:#868D98;--line:#E4E1DA;--line-soft:#EFEDE7;
--warn:#B45309;--warn-soft:#FEF6E7;--key:#C0564E;--mk:#FBEFC0;--mk-on:#F7E08A;--mk-line:#DDBE6A;
--shadow-sm:0 1px 2px rgba(20,22,26,.05);--r-sm:6px;--r-md:10px;--r-full:999px;--topbar-h:56px;
--sans:-apple-system,BlinkMacSystemFont,"SF Pro SC","PingFang SC",system-ui,sans-serif;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Songti SC",serif;
--mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 var(--sans);-webkit-font-smoothing:antialiased;padding-bottom:80px}
a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:left}
h1,h2,h3,h4{margin:0;font-weight:650;letter-spacing:-.01em}
.wrap{max-width:1440px;margin:0 auto;padding:0 24px}
.topbar{position:sticky;top:0;z-index:60;height:var(--topbar-h);background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.topbar .wrap{height:100%;display:flex;align-items:center;gap:14px}
.back{color:var(--text-2);font-size:13px}
.src-flag{margin-left:auto;font-size:12px;color:var(--text-3);border:1px solid var(--line);background:var(--bg-elev);padding:3px 9px;border-radius:var(--r-full)}
.ep-head{padding:30px 0 8px;max-width:900px}
.ep-kicker{display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--text-3)}
/* flex:none —— 不然窄屏上后半段挤过来，药丸会被压得从「论文」中间断成两行 */
.ep-kicker .topic{flex:none;white-space:nowrap;background:var(--accent-soft);color:var(--accent-ink);padding:2px 9px;border-radius:var(--r-full);font-weight:600}
.ep-head h1{font-size:29px;line-height:1.25;margin:12px 0 0}
.ep-head h1 .nb{white-space:nowrap}
.ep-head h1 em{display:block;font-style:normal;font-size:16.5px;font-weight:400;color:var(--text-2);margin-top:8px}
.ep-meta{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:13px;font-size:13px;color:var(--text-3)}
.ep-meta b{font-weight:600;color:var(--text);font-variant-numeric:tabular-nums}
.bar{position:sticky;top:var(--topbar-h);z-index:50;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);margin-top:10px}
.bar .wrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 24px}
.swbox{margin-left:auto;display:flex;gap:9px}
/* 图例：四类批注各一色，外加划重点的波浪线 */
.legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--text-2)}
.lg{display:inline-flex;align-items:center;gap:5px;cursor:default}
.lg i{width:13px;height:13px;border-radius:3px;border:1px solid transparent;flex:none}
.lg .key{color:var(--text-2)}
/* .key 的 padding-bottom 会把盒子撑高，flex 居中后这一项就比别人高一截；
   用等量负 margin 抵掉，让它和色块那几项对齐 */
.lg .key{margin-bottom:-8px}
.sw{display:inline-flex;align-items:center;gap:7px;padding:5px 12px 5px 9px;border:1px solid var(--line);border-radius:var(--r-full);font-size:13px;color:var(--text-2);background:var(--bg-elev)}
.sw:hover{background:var(--bg-hover);color:var(--text)}
.sw i{width:26px;height:15px;border-radius:var(--r-full);background:var(--line);position:relative;flex:none;transition:background .15s}
.sw i::after{content:"";position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:var(--shadow-sm);transition:transform .15s}
.sw[aria-pressed="true"]{color:var(--accent-ink);border-color:var(--accent-line);background:var(--accent-soft)}
.sw[aria-pressed="true"] i{background:var(--accent)}
.sw[aria-pressed="true"] i::after{transform:translateX(11px)}
.bar .sp{margin-left:auto;font-size:12.5px;color:var(--text-3)}
/* 单列时也要显式写 minmax(0,1fr)：不写的话隐式列按 max-content 撑，
   正文里任何一个宽块（全景图、表格）都会把整页顶出横向滚动条 */
.main{display:grid;grid-template-columns:minmax(0,1fr);gap:34px;padding-top:26px}
@media(min-width:1000px){.main{grid-template-columns:210px minmax(0,1fr)}}
/* 顶部三个 tab：论文 / 两张全景图。图有 1560 宽，跟正文并排就会压到目录上，
   所以不并排 —— 切到图，正文和目录一起收起，整幅让给图 */
.tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tb{font:inherit;font-size:13px;color:var(--text-2);background:var(--bg-elev);cursor:pointer;
  border:1px solid var(--line);border-radius:var(--r-full);padding:5px 14px;white-space:nowrap}
.tb:hover{background:var(--bg-hover);color:var(--text)}
.tb.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.mapview{display:none}
.mapview .pbox{overflow-x:auto;overscroll-behavior-x:contain}
.mapview .pin{min-width:1040px}
.mapview svg{display:block;width:100%;height:auto}
.mapview .pcap{display:flex;gap:12px;align-items:baseline;margin:12px 0 0;
  font-size:12.5px;color:var(--text-3)}
.phint{margin-left:auto;white-space:nowrap}
/* 哪个视图显示，交给 JS 打的 .on —— tab 是按数据生成的，这里不写死几张图 */
.mapview.on,.resview.on{display:block}
/* 看图 / 看资源时正文、目录、批注开关都收起来 */
body[data-view^="map"] .toc,body[data-view^="map"] .paper,
body[data-view^="map"] .legend,body[data-view^="map"] .swbox,
body[data-view^="doc"] .toc,body[data-view^="doc"] .paper,
body[data-view^="doc"] .legend,body[data-view^="doc"] .swbox,
body[data-view="res"] .toc,body[data-view="res"] .paper,
body[data-view="res"] .legend,body[data-view="res"] .swbox{display:none}
/* 正文要 26px 的天头，图不要 —— 图自己已经有一圈留白，两份叠起来就空出一条 */
body[data-view^="map"] .main,body[data-view="res"] .main,
body[data-view^="doc"] .main{grid-template-columns:minmax(0,1fr);padding-top:8px}

/* ══ 独立内容 tab ══ */
.docview{display:none}
.docview.on{display:block}
.doc{max-width:760px;margin:0 auto;padding:8px 0 64px;font-size:15px;line-height:1.75;color:var(--text-2)}
.doc>h2{margin:38px 0 4px;font-size:20px;line-height:1.35;font-weight:650;color:var(--text);letter-spacing:-.2px}
.doc>h2:first-child{margin-top:6px}
.doc>h3{margin:26px 0 4px;font-size:16px;font-weight:650;color:var(--text)}
.doc>p.lede{margin:0 0 26px;font-size:15px;color:var(--text-3)}
.doc p{margin:0 0 12px}
.doc b{color:var(--text);font-weight:600}
.doc ul,.doc ol{margin:0 0 14px;padding-left:1.2em}
.doc li{margin-bottom:6px}
.doc a{color:var(--accent-ink);text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:.5px}
.doc hr{border:0;border-top:1px solid var(--line-soft);margin:34px 0}
.doc svg{display:block;width:100%;height:auto;margin:14px 0 6px}
.doc figure{margin:18px 0 22px}
.doc figcaption{margin-top:6px;font-size:13px;color:var(--text-3)}
.doc p.fnote{margin:-10px 0 18px;font-size:12.5px;line-height:1.6;color:var(--text-3)}
.doc table{width:100%;border-collapse:collapse;margin:6px 0 18px;font-size:13.5px}
.doc thead th{text-align:left;font-weight:600;color:var(--text-3);font-size:12px;
  padding:0 10px 6px 0;border-bottom:1px solid var(--line)}
.doc td{padding:7px 10px 7px 0;border-bottom:1px solid var(--line-soft);vertical-align:top}
.doc tr:last-child td{border-bottom:0}
.doc td.n{font-family:var(--mono);font-size:12.5px;white-space:nowrap;color:var(--text)}
.doc .eg{margin:6px 0 16px;padding:11px 13px;background:var(--bg-sunken);border-radius:var(--r-sm);
  font:12.5px/1.65 var(--mono);color:var(--text-2);white-space:pre;overflow-x:auto}
.doc .callout{margin:16px 0;padding:13px 15px;background:var(--accent-soft);
  border-radius:var(--r-md);font-size:14px;color:var(--accent-ink)}
.doc .callout b{color:var(--accent-ink)}
.doc .warnout{margin:16px 0;padding:13px 15px;background:var(--warn-soft);
  border-radius:var(--r-md);font-size:14px;color:#7A3A06}
.doc .warnout b{color:#7A3A06}
@media (max-width:640px){
  .doc table{display:block;overflow-x:auto;width:max-content;min-width:100%;max-width:100%}
  .doc th,.doc td{min-width:5.5em}
  .doc td:last-child,.doc th:last-child{min-width:12em}
}
@media(max-width:900px){.doc{padding:4px 0 48px}}

/* ══ 资源 tab ══ */
.resview{display:none}
.resview .area-note{margin:0 0 20px;max-width:760px}
.res-sec{max-width:1040px}
.res-sec+.res-sec{margin-top:34px}
.res-h{font-size:12px;color:var(--text-3);font-weight:600;letter-spacing:.06em;
  padding-bottom:8px;margin-bottom:2px;border-bottom:1px solid var(--line)}
/* 工具只是个链接引用，没有播放器也没有章节，卡片就矮一截 */
.rcard h4{font-size:16px;line-height:1.4}
.rcard h4 a:hover{color:var(--accent)}
.vcard{border:1px solid var(--line);border-radius:var(--r-md);background:var(--bg-elev);
  padding:18px 20px}
.vcard+.vcard{margin-top:18px}
.vhd h4{font-size:16px;line-height:1.4}
.vhd h4 a:hover{color:var(--accent)}
.vzh{margin:7px 0 0;font-size:13.5px;color:var(--text-2);line-height:1.6}
.vmeta{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:9px 0 0;
  font-size:12.5px;color:var(--text-3)}
.vmeta .vsrc{background:var(--accent-soft);color:var(--accent-ink);font-weight:600;
  padding:2px 9px;border-radius:var(--r-full)}
.vmeta time{font-variant-numeric:tabular-nums}
.vmeta a{color:var(--text-2);border-bottom:1px solid var(--line)}
.vmeta a:hover{color:var(--accent);border-color:var(--accent-line)}
.vbody{display:grid;gap:16px;margin-top:15px}
@media(min-width:820px){.vbody{grid-template-columns:minmax(0,1.35fr) minmax(240px,1fr)}}
.vwrap{position:relative;aspect-ratio:16/9;border-radius:var(--r-sm);overflow:hidden;
  background:var(--bg-sunken);border:1px solid var(--line)}
.vwrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.vplay{position:absolute;inset:0;width:100%;height:100%;padding:0;cursor:pointer;
  background-size:cover;background-position:center;display:flex;
  align-items:center;justify-content:center}
.vplay::before{content:"";position:absolute;inset:0;background:rgba(20,22,26,.45);transition:background .15s}
.vplay:hover::before{background:rgba(20,22,26,.32)}
.vtri{position:relative;width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.94);
  box-shadow:0 2px 12px rgba(20,22,26,.3)}
.vtri::after{content:"";position:absolute;top:50%;left:52%;transform:translate(-50%,-50%);
  border-style:solid;border-width:9px 0 9px 15px;border-color:transparent transparent transparent #14161A}
.vchap{margin:0;padding:0;list-style:none;max-height:min(46vh,320px);overflow:auto;
  overscroll-behavior:contain;border:1px solid var(--line-soft);border-radius:var(--r-sm)}
.vchap li+li{border-top:1px solid var(--line-soft)}
.vchap button{display:flex;gap:10px;width:100%;padding:7px 11px;font-size:12.5px;
  color:var(--text-2);line-height:1.45}
.vchap button b{flex:none;font:12px/1.45 var(--mono);color:var(--accent);font-weight:600;
  font-variant-numeric:tabular-nums}
.vchap button:hover{background:var(--bg-hover);color:var(--text)}
.vchap button.on{background:var(--accent-soft);color:var(--accent-ink)}
.vchap button.on b{color:var(--accent-ink)}
.vshots{margin-top:15px;border-top:1px solid var(--line-soft);padding-top:12px}
.vshots summary{cursor:pointer;font-size:12.5px;color:var(--text-2);display:flex;gap:8px;align-items:baseline}
.vshots summary span{font-size:11.5px;color:var(--text-3)}
.vshots summary:hover{color:var(--accent)}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-top:12px}
.shot{margin:0}
.shot img{display:block;width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;
  border-radius:var(--r-sm);border:1px solid var(--line);cursor:zoom-in;background:var(--bg-sunken)}
.shot img:hover{border-color:var(--accent-line)}
/* 缩略图统一裁成一个比例，这一排的说明才在同一条线上；点开是没裁过的原图 */
.shot figcaption{margin-top:5px;text-align:left;font-size:11.5px;color:var(--text-3);line-height:1.45}
.shot figcaption i{display:block;font-style:normal;font-size:10.5px;color:var(--accent);
  letter-spacing:.03em;font-weight:600}
.lb{position:fixed;inset:0;z-index:70;background:rgba(20,22,26,.86);display:none;
  align-items:center;justify-content:center;padding:28px;cursor:zoom-out}
.lb.on{display:flex}
.lb figure{margin:0;max-width:min(1400px,100%);max-height:100%;display:flex;
  flex-direction:column;gap:10px;align-items:center}
.lb img{max-width:100%;max-height:calc(100vh - 100px);object-fit:contain;border-radius:var(--r-sm)}
.lb figcaption{font-size:12.5px;color:rgba(255,255,255,.78);text-align:center}
.lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;flex:none;
  border-radius:50%;background:rgba(255,255,255,.13);color:#fff;font-size:26px;line-height:1;
  display:flex;align-items:center;justify-content:center;cursor:pointer;padding-bottom:3px}
.lb-nav:hover{background:rgba(255,255,255,.3)}
.lb-nav[hidden]{display:none}
.lb-prev{left:16px}.lb-next{right:16px}
@media(max-width:640px){.lb-nav{width:38px;height:38px;font-size:22px}.lb-prev{left:6px}.lb-next{right:6px}}
.toc{display:none}
@media(min-width:1000px){.toc{display:block;position:sticky;top:calc(var(--topbar-h) + 54px);align-self:start;max-height:calc(100vh - 150px);overflow:auto}}
.toc h4{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3);margin-bottom:10px}
.toc a{display:block;padding:4px 8px;border-radius:var(--r-sm);font-size:12.5px;color:var(--text-2);border-left:2px solid transparent}
.toc a:hover{background:var(--bg-hover);color:var(--text)}
.toc a.on{color:var(--accent);background:var(--accent-soft);border-left-color:var(--accent);font-weight:600}
.toc .sub{padding-left:16px;font-size:12px}
.paper{max-width:1080px}
.front,.ph,.eqbox,.floatbox,.refs{max-width:calc(100% - 322px)}
.front{text-align:center;padding:6px 0 22px;border-bottom:1px solid var(--line);margin-bottom:10px}
.ptitle{font:600 27px/1.3 var(--serif)}
.agrid{margin-top:18px;display:flex;flex-direction:column;gap:10px}
.arow{display:flex;justify-content:center;gap:26px;flex-wrap:wrap}
.acell{display:flex;flex-direction:column;gap:1px;min-width:150px}
.acell .an{font:600 13.5px/1.5 var(--serif);color:var(--text)}
.acell .aa{font:12px/1.5 var(--sans);color:var(--text-3)}
.acell .ae{font:11.5px/1.5 var(--mono);color:var(--text-3);opacity:.8}
.acell .amk{font-size:.72em;vertical-align:super;color:var(--text-3);margin-left:1px}
/* 首页页脚：论文里在正文下方、一条短横线之后 */
.fnotes{margin:26px auto 0;max-width:720px;text-align:left;padding-top:12px;position:relative}
.fnotes::before{content:"";position:absolute;top:0;left:0;width:150px;height:1px;background:var(--line)}
.fnotes p{margin:0 0 5px;font:11.5px/1.65 var(--serif);color:var(--text-3);text-indent:1.2em}
.fnotes sup{font-size:.9em;margin-right:2px}
.ph{font:650 19px/1.3 var(--sans);margin:34px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line);scroll-margin-top:130px}
h3.ph{font-size:16px;margin-top:26px;border-bottom-color:var(--line-soft)}
/* 段落级标题：论文里是接在正文前面的粗体小标题，不带横线 */
h4.ph{font:650 14.5px/1.4 var(--serif);margin:20px 0 2px;padding-bottom:0;border-bottom:0;color:var(--text)}
.hn{font-family:var(--mono);font-size:.8em;color:var(--accent);margin-right:10px}
.blk{display:grid;gap:6px 26px;margin-bottom:4px;position:relative}
/* 不用 content-visibility：屏外块的高度只是估算，滚动位置会随渲染漂移，刷新后落点乱跑 */
html{overflow-anchor:none}
@media(min-width:1200px){.blk{grid-template-columns:minmax(0,1fr) 296px;align-items:start}
.side{grid-column:2;grid-row:1/span 3;position:sticky;top:calc(var(--topbar-h) + 62px)}
/* 标题批注复用正文两栏，但标题不能再套全页级的减宽；卡片与 h3 顶部对齐。 */
.hblk>.ph{max-width:none;grid-column:1}
.hblk>.side{padding-top:26px}}
.pp{margin:0;font:16px/1.78 var(--serif);color:#1B1E24;padding:6px 0 6px 22px;
  border-left:2px solid transparent;overflow-wrap:break-word}
/* 论文里那条 tensor2tensor 长网址一个断点都没有，break-word 也断不开（它不改最小内容宽度）。
   只给链接开 anywhere：手机上不这么做，整页就被这一行顶出横向滚动条 */
.pp a.ltx_url,.nt-a a,.sheet-bd a{overflow-wrap:anywhere}
.blk.hot .pp{border-left-color:var(--accent-line);background:linear-gradient(90deg,rgba(230,244,241,.5),transparent 60%)}
/* itemize：原件的 • 在 <li> 上，段落被单拎出来后就丢了，这里补回去 */
.blk.li .pp{position:relative;padding-left:52px}
.blk.li .pp::before{content:"•";position:absolute;left:30px;color:var(--text-3)}
.lxa{display:block;height:0;scroll-margin-top:130px}
.dot{position:absolute;left:0;top:12px;width:16px;height:16px;border-radius:50%;background:var(--accent-soft);border:1px solid var(--accent-line);color:var(--accent-ink);font:10px/14px var(--mono);text-align:center}
/* 划重点：偏红的波浪线，和批注的黄绿紫底色分得开。
   不用 text-decoration:wavy —— 那个的波长由浏览器定死，只能调线宽，密得像锯齿。
   改成自绘的一段波形铺底，波长（background-size 的宽）就能自己定。 */
.key{text-decoration:none;padding-bottom:8px;
  background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='15' height='8' viewBox='0 0 15 8'><path d='M0 4 Q 3.75 0 7.5 4 T 15 4' fill='none' stroke='%23C0564E' stroke-width='2' stroke-linecap='round'/></svg>") repeat-x 0 100%}
/* 波长 = svg 的 width（15），波幅 = 控制点偏移的一半（基线 4、控制点 0 → 偏移 4 → 幅 2） */
mark{background:var(--mk);border-bottom:1px solid var(--mk-line);border-radius:2px;padding:0 1px;cursor:pointer;color:inherit}
mark:hover{filter:brightness(.96)}
mark.on{box-shadow:0 0 0 2px rgba(20,22,26,.14)}
mark>sup{font:9.5px var(--mono);vertical-align:super;opacity:.85}
${Object.entries(KINDS).map(([k, v]) => `mark[data-k="${k}"]{background:${v.c};border-bottom-color:${v.ln}}
mark[data-k="${k}"]>sup{color:${v.ink}}
.num[data-k="${k}"]{background:${v.c};color:${v.ink}}
.tag[data-k="${k}"]{color:${v.ink};border-color:${v.ln};background:${v.c}66}`).join('\n')}
/* 图例 */
.legend{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
.legend i{font-style:normal;font-size:11.5px;padding:2px 9px;border-radius:var(--r-full);border:1px solid transparent}

/* 来源 HTML 自带的标记 */
.pp math{font-size:1em}
.eqbox{margin:18px 0 18px 22px;padding:14px 8px;background:color-mix(in srgb,var(--bg-elev) 45%,transparent);border:1px solid var(--line-soft);border-radius:var(--r-md);overflow-x:auto}
.eqbox table{margin:0 auto;border-collapse:collapse}
.eqbox math{font-size:1.1rem}
.ltx_eqn_cell{padding:2px 6px}
.ltx_eqn_center_padleft,.ltx_eqn_center_padright{width:20px}
.ltx_tag_equation{font:12px var(--mono);color:var(--text-3)}
.floatbox{margin:20px 0 20px 22px;text-align:center;overflow-x:auto}
.floatbox figure{margin:0}
/* 带批注的图：网格已经留出旁注列，图自己就不用再减宽度了 */
.blk.float{align-items:start}
.blk.float .floatbox{max-width:none;margin-left:22px}   /* <figure> 的浏览器默认左右各 40px 边距，会把容器顶出滚动条 */
.floatbox.rot{overflow:visible}
.floatbox.sxs figure{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;justify-content:center}
.floatbox.sxs img{min-width:0;width:auto;max-width:none;max-height:none;align-self:flex-start}
/* 源里带 ltx_fig_right 的是右幅，但它在 DOM 里排在前面，按图注的 (Left)/(Right) 摆回去 */
.floatbox.sxs img.ltx_fig_right{order:2}
.floatbox.sxs figcaption{flex:1 0 100%;order:3}
@media (max-width:860px){.floatbox.sxs figure{display:block}.floatbox.sxs img{max-height:600px}}
/* 图 1 原图 912×1344，铺满一屏还多，限高压一压；横图不受影响 */
.floatbox img{max-width:100%;max-height:600px;width:auto;height:auto;background:#fff;border:1px solid var(--line);border-radius:var(--r-md);padding:12px}
/* 图 2 是两块并排的 panel，原件用 ltx_flex_figure 表达，这里给它真的 flex —— 竖着堆太占地方 */
.ltx_flex_figure{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:56px}
.ltx_flex_cell{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:56px}
.ltx_figure_panel{width:auto!important;max-width:100%;display:flex;flex-direction:column;align-items:center;gap:8px}
.ltx_figure_panel>p{margin:0;font:13px/1.5 var(--serif);color:var(--text-2)}
.ltx_figure_panel img{max-height:400px;width:auto}
/* 图片本身已经转正，控高直接写 max-height */
.floatbox.rot img{max-height:470px;width:auto}
/* 图内的两块并排：ltx_flex_break 是原件用来强制换行的，横排就得让它失效；
   高度写死，两块才严格等高 */
.floatbox.rot .ltx_flex_figure{flex-wrap:nowrap;align-items:flex-start;gap:20px}
.floatbox.rot .ltx_flex_break{display:none}
.floatbox.rot .ltx_flex_cell{display:flex;justify-content:center;min-width:0}
.floatbox.rot .ltx_figure_panel{height:400px;max-height:400px;width:auto;max-width:100%}
.floatbox.rot figure{display:flex;flex-direction:column;align-items:center;width:100%}
figcaption,.ltx_caption{margin-top:12px;font:13px/1.65 var(--serif);color:var(--text-2);text-align:center;max-width:min(760px,100%);margin-inline:auto}
.ltx_tag_figure,.ltx_tag_table{font-weight:600;color:var(--text)}
.floatbox table.ltx_tabular{border-collapse:collapse;margin:0 auto;font:13.5px/1.5 var(--serif);background:var(--bg-elev)}
.ltx_tabular td,.ltx_tabular th{padding:6px 12px;white-space:nowrap}
.ltx_border_t{border-top:1px solid var(--line)}
.ltx_border_b{border-bottom:1px solid var(--line)}
.ltx_border_r{border-right:1px solid var(--line-soft)}
.ltx_align_center{text-align:center}.ltx_align_left{text-align:left}.ltx_align_right{text-align:right}
.ltx_font_italic{font-style:italic}.ltx_font_bold{font-weight:650}
.ltx_font_typewriter{font-family:var(--mono);font-size:.92em}
.pp a,.refs a{color:var(--accent)}
.pp a:hover{text-decoration:underline}
.ltx_cite a{font-variant-numeric:tabular-nums}
/* 脚注：正文里只留角标，注文攒到章节末尾 */
.fnm{font-size:.72em;vertical-align:super;color:var(--warn);margin-left:1px}
.fnsec{margin:22px 0 8px 22px;padding-top:10px;position:relative;max-width:calc(100% - 322px)}
.fnsec::before{content:"";position:absolute;top:0;left:0;width:150px;height:1px;background:var(--line)}
.fnsec-h{display:block;font:10.5px var(--mono);letter-spacing:.06em;color:var(--text-3);margin-bottom:5px}
.fnsec p{margin:0 0 6px;font:12.5px/1.7 var(--serif);color:var(--text-3)}
.fnsec sup{color:var(--warn);margin-right:4px}
.ltx_note_outer,.ltx_note_content{display:none}
.sf-hidden{display:none}
.side{display:flex;flex-direction:column;gap:8px;padding-top:6px}
/* 不挂原句的批注：成组摆在章节末尾，或预备/岔路区 */
.nblock{margin:16px 0 22px 22px;max-width:calc(100% - 322px)}
.nb-h{display:flex;align-items:baseline;gap:8px;font:12px var(--mono);color:var(--text-3);margin-bottom:8px;
  padding-top:9px;border-top:1px dashed var(--line)}
.nb-h span{font-size:11px;opacity:.8}
.nb-list{display:grid;gap:7px}
.ph.area{margin-top:44px;border-bottom-width:2px;border-bottom-color:var(--accent-line)}
.ph .n{font:11.5px var(--mono);color:var(--text-3);font-weight:400;margin-left:10px}
.area-note{margin:0 0 4px 22px;max-width:calc(100% - 322px);font-size:13px;color:var(--text-3)}
.nt{border:1px solid var(--line);border-radius:var(--r-md);background:var(--bg-elev);box-shadow:var(--shadow-sm);overflow:hidden}
.nt.on{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.nt-q{display:flex;gap:8px;align-items:flex-start;width:100%;padding:9px 11px;font-size:13px;line-height:1.5}
.nt-q:hover{background:var(--bg-hover)}
.nt-q .num{flex:none;width:17px;height:17px;border-radius:5px;background:var(--mk);color:#8A6512;font:10px/17px var(--mono);text-align:center;margin-top:1px}
.nt-q .qt{font-weight:600;color:var(--text)}
.nt-q .tag{flex:none;font-size:10.5px;color:var(--text-3);border:1px solid var(--line);border-radius:var(--r-full);padding:0 7px;margin-top:2px}
.nt-q .tag.basic{color:var(--warn);border-color:#EBD9B4;background:var(--warn-soft)}
.nt-a{display:none;overflow-wrap:break-word;padding:10px 11px 12px 36px;font-size:13px;line-height:1.7;color:var(--text-2);border-top:1px solid var(--line-soft);
  }
.nt.open .nt-a{display:block}
.nt-a p{margin:0 0 8px}.nt-a b{color:var(--text)}
.nt-a ul{margin:0 0 8px;padding-left:1.1em}.nt-a li{margin-bottom:4px}
/* <ol> 的浏览器默认缩进 40px，序号会比正文缩进一大截；收窄到刚好让数字左缘和正文齐平 */
.nt-a ol{margin:0 0 8px;padding-left:1.5em}
/* 批注里的表：旁注栏只有 296px，浏览器默认的自动布局会把每一列都压到换行，
   「情形」这种两个字的表头都能竖着排。所以一律不折行，放不下就整表横向滚
   —— 和批注 7 的参数表同一套。需要折行的说明列单独标 class="w"。 */
.nt-a table{display:block;overflow-x:auto;width:max-content;min-width:100%;max-width:100%;
  border-collapse:collapse;margin:2px 0 10px;font-size:12.5px;line-height:1.55}
.nt-a td,.nt-a th{white-space:nowrap;vertical-align:top;text-align:left;
  padding:5px 12px 5px 0;border-bottom:1px solid var(--line-soft)}
.nt-a td:last-child,.nt-a th:last-child{padding-right:0}
/* 最后一列几乎总是说明文字，默认让它折行吸收剩余宽度；中间列要折行的另标 .w */
.nt-a td:last-child,.nt-a th:last-child{white-space:normal}
.nt-a tr:first-child td{color:var(--text-3);font-size:11.5px}
.nt-a tr:last-child td{border-bottom:0}
.nt-a td.w{white-space:normal;min-width:9.5em}
/* 整张都是数字、本来就要横向滚的表，末列也别折 —— 折了会把表头撑成三行 */
.nt-a table.nw td:last-child,.nt-a table.nw th:last-child{white-space:nowrap}
/* 批注里的插图：跟着旁注栏的宽度缩放 */
.nt-a svg{display:block;width:100%;height:auto;margin:4px 0 10px}
.mf{font-family:var(--serif);white-space:nowrap}
.mf i{font-style:italic}
.mf sub{font-size:.7em;vertical-align:sub;line-height:0}
.mf sup{font-size:.7em;vertical-align:super;line-height:0}
.nt-a .m{font-family:var(--mono);font-size:.9em;background:var(--bg-sunken);padding:1px 5px;border-radius:4px;
  /* 别 nowrap：旁注栏才 296px 宽，多词的短语会被整体挤到下一行，上一行留一大截空白。
     换行时用 box-decoration-break 让两段各自带上圆角和底色 */
  box-decoration-break:clone;-webkit-box-decoration-break:clone}
.eg{margin:0 0 8px;padding:8px 10px;background:var(--bg-sunken);border-radius:var(--r-sm);
  font:11.5px/1.75 var(--mono);color:var(--text-2);
  /* 例子里的对齐是靠空格排出来的，pre-wrap 一折行就散了 —— 宁可横向滚 */
  white-space:pre;overflow-x:auto;overscroll-behavior-x:contain}
.eg::-webkit-scrollbar{height:6px}
.eg::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
.refs{margin:30px 0 0 22px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--bg-elev);scroll-margin-top:130px}
.refs summary{padding:12px 16px;font:650 15px/1.3 var(--sans);cursor:pointer;display:flex;align-items:center;gap:10px}
.refs summary span{font:12px var(--mono);color:var(--text-3);font-weight:400}
.refs ol{margin:0;padding:0 18px 16px 20px;font:13px/1.7 var(--serif);color:var(--text-2);list-style:none}
.refs li{margin-bottom:8px;scroll-margin-top:130px}
.refs li>details>summary{cursor:pointer;list-style:none;display:block;padding:3px 0}
.refs li>details>summary::-webkit-details-marker{display:none}
.refs li>details[open]>summary{color:var(--text)}
.refs li>details>summary:hover{background:var(--bg-hover);border-radius:4px}
.rl{margin-left:8px;font:11.5px var(--mono);color:var(--accent);white-space:nowrap}
.rn{margin:6px 0 6px 14px;font:13px/1.7 var(--sans);color:var(--text-2)}
.rc{margin:6px 0 10px 14px;padding-left:10px;border-left:2px solid var(--accent-line)}
.rc b{display:block;font:11px var(--mono);color:var(--text-3);font-weight:400;margin-bottom:4px}
.rc p{margin:0 0 5px;font:12.5px/1.65 var(--serif);color:var(--text-2)}
.rc i{font-style:normal;color:var(--accent);margin-right:8px;font-size:11px;font-family:var(--mono)}
.refs li:target{background:var(--mk);border-radius:3px}
.ltx_tag_bibitem{font:12px var(--mono);color:var(--accent);margin-right:6px}
.ltx_bibblock{display:inline}
/* 隐藏批注：高亮、旁注、段落底色、序号一起收掉，只剩论文本身 */
body.no-notes .side,body.no-notes .dot,body.no-notes .nblock{display:none}
body.no-notes mark{background:none;border-bottom:0;cursor:auto}
body.no-notes mark>sup{display:none}
body.no-notes .blk.hot .pp{border-left-color:transparent;background:none}
/* 隐藏批注只收内容，不动版面 —— 两栏网格保持原样，正文宽度不跟着变；
   划重点的波浪线也一起收掉，回到一份干净的论文 */
body.no-notes .key{background:none;padding-bottom:0}
/* 批注全收起来之后，那排颜色图例（含划重点）也就没有对应物了，一起收掉 */
body.no-notes .legend{display:none}
@media(max-width:999px){.ep-head h1{font-size:22px}.pp{font-size:15.5px;padding-left:16px}.dot{display:none}
.front,.ph,.eqbox,.floatbox,.refs{max-width:none;margin-left:16px}
.arow{gap:14px}.side{padding-top:2px;margin:0 0 14px 16px}}

/* ── 手机 ──
   批注卡片插在段落之间，一屏能塞下的正文就没几行了 —— 66 条批注会把文章切成碎片。
   所以 860 以下换一种给法：正文保持干净，点高亮从底部推上来一张卡。
   想一次看完的，顶部「展开全部批注」仍然把卡片摊回正文里。 */
@media(max-width:859px){
  .wrap{padding:0 14px}
  .side{display:none}
  body.notes-inline .side{display:flex}
  .pp{font-size:16px;line-height:1.8;padding-left:12px}
  .front,.ph,.eqbox,.floatbox,.refs{margin-left:0}
  .ep-head h1{font-size:20px}
  /* 出处那行在手机上要折两行，药丸跟着居中会飘到中间，顶对齐才像个标签 */
  .ep-kicker{align-items:flex-start;gap:8px}
  .ep-meta{gap:5px 14px;margin-top:11px;font-size:12px}
  .bar .wrap{padding:8px 14px;gap:8px}
  /* 顶栏在手机上是钉住的，三行就吃掉一屏的六分之一。
     颜色图例让位 —— 每条批注自己带分类标签，不看图例也认得出 */
  .legend{display:none}
  .swbox{margin-left:0}
  .sw{font-size:12px;padding:4px 10px}
}
/* 抽屉本身不限屏宽 —— 桌面端用不到，但样式留着，窗口一窄就能接上。
   背景怎么定住：**什么都不改**。之前给 body 加 position:fixed，body 一脱离
   文档流布局就重算一遍，开一次关一次闪两下。现在正文原地不动，只是拦住
   滚动手势 —— 遮罩上 touch-action:none（配一个 wheel 拦截给窄窗口的鼠标），
   抽屉里 overscroll-behavior:contain 不让滚动链传到底下的正文。 */
.scrim{position:fixed;inset:0;background:rgba(20,22,26,.38);opacity:0;pointer-events:none;
  transition:opacity .18s;z-index:60;touch-action:none}
.scrim.on{opacity:1;pointer-events:auto}
.sheet{position:fixed;left:0;right:0;bottom:0;z-index:61;background:var(--bg-elev);
  border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(20,22,26,.18);
  transform:translateY(102%);transition:transform .22s cubic-bezier(.32,.72,0,1);
  max-height:82vh;display:flex;flex-direction:column;overscroll-behavior:contain}
.sheet.on{transform:none}
.sheet-grab{flex:none;width:38px;height:4px;border-radius:2px;background:var(--line);margin:8px auto 4px;touch-action:none}
.sheet-hd{flex:none;display:flex;gap:9px;align-items:flex-start;padding:6px 16px 10px;
  border-bottom:1px solid var(--line-soft);touch-action:none}
.sheet-hd .num{flex:none;width:19px;height:19px;border-radius:5px;background:var(--mk);color:#8A6512;
  font:11px/19px var(--mono);text-align:center}
.sheet-hd .qt{flex:1;font-size:14.5px;font-weight:650;color:var(--text);line-height:1.45}
.sheet-hd .tag{flex:none;font-size:11px;color:var(--text-3);border:1px solid var(--line);
  border-radius:var(--r-full);padding:1px 8px}
.sheet-x{flex:none;font:inherit;font-size:20px;line-height:1;color:var(--text-3);background:none;
  border:0;cursor:pointer;padding:0 2px}
.sheet-bd{overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:12px 16px 26px;overflow-wrap:break-word;
  font-size:14.5px;line-height:1.75;color:var(--text-2)}
.sheet-bd svg{display:block;width:100%;height:auto;margin:4px 0 10px}
`;

/* ══════════════════ 主流程 ══════════════════ */

const o = args();
const notes = o.notes && existsSync(o.notes) ? JSON.parse(readFileSync(o.notes, 'utf8')) : [];

console.log('· 读来源…');
const src = readFileSync(o.src, 'utf8');
const doc = parse(src);
console.log(`· 标题「${doc.title}」，作者 ${doc.authors.length}，段落 ${doc.items.filter((i) => i.kind === 'p').length}，` +
  `公式 ${doc.items.filter((i) => i.kind === 'eq').length}，图表 ${doc.items.filter((i) => i.kind === 'float').length}，` +
  `标题 ${doc.items.filter((i) => i.kind === 'h').length}，参考文献 ${doc.refs.length}`);

console.log('· 挂批注…');
const blocks = doc.absBlk ? [doc.absBlk, ...doc.items] : doc.items;
const loose = attach(blocks, notes);
console.log(`  行内高亮 ${notes.length - loose.length} 条，散落 ${loose.length} 条 → 章节末 / 预备区 / 岔路区`);

// 划重点
const keys = o.keys && existsSync(o.keys) ? JSON.parse(readFileSync(o.keys, 'utf8')) : [];
if (keys.length) {
  const hit = {};
  for (const b of blocks) {
    if (b.kind !== 'p') continue;
    for (const k of keys) {
      if (!norm(b.html).includes(norm(k))) continue;
      b.html = keyUp(b.html, k);
      hit[k] = (hit[k] || 0) + 1;
    }
  }
  const zero = keys.filter((k) => !hit[k]);
  console.log(`· 划重点 ${keys.length} 条，命中 ${Object.values(hit).reduce((a, b) => a + b, 0)} 处` +
    (zero.length ? `；这些在论文里没找到：${zero.join(' / ')}` : ''));
}

SXS = (o.sxs || '').split(',').map((x) => x.trim()).filter(Boolean);
const refnotes = o.refnotes && existsSync(o.refnotes) ? JSON.parse(readFileSync(o.refnotes, 'utf8')) : {};

// 全景图：--posters a.svg,b.svg，标题直接取图里的 .h1
const posters = (o.posters || '').split(',').filter(Boolean).map((spec) => {
  const [f, label, note] = spec.split('#');      // 路径#tab 标签#一句话说明
  const svg = readFileSync(f.trim(), 'utf8');
  const title = strip((/class="h1"[^>]*>([\s\S]*?)<\/text>/.exec(svg) || [, basename(f)])[1]);
  return { svg, title, label: (label || title).trim(), note: (note || '').trim() };
});
if (posters.length) console.log(`· 全景图 ${posters.length} 张：${posters.map((p) => p.title).join(' / ')}`);

// 资源 tab：--res resources.json（视频 / 文章），没有就不出这个 tab
const res = o.res && existsSync(o.res) ? JSON.parse(readFileSync(o.res, 'utf8')) : null;
if (res) console.log(`· 资源 ${res.videos.length} 个视频，`
  + `${res.videos.reduce((n, v) => n + (v.shots || []).length, 0)} 张截图`);

// 独立内容 tab：--docs a.html#标签#,b.html#标签#
const docs = (o.docs || '').split(',').filter(Boolean).map((spec) => {
  const [f, label] = spec.split('#');
  const html = readFileSync(f.trim(), 'utf8');
  return { html, label: (label || basename(f, '.html')).trim() };
});
if (docs.length) console.log(`· 独立内容 tab ${docs.length} 个：${docs.map((d) => d.label).join(' / ')}`);

const html = render(doc, notes, loose, refnotes, posters, res, docs);
mkdirSync(dirname(o.out), { recursive: true });
writeFileSync(o.out, html);
console.log(`✓ ${o.out}（${(html.length / 1024 / 1024).toFixed(1)} MB）`);
