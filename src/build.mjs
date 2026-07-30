#!/usr/bin/env node
/**
 * content/ → dist/
 * 纯 Node，无依赖。构建期把 Markdown 编译成静态 HTML，运行时零进程。
 */
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTranscript, parseIndex } from './parse.mjs';
import { renderList, renderEntry } from './render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_PATH ?? '/learn-ai';
const SITE = {
  url: 'https://xslaoxu.cn',
  desc: '我深度读透过的东西，一条一条留在这里：完整文字稿、可跳播的编年史、能追到原文的索引。',
};
const DIST = join(ROOT, 'dist');
const j = (...p) => join(...p);

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(j(DIST, 'assets'), { recursive: true });
  await mkdir(j(DIST, 'download'), { recursive: true });

  const ids = (await readdir(j(ROOT, 'content'), { withFileTypes: true }))
    .filter((d) => d.isDirectory()).map((d) => d.name);

  const entries = [];
  for (const id of ids) {
    const dir = j(ROOT, 'content', id);
    const entry = JSON.parse(await readFile(j(dir, 'entry.json'), 'utf8'));
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
