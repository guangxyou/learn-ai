#!/usr/bin/env node
/**
 * content/ → dist/
 * 纯 Node，无依赖。构建期把 Markdown 编译成静态 HTML，运行时零进程。
 */
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTranscript, parseIndex } from './parse.mjs';
import { renderList, renderEntry, renderSearch, setAssetVersion, wan } from './render.mjs';
import { indexPage } from './search.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_PATH ?? '/learn-ai';
const SITE = {
  url: 'https://xslaoxu.cn',
  desc: '我深度读透过的东西，一条一条留在这里：完整文字稿、可跳播的编年史、能追到原文的索引。',
};
const DIST = join(ROOT, 'dist');
const j = (...p) => join(...p);
let VER = '';

/* 详情页上搜索相关的样式。各页样式表不一样，变量名是同一套，取不到就用后面的默认值 */
const SX_CSS = `<style>
.sx-link{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid var(--line,#E4E1DA);border-radius:999px;font-size:13px;line-height:1.4;color:var(--text-2,#4E5560);background:var(--bg-elev,#fff);text-decoration:none;white-space:nowrap}
.sx-link:hover{color:var(--accent,#0F766E);border-color:var(--accent-line,#B8DED8)}
.wrap:has(>.sx-link){display:flex;align-items:center;gap:14px}
.sx-hl{background:#FDE68A;color:inherit;border-radius:2px;box-shadow:0 0 0 1px #F2CC5B}
.sx-focus{outline:2px solid var(--accent,#0F766E);outline-offset:5px;border-radius:3px;animation:sx-in 1.4s ease-out}
@keyframes sx-in{0%{outline-color:transparent;box-shadow:0 0 0 14px rgba(15,118,110,.18)}40%{outline-color:var(--accent,#0F766E)}100%{box-shadow:0 0 0 0 rgba(15,118,110,0)}}
.sx-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:90;display:flex;align-items:center;gap:2px;padding:4px;max-width:calc(100vw - 32px);background:#14161A;color:#fff;border-radius:999px;box-shadow:0 8px 32px rgba(20,22,26,.25);font:13px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC",system-ui,sans-serif}
.sx-bar.sx-bar-up{bottom:calc(82px + env(safe-area-inset-bottom,0px))}
.sx-bar a,.sx-bar button{color:#fff;font:inherit;background:none;border:0;cursor:pointer;padding:6px 11px;border-radius:999px;white-space:nowrap;text-decoration:none}
.sx-bar a:hover,.sx-bar button:hover{background:rgba(255,255,255,.14)}
.sx-bar .sx-q{overflow:hidden;text-overflow:ellipsis;max-width:42vw}
.sx-bar .sx-pos{font-variant-numeric:tabular-nums;color:rgba(255,255,255,.72);padding:0 2px;min-width:3.6em;text-align:center}
.sx-bar .sx-pos:empty{display:none}
.sx-bar .sx-x{color:rgba(255,255,255,.6);font-size:16px;padding:4px 11px}
@media print{.sx-link,.sx-bar{display:none}}
</style>`;

/** 每个详情页都接上搜索：段落补 id 收进索引，顶栏「全部条目」旁边加一个搜索入口，
 *  页尾挂 search.js —— 从搜索结果点进来时，它负责切 tab、展开、高亮、上一处 / 下一处。 */
function withSearch(html, { base, id, entry, index }) {
  const { html: tagged, chunks } = indexPage(html);
  index.push({ id, title: entry.title, subtitle: entry.subtitle, chunks });
  const link = `<a class="sx-link" href="${base}/search/" aria-label="全站搜索"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.6"/><path d="M10.4 10.4 14 14"/></svg>搜索</a>`;
  let out = tagged.replace(/(<a class="back" href="[^"]*">[^<]*<\/a>)/, `$1${link}`);
  if (out === tagged) console.warn(`[build] ${id} · 没找到「全部条目」链接，搜索入口没加上`);
  out = out.replace(/<\/head>/i, `${SX_CSS}\n</head>`);
  const end = out.lastIndexOf('</body>');
  return out.slice(0, end) + `<script src="${base}/assets/search.js${VER}" defer></script>\n` + out.slice(end);
}


/** 内联图拆成独立文件，发布时才拆。
 *
 *  make-paper 出的 page.html 所有图都是 base64 内联，所有 tab 又在同一个文件里 ——
 *  GPT 那页 23 MB，其中 20 MB 是 134 张图，服务器上行只有 4 Mbps，打开要等半分钟，
 *  而首屏那个 tab 只用得到其中 300 多 KB。
 *
 *  拆出去的文件按内容哈希命名，放 assets/img/，吃 nginx 那条 7 天长缓存。
 *  首屏视图里的 <img> 照常加载（load 事件要等它们，带锚点进来时 place() 才量得准）；
 *  其余一律 loading="lazy"：藏着的 tab 是 display:none，浏览器根本不会去取，
 *  切过去之后也是滚到附近才取。<object> 的 SVG 不用管，没显示出来时本来就不加载。 */
async function unInline(html, { id, base, dist }) {
  // 首屏是服务端打了 .on 的那个视图；一个都没打，就是第一个视图之前的第一篇论文
  const views = [...html.matchAll(/<div class="(?:paperview|docview|mapview|resview)\b([^"]*)" id="view-[^"]+">/g)];
  const on = views.findIndex((m) => /\bon\b/.test(m[1]));
  const [lo, hi] = on >= 0
    ? [views[on].index, views[on + 1]?.index ?? html.length]
    : [0, views[0]?.index ?? html.length];

  await mkdir(j(dist, 'assets', 'img'), { recursive: true });
  const written = new Set();
  let n = 0, lazy = 0, bytes = 0;
  const out = [];
  let at = 0;
  const RE = /(<(img|object)\b[^>]*?\s(?:src|data)=)(["']?)data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)\3/g;
  for (const m of html.matchAll(RE)) {
    const [all, head, tag, , type, b64] = m;
    const buf = Buffer.from(b64, 'base64');
    const name = `${createHash('sha256').update(buf).digest('hex').slice(0, 16)}.${{ jpeg: 'jpg', 'svg+xml': 'svg' }[type] || type}`;
    if (!written.has(name)) { written.add(name); bytes += buf.length; await writeFile(j(dist, 'assets', 'img', name), buf); }
    n++;
    const end = html.indexOf('>', m.index + all.length);   // base64 里没有 >，这就是标签的收尾
    const rest = html.slice(m.index + all.length, end);
    const defer = tag === 'img' && !(m.index >= lo && m.index < hi) && !/\sloading=/.test(all + rest);
    if (defer) lazy++;
    out.push(html.slice(at, m.index), `${head}"${base}/assets/img/${name}"`,
      rest.replace(/\s*\/?$/, (t) => (defer ? ' loading="lazy" decoding="async"' : '') + t));
    at = end;
  }
  out.push(html.slice(at));
  if (n) console.log(`[build] ${id} · 拆出内联图 ${n} 处（${written.size} 个文件，${(bytes / 1048576).toFixed(1)} MB），其中 ${lazy} 处懒加载`);
  return out.join('');
}

/** 论文精读条目：整页由 tools/make-paper.mjs 生成，自包含，不走 render.mjs 的模板。
 *
 *  page.html 是**提交进仓库的成品** —— 素材工作现场（01_Transformer/，几百 MB）不进仓库，
 *  服务器上只有 content/，直接发这一份。本地源文件还在时先重新生成一遍，
 *  这样页面一变 git 就是脏的，deploy-remote.sh 会逼着先提交，线上不会落后于本地。
 *
 *  页面里跟环境有关的两处（返回链接、canonical）写成占位符，发布时才替换。 */
async function buildPaper({ dir, id, entry, base, dist, index }) {
  const page = j(dir, entry.page);
  // 只有本地（npm run build 带 PAPER_REBUILD=1）才重新生成。
  // 服务器上一律发仓库里的成品 —— 那边没有 ImageMagick，现场生成会把附录三张图转不正。
  if (process.env.PAPER_REBUILD && entry.build && existsSync(j(ROOT, entry.build.requires))) {
    execFileSync('node', [entry.build.tool, ...entry.build.args, '--out', page,
      '--home', '__HOME__', '--canonical', '__CANONICAL__',
      '--title', `${entry.title} · ${entry.subtitle}`, '--desc', entry.summary],
      { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.log(`[build] ${id} · 用仓库里的成品 ${entry.page}`);
  }

  const html = withSearch(await unInline((await readFile(page, 'utf8'))
    .replaceAll('__HOME__', `${base}/`)
    .replaceAll('__CANONICAL__', `${SITE.url}${base}/${id}/`)
    .replaceAll('__ASSETS__', `${base}/${id}/assets`), { id, base, dist }), { base, id, entry, index });
  await mkdir(j(dist, id), { recursive: true });
  await writeFile(j(dist, id, 'index.html'), html, 'utf8');

  // 页里的图能内联的都内联了，只有资源 tab 那批截图是外链 —— 整个 assets/ 原样带过去
  if (existsSync(j(dir, 'assets'))) await cp(j(dir, 'assets'), j(dist, id, 'assets'), { recursive: true });

  const n = (re) => (html.match(re) || []).length;
  const notes = n(/<div class="nt" data-n=/g);
  // <svg viewBox 是 make-paper 生成的那种写法；自己画的图先写 xmlns 再写 viewBox，
  // 死扣 "<svg viewBox" 会漏掉（GPT 那页 5 张图只数出 1 张）。另外数一遍内联的位图。
  const figs = n(/<svg\b[^>]*\bviewBox=/g) + n(/<figure class="poster/g) + n(/<img class="rawfig"/g);
  // 字数是 make-paper 在页面里数好的（它才知道哪些是人写的、哪些是图里的标注），
  // 这里只把它读出来 —— 卡片上的数和页面标题下那行数，同一个来源。
  const chars = +(html.match(/class="ep-meta" data-chars="(\d+)"/) || [, 0])[1];
  console.log(`[build] ${id} · ${notes} 条批注 / ${chars} 字 / ${figs} 张图 / ${(html.length / 1048576).toFixed(1)} MB`);
  // 跟页面标题下那行同一个写法：数在前，量词在后。
  // 「万字」要整个留在常规体里 —— 断成 <b>3.1 万</b>字，粗细变化落在词中间，看着像空了一格。
  const w = wan(chars).split(' ');                 // ['3.1','万'] 或 ['8500']
  // 不是论文精读的条目（视频笔记这类）没有批注，产出在 entry.json 里自己写 outputs
  return { ...entry, outputs: entry.outputs ?? [`<b>${notes}</b> 条批注`, `<b>${w[0]}</b> ${w[1] || ''}字`, `<b>${figs}</b> 张插图`] };
}

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(j(DIST, 'assets'), { recursive: true });
  await mkdir(j(DIST, 'download'), { recursive: true });

  // assets 是固定文件名 + nginx 7 天长缓存，页面引用必须带内容哈希，
  // 否则改完发布，回头客拿到的是「新 HTML + 旧 JS」——2026-08-06 就这么白过一次页
  const assetHash = createHash('sha256');
  for (const f of ['app.css', 'app.js', 'search.js']) assetHash.update(await readFile(j(ROOT, 'public', f)));
  const hash = assetHash.digest('hex').slice(0, 8);
  VER = `?v=${hash}`;
  setAssetVersion(hash);
  const index = [];          // 全站搜索索引，每个条目一项

  const ids = (await readdir(j(ROOT, 'content'), { withFileTypes: true }))
    .filter((d) => d.isDirectory()).map((d) => d.name);

  const entries = [];
  for (const id of ids) {
    const dir = j(ROOT, 'content', id);
    const entry = JSON.parse(await readFile(j(dir, 'entry.json'), 'utf8'));
    // 还没定稿的条目标 "draft": true：线上构建直接跳过，不进首页也不出页面。
    // 本地想连草稿一起看，DRAFTS=1 npm run dev
    if (entry.draft && !process.env.DRAFTS) { console.log(`[build] ${id} · 草稿，跳过`); continue; }
    if (entry.kind === 'paper') { entries.push(await buildPaper({ dir, id, entry, base: BASE, dist: DIST, index })); continue; }
    const chronicle = JSON.parse(await readFile(j(dir, 'chronicle.json'), 'utf8'));
    const { sections, chars, turns } = parseTranscript(
      await readFile(j(dir, 'transcript.md'), 'utf8'), [entry.host, entry.guest]);
    const { papers, people, res } = parseIndex(await readFile(j(dir, 'index.md'), 'utf8'));

    /* --- 交叉校验：编年史每个节点都要指得到论文和文稿章节 --- */
    const byN = new Map(papers.map((p) => [p.n, p]));
    for (const tr of chronicle) {
      for (const n of tr.nodes) {
        if (!byN.has(n.paper)) throw new Error(`编年史 ${tr.id}/${n.name} 指向不存在的论文 ${n.paper}`);
        const key = n.name.replace(/\s/g, '').slice(0, 4);
        n.section = sections.findIndex((s) => s.title.replace(/\s/g, '').includes(key));
      }
    }
    if (papers.some((p) => !p.link)) throw new Error('有论文缺少原文链接');

    /* --- 下载包：精校稿 + 资料索引 + PPT + 论文链接.txt --- */
    const stage = j(DIST, '.pack');
    await rm(stage, { recursive: true, force: true });
    await mkdir(stage, { recursive: true });
    for (const f of entry.download.files) await cp(j(dir, f.src), j(stage, f.as));
    await writeFile(j(stage, '论文链接.txt'),
      papers.map((p) => `# ${p.n}. ${p.name}\n${p.link}`).join('\n\n') + '\n', 'utf8');
    const zipPath = j(DIST, 'download', entry.download.name);
    execFileSync('zip', ['-qrX', zipPath, '.'], { cwd: stage });
    await rm(stage, { recursive: true, force: true });
    const zipSize = (await readFile(zipPath)).length;
    const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
    const srcSize = async (p) => (await readFile(j(dir, p))).length;

    /* --- 浏览器只需要的一小撮数据 --- */
    const boot = {
      base: BASE,
      audio: entry.media.audio,
      duration: entry.media.duration,
      chronicle,
      sections: sections.map((s, i) => ({ i, t: s.t })),
      papers: Object.fromEntries(papers.map((p) => [p.n, { link: p.link, meaning: p.meaning.slice(0, 80) }])),
    };

    const html = renderEntry({
      base: BASE, site: SITE, entry, sections, chars, turns, papers, people, res, boot,
      download: {
        href: `${BASE}/download/${encodeURIComponent(entry.download.name)}`,
        size: mb(zipSize),
        list: [
          ['精校稿.md', mb(await srcSize('transcript.md'))],
          ['资料索引.md', mb(await srcSize('index.md'))],
          ['AI演义-36篇论文.pdf', mb(await srcSize('assets/AI演义-36篇论文.pdf'))],
          ['论文链接.txt', `${papers.length} 篇`],
        ],
      },
    });
    await mkdir(j(DIST, id), { recursive: true });
    await writeFile(j(DIST, id, 'index.html'), withSearch(html, { base: BASE, id, entry, index }), 'utf8');

    entries.push({ ...entry, chars, turns, papers: papers.length });
    console.log(`[build] ${id} · ${sections.length} 节 / ${turns} 段 / ${chars} 字 / ${papers.length} 篇 / 包 ${mb(zipSize)}`);
  }

  // 新的在前。studied 只到月，同一个月上了好几篇（2026-09 就有三篇）时顺序是乱的，
  // 而且原来那个比较函数在相等时也返回 -1，排序结果不稳定。
  // 按上线那天（published，精确到日）排，没写的退回 studied。
  const when = (e) => e.published || e.studied;
  entries.sort((a, b) => when(b).localeCompare(when(a)) || a.id.localeCompare(b.id));
  await writeFile(j(DIST, 'index.html'), renderList({ base: BASE, entries, site: SITE }), 'utf8');

  await cp(j(ROOT, 'public', 'app.css'), j(DIST, 'assets', 'app.css'));
  await cp(j(ROOT, 'public', 'app.js'), j(DIST, 'assets', 'app.js'));
  await cp(j(ROOT, 'public', 'search.js'), j(DIST, 'assets', 'search.js'));

  /* --- 全站搜索：索引 + 搜索页 ---
     按首页的顺序排条目。重复的 tab 名、路径、类型收进字符串表，每块只存下标。
     文件名带内容哈希：索引一年变不了几次，挂长缓存；搜索页是 no-cache，总拿到最新的文件名 */
  const order = new Map(entries.map((e, i) => [e.id, i]));
  index.sort((a, b) => order.get(a.id) - order.get(b.id));
  const strs = [], at = new Map();
  const s = (v) => { if (!at.has(v)) { at.set(v, strs.length); strs.push(v); } return at.get(v); };
  const sx = {
    entries: index.map((e) => ({ id: e.id, title: e.title, subtitle: e.subtitle })),
    strs,
    items: index.flatMap((e, ei) => e.chunks.map((c) => {
      const row = [ei, s(c.tab ?? ''), s(c.crumb.join(' › ')), s(c.kind), c.id, c.text];
      if (c.title || c.sub) row.push(c.title || '', c.sub || '');
      return row;
    })),
  };
  const sxJson = JSON.stringify(sx);
  const sxName = `search-${createHash('sha256').update(sxJson).digest('hex').slice(0, 10)}.json`;
  await writeFile(j(DIST, 'assets', sxName), sxJson, 'utf8');
  await mkdir(j(DIST, 'search'), { recursive: true });
  await writeFile(j(DIST, 'search', 'index.html'), renderSearch({ base: BASE, site: SITE, index: `${BASE}/assets/${sxName}` }), 'utf8');
  console.log(`[build] 搜索索引 ${sx.items.length} 块 / ${(Buffer.byteLength(sxJson) / 1048576).toFixed(1)} MB（${sxName}）`);

  const urls = [`${SITE.url}${BASE}/`, ...entries.map((e) => `${SITE.url}${BASE}/${e.id}/`)];
  await writeFile(j(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') + `\n</urlset>\n`, 'utf8');
  await writeFile(j(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${SITE.url}${BASE}/sitemap.xml\n`, 'utf8');

  console.log(`[build] dist/ 就绪，BASE_PATH=${BASE || '(空)'}`);
}

if (!existsSync(j(ROOT, 'content'))) throw new Error('找不到 content/');
await build();
