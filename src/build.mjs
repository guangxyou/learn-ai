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
import { renderList, renderEntry, setAssetVersion, wan } from './render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_PATH ?? '/learn-ai';
const SITE = {
  url: 'https://xslaoxu.cn',
  desc: '我深度读透过的东西，一条一条留在这里：完整文字稿、可跳播的编年史、能追到原文的索引。',
};
const DIST = join(ROOT, 'dist');
const j = (...p) => join(...p);


/** 论文精读条目：整页由 tools/make-paper.mjs 生成，自包含，不走 render.mjs 的模板。
 *
 *  page.html 是**提交进仓库的成品** —— 素材工作现场（01_Transformer/，几百 MB）不进仓库，
 *  服务器上只有 content/，直接发这一份。本地源文件还在时先重新生成一遍，
 *  这样页面一变 git 就是脏的，deploy-remote.sh 会逼着先提交，线上不会落后于本地。
 *
 *  页面里跟环境有关的两处（返回链接、canonical）写成占位符，发布时才替换。 */
async function buildPaper({ dir, id, entry, base, dist }) {
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

  const html = (await readFile(page, 'utf8'))
    .replaceAll('__HOME__', `${base}/`)
    .replaceAll('__CANONICAL__', `${SITE.url}${base}/${id}/`);
  await mkdir(j(dist, id), { recursive: true });
  await writeFile(j(dist, id, 'index.html'), html, 'utf8');

  const n = (re) => (html.match(re) || []).length;
  const notes = n(/<div class="nt" data-n=/g);
  const figs = n(/<svg viewBox/g) + n(/<figure class="poster/g);
  // 字数是 make-paper 在页面里数好的（它才知道哪些是人写的、哪些是图里的标注），
  // 这里只把它读出来 —— 卡片上的数和页面标题下那行数，同一个来源。
  const chars = +(html.match(/class="ep-meta" data-chars="(\d+)"/) || [, 0])[1];
  console.log(`[build] ${id} · ${notes} 条批注 / ${chars} 字 / ${figs} 张图 / ${(html.length / 1048576).toFixed(1)} MB`);
  // 跟页面标题下那行同一个写法：数在前，量词在后。
  // 「万字」要整个留在常规体里 —— 断成 <b>3.1 万</b>字，粗细变化落在词中间，看着像空了一格。
  const w = wan(chars).split(' ');                 // ['3.1','万'] 或 ['8500']
  return { ...entry, outputs: [`<b>${notes}</b> 条批注`, `<b>${w[0]}</b> ${w[1] || ''}字`, `<b>${figs}</b> 张插图`] };
}

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(j(DIST, 'assets'), { recursive: true });
  await mkdir(j(DIST, 'download'), { recursive: true });

  // assets 是固定文件名 + nginx 7 天长缓存，页面引用必须带内容哈希，
  // 否则改完发布，回头客拿到的是「新 HTML + 旧 JS」——2026-08-06 就这么白过一次页
  const assetHash = createHash('sha256');
  for (const f of ['app.css', 'app.js']) assetHash.update(await readFile(j(ROOT, 'public', f)));
  const VER = assetHash.digest('hex').slice(0, 8);
  setAssetVersion(VER);

  const ids = (await readdir(j(ROOT, 'content'), { withFileTypes: true }))
    .filter((d) => d.isDirectory()).map((d) => d.name);

  const entries = [];
  for (const id of ids) {
    const dir = j(ROOT, 'content', id);
    const entry = JSON.parse(await readFile(j(dir, 'entry.json'), 'utf8'));
    if (entry.kind === 'paper') { entries.push(await buildPaper({ dir, id, entry, base: BASE, dist: DIST })); continue; }
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
    await writeFile(j(DIST, id, 'index.html'), html, 'utf8');

    entries.push({ ...entry, chars, turns, papers: papers.length });
    console.log(`[build] ${id} · ${sections.length} 节 / ${turns} 段 / ${chars} 字 / ${papers.length} 篇 / 包 ${mb(zipSize)}`);
  }

  entries.sort((a, b) => (a.studied < b.studied ? 1 : -1));
  await writeFile(j(DIST, 'index.html'), renderList({ base: BASE, entries, site: SITE }), 'utf8');

  await cp(j(ROOT, 'public', 'app.css'), j(DIST, 'assets', 'app.css'));
  await cp(j(ROOT, 'public', 'app.js'), j(DIST, 'assets', 'app.js'));

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
