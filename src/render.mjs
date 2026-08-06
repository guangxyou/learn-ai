/** 页面渲染：结构化数据 → 完整 HTML 字符串。构建期跑一次，浏览器里不再解析内容。 */
import { esc, inline } from './parse.mjs';

const pad = (n) => String(n).padStart(2, '0');
export const hms = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad((s / 3600) | 0)}:${pad(((s % 3600) / 60) | 0)}:${pad(s % 60)}`;
};
const wan = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : String(n));

/* logo：追赶 —— 虚线走在前面，实线从后面追上来 */
const LOGO = `<svg class="logo" viewBox="0 0 34 22" fill="none" aria-hidden="true">
  <path d="M1 15h7l4-4h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" stroke-dasharray="3 3" opacity=".45"/>
  <path d="M2 20h7l5-5h5l4-4h9" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="30" cy="11" r="2.6" fill="currentColor"/></svg>`;

export const SLOGAN = '一篇一篇，跟上 AI 时代';

function layout({ base, title, desc, canonical, body, jsonld, bodyClass = '' }) {
  return `<!DOCTYPE html>
<html lang="zh-Hans" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<link rel="stylesheet" href="${base}/assets/app.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${body}
</body>
</html>
`;
}

/* ---------------- 列表页 ---------------- */
export function renderList({ base, entries, site }) {
  const cards = entries.map((e) => {
    const outputs = [['文稿', wan(e.chars) + '字'], ['论文', e.papers + ' 篇'], ['PPT', e.slides + ' 页']];
    return `<a class="entry" href="${base}/${e.id}/">
    <div class="entry-when">${e.studied.replace('-', '.')}</div>
    <div>
      <div class="topics">${e.topics.map((t) => `<span class="topic">${esc(t)}</span>`).join('')}</div>
      <h2>${esc(e.title)}<em> — ${esc(e.subtitle)}</em></h2>
      <p class="desc">${esc(e.summary)}</p>
      <div class="outputs">${outputs.map(([k, v]) => `<span class="output">${k} <b>${v}</b></span>`).join('')}</div>
    </div>
  </a>`;
  }).join('\n');

  return layout({
    base, title: `learn-ai · ${SLOGAN}`, desc: site.desc, canonical: site.url + base + '/',
    body: `<header class="topbar">
  <div class="wrap">
    <a class="brand" href="${base}/">${LOGO}<span class="bn">learn-ai</span><small>${SLOGAN}</small></a>
  </div>
</header>

<main class="wrap">
  <div class="entries">
${cards}
  </div>
</main>

<script src="${base}/assets/app.js" defer></script>`,
    bodyClass: 'no-player',
  });
}

/* ---------------- 文稿 ---------------- */
function block(b) {
  if (b.k === 'img') return `<figure class="fig"><img src="${b.v.src}" alt="${esc(b.v.alt)}" loading="lazy">`
    + `<figcaption>${esc(b.v.alt)}${b.v.cite ? `<span class="cite">${esc(b.v.cite)}</span>` : ''}</figcaption></figure>`;
  if (b.k === 'h3') return `<h3>${inline(b.v)}</h3>`;
  if (b.k === 'ul') return `<ul>${b.v.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
  if (b.k === 'ol') return `<ol>${b.v.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
  return `<p>${inline(b.v)}</p>`;
}

function transcriptHTML(sections, host) {
  let doc = '', ol = '', part = null;
  sections.forEach((sec, si) => {
    if (sec.part && sec.part !== part) {
      part = sec.part;
      doc += `<div class="part-rule">${esc(part)}</div>`;
      ol += `<div class="ol-part">${esc(part)}</div>`;
    }
    doc += `<h2 id="s${si}">${esc(sec.title)}</h2>`;
    ol += `<button class="ol-item" data-s="${si}"><span class="t">${hms(sec.t)}</span><span>${esc(sec.title)}</span></button>`;
    for (const tn of sec.turns) {
      const who = tn.spk ? `<div class="turn-who${tn.spk === host ? ' host' : ''}">${esc(tn.spk)}</div>` : '';
      doc += `<div class="turn${tn.cont ? ' cont' : ''}" data-t="${tn.t}">`
        + `<button class="turn-t mono" data-seek="${tn.t}" title="跳到 ${hms(tn.t)}">${tn.spk || tn.cont ? hms(tn.t) : ''}</button>`
        + `<div class="turn-body">${who}${tn.b.map(block).join('')}</div></div>`;
    }
  });
  return { doc, ol };
}

/* ---------------- 资料 ---------------- */
function tbl(rows, heads) {
  return `<div class="tw"><table class="rtab">
    <thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function resourcesHTML({ papers, people, res, download }) {
  let part = null, ph = '';
  for (const p of papers) {
    if (p.part !== part) { part = p.part; ph += `<div class="part-h">${esc(part)}</div>`; }
    ph += `<div class="paper" data-n="${p.n}">
      <span class="d">${p.date}</span>
      <div><h4>${p.n}. ${esc(p.name)}</h4><div class="en">${esc(p.title)}</div>
        <div class="mn">
          ${p.authors ? `<div><i>作者</i>${esc(p.authors)}</div>` : ''}
          ${p.org ? `<div><i>机构</i>${esc(p.org)}</div>` : ''}
          <div><i>意义</i>${esc(p.meaning)}</div>
        </div></div>
      <a class="go" href="${p.link}" target="_blank" rel="noreferrer">原文 ↗</a></div>`;
  }

  const peopleHTML = people.map((p) => `<div class="person">
    <div class="p-h"><b>${esc(p.name)}</b>${p.count > 1 ? `<span class="cnt">${p.count} 篇</span>` : ''}</div>
    <div class="p-org">${esc(p.org)}</div>
    ${p.papers ? `<div class="p-ps">${esc(p.papers)}</div>` : ''}
    ${p.links.length ? `<div class="p-lk">${p.links.map((l) =>
      `<a href="${l.url}" target="_blank" rel="noreferrer">${esc(l.label)} ↗</a>`).join('')}</div>` : ''}
  </div>`).join('');

  const nav = [
    ['#res-papers', `论文索引 ${papers.length}`], ['#res-people', `人物索引 ${people.length}`],
    ['#res-videos', `视频教程 ${res.videos.length}`], ['#res-talks', `演讲 ${res.talks.length}`],
    ['#res-interviews', `访谈 ${res.interviews.length}`], ['#res-books', `书 / 文章 ${res.books.length}`],
    ['#res-extra', `延伸论文 ${res.extra.length}`], ['#res-reports', `技术报告 ${res.reports.length}`],
    ['#res-tools', '数据集 / 工具'],
  ].map(([to, t]) => `<button class="chip" data-to="${to}">${t}</button>`).join('');

  const sec = (id, title, count, note, inner) => `<section class="res-sec" id="${id}">
      <h3>${title}${count ? ` <span>${count}</span>` : ''}</h3>
      ${note ? `<p class="col-note">${note}</p>` : ''}
      ${inner}
    </section>`;

  return `<div class="dl">
      <div class="dl-main">
        <h3>资料下载</h3>
        <div class="dl-btns"><a class="btn btn-primary" href="${download.href}" data-dl="pack">↓ 资料包 ${download.size}</a></div>
      </div>
      <div class="dl-list"><ul>${download.list.map(([f, s]) =>
        `<li><span>${esc(f)}</span><span>${esc(s)}</span></li>`).join('')}</ul></div>
    </div>

    <nav class="res-nav" id="res-nav">${nav}</nav>

    ${sec('res-papers', '论文索引', `${papers.length} 篇`, '点一行展开作者、机构与意义。日期是首次发表月。', `<div id="papers">${ph}</div>`)}
    ${sec('res-people', '人物索引', `研究者 ${people.length} 位`, '只收在这 36 篇论文里署名的研究者，按出现篇数排序。', `<div class="people">${peopleHTML}</div>`)}
    ${sec('res-videos', '视频教程', res.videos.length, '', tbl(res.videos, ['节目中的提及', '整理结果']))}
    ${sec('res-talks', '演讲', res.talks.length, '', tbl(res.talks, ['人物 / 内容', '原始材料']))}
    ${sec('res-interviews', '访谈', res.interviews.length, '节目中口头推荐的同系列单集，已核到小宇宙链接。',
    tbl(res.interviews.map((x) => [
      x.url ? `<a href="${x.url}" target="_blank" rel="noreferrer">${x.title} ↗</a>` : x.title,
      x.who, esc(x.subject)]), ['节目', '人物', '节目内容']))}
    ${sec('res-books', '书 / 文章', res.books.length, '', tbl(res.books, ['题名 / 描述', '作者或来源', '链接 / 状态']))}
    ${sec('res-extra', '延伸论文', res.extra.length, '节目里明确点名、但没有进 36 篇主线的论文。', tbl(res.extra, ['材料', '节目中的作用', '原始入口']))}
    ${sec('res-reports', '技术报告与官方发布', res.reports.length, '', tbl(res.reports, ['材料', '原始入口', '说明']))}
    ${sec('res-tools', '数据集 / 工具 / 项目入口', '', '', `<ul class="tool-list">${res.tools.map((t) => `<li>${t}</li>`).join('')}</ul>`)}`;
}

/* ---------------- 详情页 ---------------- */
export function renderEntry({ base, site, entry, sections, chars, turns, papers, people, res, download, boot }) {
  const { doc, ol } = transcriptHTML(sections, entry.host);
  const meta = [
    ['嘉宾', entry.guest], ['文稿', wan(chars) + ' 字'], ['时长', '4 小时 22 分'],
    ['发言', turns + ' 段'], ['论文', papers.length + ' 篇'], ['PPT', entry.slides + ' 页'],
  ].map(([k, v]) => `<span>${k} <b>${esc(v)}</b></span>`).join('');

  return layout({
    base,
    title: `${entry.title} · learn-ai`,
    desc: entry.summary,
    canonical: `${site.url}${base}/${entry.id}/`,
    jsonld: {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: entry.title, description: entry.summary,
      datePublished: entry.studied + '-01', inLanguage: 'zh-Hans',
      isBasedOn: entry.source.url, wordCount: chars,
    },
    body: `<header class="topbar">
  <div class="wrap"><a class="back" href="${base}/">‹ 全部条目</a></div>
</header>

<main class="wrap">
  <section class="ep-head">
    <div class="ep-kicker"><span class="topic">${esc(entry.topics[0])}</span><span>${esc(entry.source.name)}</span></div>
    <h1>${esc(entry.title)}<em>${esc(entry.subtitle)}</em></h1>
    <div class="ep-meta">${meta}</div>
    <div class="ep-links">
      <a class="btn btn-primary" href="#" id="play-top">▶ 从头播放</a>
      <a class="btn" href="${entry.source.url}" target="_blank" rel="noreferrer">小宇宙原页 ↗</a>
      <a class="btn" href="${entry.media.video}" target="_blank" rel="noreferrer">B 站视频版 ↗</a>
    </div>
  </section>
</main>

<div class="tabs">
  <div class="wrap" style="display:flex;padding:0 20px">
    <button class="tab" data-tab="transcript" aria-selected="true">文稿<span class="n">${wan(chars)}字</span></button>
    <button class="tab" data-tab="chronicle">编年史<span class="n">4 条轨道</span></button>
    <button class="tab" data-tab="resources">资料<span class="n">${papers.length} 篇论文</span></button>
  </div>
</div>

<main class="wrap">
  <section class="pane" id="pane-transcript">
    <div class="reader">
      <aside class="outline"><h4>大纲</h4><div id="outline-list">${ol}</div></aside>
      <div>
        <!-- 阅读设置（字号 / 字体 / 时间码 / 跟随）已去掉：正文固定一套排版，播放时始终跟随。
             这条只剩窄屏用的目录入口 —— 桌面端左侧有大纲，用不上。 -->
        <div class="reader-bar only-mobile" id="reader-bar">
          <span class="seg"><button id="toc-btn">目录</button></span>
        </div>
        <div class="toc-sheet" id="toc-sheet">
          <div class="h"><b>大纲 · ${sections.length} 节</b><button class="icon-btn" id="toc-x">×</button></div>
          <div id="toc-list">${ol}</div>
        </div>
        <article class="doc" id="doc">${doc}</article>
      </div>
    </div>
  </section>

  <section class="pane" id="pane-chronicle">
    <div class="chron-bar">
      <span class="seg" style="display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--bg-elev)">
        <button class="chip" style="border:0;border-radius:0" data-mode="even" aria-pressed="true">等距排布</button>
        <button class="chip" style="border:0;border-radius:0" data-mode="time">按真实年份</button>
      </span>
    </div>
    <p class="chron-hint">四条轨道重画自 PPT 第 8 / 26 / 32 / 41 页，走线与焊盘沿用原图的电路板语言，但每个节点可点：
      读那一段文稿、跳到音频那一秒、打开论文原文。切到「按真实年份」能看出 PPT 等距排布藏起来的东西 —— 2014 和 2017 有多挤，2005–2011 有多空。</p>
    <div id="chron"></div>
  </section>

  <section class="pane" id="pane-resources">${resourcesHTML({ papers, people, res, download })}</section>
</main>

<div class="player">
  <div class="wrap">
    <span class="p-cover" id="p-cover"><img src="${entry.media.cover}" alt="${esc(entry.source.name)} 封面" referrerpolicy="no-referrer"></span>
    <div class="p-ctrl">
      <button class="p-nudge" id="back15" aria-label="后退 15 秒"></button>
      <button class="pp" id="pp" aria-label="播放 / 暂停"></button>
      <button class="p-nudge" id="fwd30" aria-label="前进 30 秒"></button>
    </div>
    <div class="p-mid">
      <div class="p-title"><b>${esc(entry.title)}</b> <span id="p-now"></span> <span id="p-note" style="color:var(--text-3)"></span></div>
      <div class="p-bar" id="p-bar"><i id="p-fill" style="width:0"></i></div>
    </div>
    <span class="p-time mono" id="p-time"></span>
    <button id="rate" class="p-rate hide-s">1×</button>
  </div>
</div>

<script>window.LA=${JSON.stringify(boot)}</script>
<script src="${base}/assets/app.js" defer></script>`,
  });
}
