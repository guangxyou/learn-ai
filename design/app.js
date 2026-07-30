/* ============================================================
   learn-ai · 原型交互
   真实数据来自 data.js（由 extract.py 从 00_论文探索之旅/ 抽取）
   ============================================================ */
const D = window.DATA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad((s / 3600) | 0)}:${pad(((s % 3600) / 60) | 0)}:${pad(s % 60)}`;
};
const wan = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : String(n));

/* 图标：播放/暂停/±秒沿用慧客堂那一套线性图标 */
const ICON = {
  play: '<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8c0-.6.7-1 1.2-.7l7 5.2c.4.3.4.9 0 1.2l-7 5.2c-.5.4-1.2 0-1.2-.6V2.8z"/></svg>',
  pause: '<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="2.5" width="3" height="11" rx="1"/><rect x="9" y="2.5" width="3" height="11" rx="1"/></svg>',
  back15: '<svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.4 8.6A7.2 7.2 0 1 1 3.8 14" stroke-linecap="round"/><path d="M3.2 4.2v4.6h4.6" stroke-linecap="round" stroke-linejoin="round"/><text x="11" y="14.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="-apple-system,system-ui,sans-serif">15</text></svg>',
  fwd30: '<svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.6 8.6A7.2 7.2 0 1 0 18.2 14" stroke-linecap="round"/><path d="M18.8 4.2v4.6h-4.6" stroke-linecap="round" stroke-linejoin="round"/><text x="11" y="14.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="-apple-system,system-ui,sans-serif">30</text></svg>',
};

/* logo：追赶 —— 虚线走在前面，实线从后面追上来（候选 L1，其余见 pick.html） */
const LOGO = `<svg class="logo" viewBox="0 0 34 22" fill="none" aria-hidden="true">
  <path d="M1 15h7l4-4h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" stroke-dasharray="3 3" opacity=".45"/>
  <path d="M2 20h7l5-5h5l4-4h9" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="30" cy="11" r="2.6" fill="currentColor"/></svg>`;

/* ============================================================
   列表页
   ============================================================ */
function renderList() {
  const e = D.entry;
  const outputs = [['文稿', wan(e.chars) + '字'], ['论文', e.papers + ' 篇'], ['PPT', e.slides + ' 页']];
  $('#entries').innerHTML = `
  <a class="entry" href="episode.html">
    <div class="entry-when"><b>${e.studied.replace('-', '.')}</b></div>
    <div>
      <div class="topics">${e.topics.map((t) => `<span class="topic">${esc(t)}</span>`).join('')}</div>
      <h2>${esc(e.title)}<em> — ${esc(e.subtitle)}</em></h2>
      <p class="desc">${esc(e.source)}，${esc(e.guest)} 用 4 小时 22 分讲了 36 篇论文。
      这里是逐段精校的文字稿、可跳播的四条编年史，以及 36 篇论文与相关人物、资料的完整索引。</p>
      <div class="outputs">${outputs.map(([k, v]) => `<span class="output">${k} <b>${v}</b></span>`).join('')}</div>
    </div>
  </a>
  <div class="entry ghost">
    <div class="entry-when"><b>——</b></div>
    <div>
      <div class="topics"><span class="topic">占位</span></div>
      <h2>下一个条目<em> — 列表随读透的东西一条条长</em></h2>
      <p class="desc">条目不限于播客：一门课、一本书、一个专题的连续论文，都是一条。
      详情页由模块拼装，模块清单写在条目的 <code>entry.json</code> 里，所以每条可以长得不一样。</p>
    </div>
  </div>`;
}

/* ============================================================
   详情页 · 头部
   ============================================================ */
function renderHead() {
  const e = D.entry;
  $('#ep-kicker').innerHTML =
    `<span class="topic">${esc(e.topics[0])}</span><span>${esc(e.source)}</span>`;
  $('#ep-title').innerHTML = `${esc(e.title)}<em>${esc(e.subtitle)}</em>`;
  $('#ep-meta').innerHTML = [
    ['嘉宾', e.guest], ['文稿', wan(e.chars) + ' 字'], ['时长', '4 小时 22 分'],
    ['发言', e.turns + ' 段'], ['论文', e.papers + ' 篇'], ['PPT', e.slides + ' 页'],
  ].map(([k, v]) => `<span>${k} <b>${esc(v)}</b></span>`).join('');
  $('#ep-links').innerHTML = `
    <a class="btn btn-primary" href="#" id="play-top">▶ 从头播放</a>
    <a class="btn" href="${e.origin}" target="_blank" rel="noreferrer">小宇宙原页 ↗</a>
    <a class="btn" href="${e.video}" target="_blank" rel="noreferrer">B 站视频版 ↗</a>`;
}

/* ---------------- 文稿 ---------------- */
function renderTranscript() {
  let doc = '', ol = '', part = null, i = 0;
  D.sections.forEach((sec, si) => {
    if (sec.part && sec.part !== part) {
      part = sec.part;
      doc += `<div class="part-rule">${esc(part)}</div>`;
      ol += `<div class="ol-part">${esc(part)}</div>`;
    }
    doc += `<h2 id="s${si}">${esc(sec.title)}</h2>`;
    ol += `<button class="ol-item" data-s="${si}"><span class="t">${hms(sec.t)}</span><span>${esc(sec.title)}</span></button>`;
    sec.turns.forEach((tn) => {
      const who = tn.spk
        ? `<div class="turn-who${tn.spk === D.entry.host ? ' host' : ''}">${esc(tn.spk)}</div>` : '';
      doc += `<div class="turn" data-i="${i++}" data-t="${tn.t}">
        <button class="turn-t mono" data-seek="${tn.t}" title="跳到 ${hms(tn.t)}">${tn.spk ? hms(tn.t) : ''}</button>
        <div class="turn-body">${who}${tn.b.map(block).join('')}</div></div>`;
    });
  });
  $('#doc').innerHTML = doc;
  $('#outline-list').innerHTML = ol;
  $('#toc-list').innerHTML = ol;

  $$('#doc .turn-t').forEach((b) => (b.onclick = () => player.seek(+b.dataset.seek, true)));
  $$('.ol-item').forEach((b) => (b.onclick = () => {
    $('#toc-sheet').classList.remove('on');
    $('#s' + b.dataset.s).scrollIntoView({ block: 'start' });
  }));
  $('#toc-btn').onclick = () => $('#toc-sheet').classList.add('on');
  $('#toc-x').onclick = () => $('#toc-sheet').classList.remove('on');
}

/* 正文块：段落 / 三级小标题 / 无序表 / 有序表 */
function block(b) {
  if (b.k === 'h3') return `<h3>${inline(b.v)}</h3>`;
  if (b.k === 'ul') return `<ul>${b.v.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
  if (b.k === 'ol') return `<ol>${b.v.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
  return `<p>${inline(b.v)}</p>`;
}
// 行内 markdown：**粗** / *斜* / `码` / [文](链)
function inline(s) {
  return esc(s)
    .replace(/\\([*_`[\]()#.!-])/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*]+)\*(?![*\w])/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function initReaderBar() {
  const doc = $('#doc');
  $$('#reader-bar [data-set]').forEach((b) => (b.onclick = () => {
    const [k, v] = b.dataset.set.split(':');
    doc.dataset[k] = v;
    $$(`#reader-bar [data-set^="${k}:"]`).forEach((x) => x.setAttribute('aria-pressed', x === b));
    localStorage.setItem('reader-' + k, v);
  }));
  ['font', 'size', 'ts'].forEach((k) => {
    const v = localStorage.getItem('reader-' + k);
    if (v) { const b = $(`#reader-bar [data-set="${k}:${v}"]`); if (b) b.click(); }
  });
  $('#follow').onclick = (ev) => {
    player.follow = !player.follow;
    ev.currentTarget.setAttribute('aria-pressed', player.follow);
    ev.currentTarget.textContent = player.follow ? '跟随中' : '不跟随';
  };
}

/* ---------------- 编年史（PCB 走线） ---------------- */
const CH = { mode: 'even' };
const ym = (d) => { const [y, m] = d.split('.').map(Number); return y + (m - 1) / 12; };
const cut = (s, k) => (s.length > k ? s.slice(0, k - 1) + '…' : s);

function trackSVG(tr, vertical, avail) {
  const nodes = tr.nodes.map(([date, name, sub, p]) => ({ date, name, sub, p }))
    .sort((a, b) => ym(a.date) - ym(b.date));
  const N = nodes.length;
  const all = D.chronicle.flatMap((t) => t.nodes.map((n) => ym(n[0])));
  const lo = Math.min(...all), hi = Math.max(...all);

  /* ---- 窄屏：竖排导轨 ---- */
  if (vertical) {
    const STEP = 78, PADT = 34, W = Math.max(280, avail), H = PADT * 2 + (N - 1) * STEP;
    const LX = 100;
    const pts = nodes.map((n, i) => ({ x: 26 + (i % 2 ? 30 : 0), y: PADT + i * STEP, n }));
    let d = `M ${pts[0].x} 0`;
    pts.forEach((p, i) => {
      if (i) { const dx = Math.abs(p.x - pts[i - 1].x); d += ` V ${p.y - dx} L ${p.x} ${p.y}`; }
      else d += ` V ${p.y}`;
    });
    d += ` V ${H}`;
    const body = pts.map((p, i) => `<g class="tr-node" data-track="${tr.id}" data-i="${i}">
        <line class="tr-lead" x1="${p.x + 11}" y1="${p.y}" x2="${LX - 10}" y2="${p.y}"/>
        <text class="tr-date" x="${LX}" y="${p.y - 13}">${p.n.date}</text>
        <text class="tr-name" x="${LX}" y="${p.y + 4}">${esc(cut(p.n.name, 18))}</text>
        <text class="tr-sub"  x="${LX}" y="${p.y + 21}">${esc(cut(p.n.sub, 20))}</text>
        <circle class="tr-pad" cx="${p.x}" cy="${p.y}" r="5.5"/>
        <rect class="hit" x="0" y="${p.y - 34}" width="${W}" height="68"/></g>`).join('');
    return { W, H, svg: `<path class="tr-line" d="${d}"/>${body}` };
  }

  /* ---- 桌面：横向走线 ---- */
  const PADX = 74, W = Math.max(700, avail), H = 372;
  const RAIL = 250, RISE = 30, JOG = 46;
  const ABOVE = { d: 54, n: 74, s: 92, lead: 104 };
  const BELOW = { d: 300, n: 320, s: 338, lead: 288 };

  let xs;
  if (CH.mode === 'time') {
    xs = nodes.map((n) => PADX + ((ym(n.date) - lo) / (hi - lo)) * (W - PADX * 2));
    for (let i = 1; i < N; i++) if (xs[i] - xs[i - 1] < 26) xs[i] = xs[i - 1] + 26;
  } else {
    xs = nodes.map((_, i) => PADX + i * ((W - PADX * 2) / Math.max(1, N - 1)));
  }
  const pts = nodes.map((n, i) => ({
    x: xs[i], y: RAIL - Math.round((i / (N - 1)) * 3) * RISE - (i % 2 ? JOG : 0), n, above: i % 2 === 0,
  }));

  // 同侧标签至少隔 132px，超出画布再整体夹回来
  [true, false].forEach((side) => {
    let last = -1e9;
    pts.filter((p) => p.above === side).forEach((p) => { p.lx = Math.max(p.x, last + 132); last = p.lx; });
    const over = last - (W - 60);
    if (over > 0) pts.filter((p) => p.above === side).forEach((p) => (p.lx = Math.max(60, p.lx - over)));
  });

  let d = `M 4 ${pts[0].y}`;
  pts.forEach((p, i) => {
    if (i) { const dy = Math.abs(p.y - pts[i - 1].y); d += ` H ${Math.max(pts[i - 1].x + 4, p.x - dy)} L ${p.x} ${p.y}`; }
    else d += ` H ${p.x}`;
  });
  d += ` H ${W - 4}`;

  // PPT 上那颗 DIP 封装与一排过孔，放在左侧引入段，纯装饰
  const DY = RAIL + 32;
  const vias = [0, 1, 2, 3, 4].map((k) => `<circle class="tr-pad" cx="${14 + k * 14}" cy="${DY}" r="3.4"/>`).join('');
  const stub = `<path class="tr-line ghost" d="M 2 ${DY} H 86"/>`;
  const chip = `<g transform="translate(${Math.max(120, pts[0].x + 44)},${DY}) rotate(-30)">
    <rect class="tr-chip" x="-18" y="-9" width="36" height="18" rx="2"/>
    ${[-11, -3, 5].map((x) => `<path class="tr-chip" d="M ${x} -9 v -6 M ${x} 9 v 6"/>`).join('')}</g>`;

  const body = pts.map((p, i) => {
    const L = p.above ? ABOVE : BELOW;
    const lead = p.above
      ? `M ${p.x} ${p.y - 11} V ${L.lead + 14} L ${p.lx} ${L.lead}`
      : `M ${p.x} ${p.y + 11} V ${L.lead - 14} L ${p.lx} ${L.lead}`;
    return `<g class="tr-node" data-track="${tr.id}" data-i="${i}">
      <path class="tr-lead" fill="none" d="${lead}"/>
      <text class="tr-date" x="${p.lx}" y="${L.d}" text-anchor="middle">${p.n.date}</text>
      <text class="tr-name" x="${p.lx}" y="${L.n}" text-anchor="middle">${esc(cut(p.n.name, 16))}</text>
      <text class="tr-sub"  x="${p.lx}" y="${L.s}" text-anchor="middle">${esc(cut(p.n.sub, 17))}</text>
      <circle class="tr-pad" cx="${p.x}" cy="${p.y}" r="5.5"/>
      <circle class="hit" cx="${p.x}" cy="${p.y}" r="18"/>
      <rect class="hit" x="${p.lx - 66}" y="${L.d - 16}" width="132" height="62"/></g>`;
  }).join('');

  return { W, H, svg: `${stub}${vias}${chip}<path class="tr-line" d="${d}"/>${body}` };
}

function renderChronicle() {
  const box = $('#chron');
  const vertical = innerWidth < 861;
  const avail = Math.max(300, box.clientWidth - 4);
  box.innerHTML = D.chronicle.map((tr) => {
    const { W, H, svg } = trackSVG(tr, vertical, avail - 28);
    return `<section class="track" data-track="${tr.id}">
      <div class="track-h"><h3>${esc(tr.name)}</h3><span class="n">${tr.nodes.length} 个节点</span></div>
      <div class="track-scroll"><svg class="track-svg" viewBox="0 0 ${W} ${H}"
        style="width:${W}px;height:${H}px" role="img"
        aria-label="${esc(tr.name)}时间线">${svg}</svg></div>
    </section>`;
  }).join('');

  $$('.tr-node').forEach((g) => (g.onclick = () => openNode(g)));
}
window.redrawChronicle = () => { if ($('#pane-chronicle')?.classList.contains('on')) renderChronicle(); };

/* 卡片贴着被点的焊盘出现：优先在下方，下方被播放条挡住就翻到上方 */
function placeCard(el, g) {
  if (innerWidth < 861) return;                 // 窄屏用 CSS 固定成底部卡片
  const pad = g.querySelector('.tr-pad').getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  const GAP = 12, PLAYER = 76, TOPBAR = 112;

  el.style.left = Math.max(12, Math.min(innerWidth - w - 12, pad.left + pad.width / 2 - w / 2)) + 'px';

  const below = pad.bottom + GAP, above = pad.top - GAP - h;
  const top = (below + h <= innerHeight - PLAYER || above < TOPBAR) ? below : above;
  el.style.top = Math.max(TOPBAR, Math.min(innerHeight - PLAYER - h, top)) + scrollY + 'px';
}

function openNode(g) {
  $('#node-card')?.remove();
  $$('.tr-node').forEach((x) => x.classList.remove('sel'));
  g.classList.add('sel');
  const tr = D.chronicle.find((t) => t.id === g.dataset.track);
  const [date, name, sub, pn] = [...tr.nodes].sort((a, b) => ym(a[0]) - ym(b[0]))[+g.dataset.i];
  const paper = D.papers.find((p) => p.n === String(pn));
  const key = name.replace(/\s/g, '').slice(0, 4);
  const sec = D.sections.find((s) => s.title.replace(/\s/g, '').includes(key));
  const el = document.createElement('div');
  el.id = 'node-card';
  el.className = 'node-card';
  el.innerHTML = `<button class="x">×</button>
    <div class="d">${date}</div><h4>${esc(name)}</h4>
    <p>${esc(sub)}${paper ? '。' + esc(paper.meaning.slice(0, 70)) + '…' : ''}</p>
    <div class="acts">
      ${sec ? `<button class="btn" data-go="${D.sections.indexOf(sec)}">读这一段</button>` : ''}
      ${sec ? `<button class="btn" data-seek="${sec.t}">▶ 跳播</button>` : ''}
      ${paper ? `<a class="btn" href="${paper.link}" target="_blank" rel="noreferrer">原文 ↗</a>` : ''}
    </div>`;
  document.body.appendChild(el);
  placeCard(el, g);
  el.querySelector('.x').onclick = () => { el.remove(); g.classList.remove('sel'); };
  const go = el.querySelector('[data-go]');
  if (go) go.onclick = () => { showTab('transcript'); $('#s' + go.dataset.go).scrollIntoView({ block: 'start' }); el.remove(); };
  const sk = el.querySelector('[data-seek]');
  if (sk) sk.onclick = () => player.seek(+sk.dataset.seek, true);
}

/* ---------------- 资料 ---------------- */
function renderResources() {
  const R = D.res;
  const tbl = (rows, heads) => `<div class="tw"><table class="rtab">
    <thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  /* 下载 */
  $('#dl').innerHTML = `
    <div class="dl-main">
      <h3>资料下载</h3>
      <div class="dl-btns">
        <a class="btn btn-primary" href="#">↓ 资料包 8.2 MB</a>
      </div>
    </div>
    <div class="dl-list">
      <ul>
        <li><span>精校稿.md</span><span>132 KB</span></li>
        <li><span>资料索引.md</span><span>64 KB</span></li>
        <li><span>AI演义-36篇论文.pdf</span><span>8.0 MB</span></li>
        <li><span>论文链接.txt</span><span>36 篇</span></li>
      </ul>
    </div>`;

  /* 论文 */
  let part = null, h = '';
  D.papers.forEach((p) => {
    if (p.part !== part) { part = p.part; h += `<div class="part-h">${esc(part)}</div>`; }
    h += `<div class="paper" data-n="${p.n}">
      <span class="d">${p.date}</span>
      <div><h4>${p.n}. ${esc(p.name)}</h4><div class="en">${esc(p.title)}</div>
        <div class="mn">
          ${p.authors ? `<div><i>作者</i>${esc(p.authors)}</div>` : ''}
          ${p.org ? `<div><i>机构</i>${esc(p.org)}</div>` : ''}
          <div><i>意义</i>${esc(p.meaning)}</div>
        </div></div>
      <a class="go" href="${p.link}" target="_blank" rel="noreferrer">原文 ↗</a></div>`;
  });
  $('#papers').innerHTML = h;
  $$('.paper').forEach((el) => (el.onclick = (ev) => {
    if (!ev.target.closest('a')) el.classList.toggle('open');
  }));

  /* 人物 */
  $('#people').innerHTML = D.people.map((p) => `<div class="person">
    <div class="p-h"><b>${esc(p.name)}</b>${p.count > 1 ? `<span class="cnt">${p.count} 篇</span>` : ''}</div>
    <div class="p-org">${esc(p.org)}</div>
    ${p.papers ? `<div class="p-ps">${esc(p.papers)}</div>` : ''}
    ${p.links.length ? `<div class="p-lk">${p.links.map((l) =>
      `<a href="${l.url}" target="_blank" rel="noreferrer">${esc(l.label)} ↗</a>`).join('')}</div>` : ''}
  </div>`).join('');

  $('#videos').innerHTML = tbl(R.videos, ['节目中的提及', '整理结果']);
  $('#talks').innerHTML = tbl(R.talks, ['人物 / 内容', '原始材料']);
  $('#interviews').innerHTML = tbl(R.interviews.map((x) => [
    x.url ? `<a href="${x.url}" target="_blank" rel="noreferrer">${x.title} ↗</a>` : x.title,
    x.who, esc(x.subject)]), ['节目', '人物', '节目内容']);
  $('#books').innerHTML = tbl(R.books, ['题名 / 描述', '作者或来源', '链接 / 状态']);
  $('#extra').innerHTML = tbl(R.extra, ['材料', '节目中的作用', '原始入口']);
  $('#reports').innerHTML = tbl(R.reports, ['材料', '原始入口', '说明']);
  $('#tools').innerHTML = `<ul class="tool-list">${R.tools.map((t) => `<li>${t}</li>`).join('')}</ul>`;

  $$('#res-nav .chip').forEach((c) => (c.onclick = () => {
    $(c.dataset.to).scrollIntoView({ block: 'start' });
  }));
}

/* ---------------- 标签页 ---------------- */
function showTab(id) {
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === id));
  $$('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + id));
  history.replaceState(null, '', '#' + id);
  if (id === 'chronicle') renderChronicle();
  scrollTo({ top: Math.min(scrollY, $('.tabs').offsetTop), behavior: 'instant' });
}
function initTabs() {
  $$('.tab').forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-tab]:not(.tab)');
    if (a) { ev.preventDefault(); showTab(a.dataset.tab); }
    const s = ev.target.closest('[data-seek]');
    if (s && !s.closest('.turn')) { ev.preventDefault(); player.seek(+s.dataset.seek, true); }
  });
  const h = location.hash.slice(1);
  showTab(['transcript', 'chronicle', 'resources'].includes(h) ? h : 'transcript');
}

/* ---------------- 播放器 ---------------- */
const player = {
  a: null, t: 0, playing: false, follow: true, sim: false, turns: [], idx: -1, heads: [],
  init() {
    this.turns = $$('#doc .turn').map((el) => ({ el, t: +el.dataset.t }));
    this.heads = $$('#doc h2');
    this.a = new Audio();
    this.a.preload = 'none';
    this.a.src = D.entry.audio;
    this.a.addEventListener('timeupdate', () => this.tick(this.a.currentTime));
    this.a.addEventListener('error', () => this.fallback());

    $('#pp').innerHTML = ICON.play;
    $('#back15').innerHTML = ICON.back15;
    $('#fwd30').innerHTML = ICON.fwd30;
    $('#p-cover').innerHTML =
      `<img src="${D.entry.cover}" alt="${esc(D.entry.source)} 封面" referrerpolicy="no-referrer">`;
    $('#pp').onclick = () => this.toggle();
    $('#back15').onclick = () => this.seek(this.t - 15, false);
    $('#fwd30').onclick = () => this.seek(this.t + 30, false);
    $('#p-bar').onclick = (ev) => {
      const r = ev.currentTarget.getBoundingClientRect();
      this.seek(((ev.clientX - r.left) / r.width) * D.entry.duration, false);
    };
    $('#rate').onclick = (ev) => {
      const r = [1, 1.25, 1.5, 1.75, 2];
      const n = r[(r.indexOf(this.a.playbackRate) + 1) % r.length];
      this.a.playbackRate = n;
      ev.currentTarget.textContent = n + '×';
    };
    $('#play-top').onclick = (ev) => { ev.preventDefault(); this.seek(0, true); };
    this.tick(0);
  },
  fallback() {
    if (this.sim) return;
    this.sim = true;
    $('#p-note').textContent = '· 音频源未直连，演示为模拟走时';
    if (this.playing) this.simTimer();
  },
  simTimer() {
    clearInterval(this._i);
    this._i = setInterval(() => { if (this.playing) this.tick(this.t + 1); }, 1000);
  },
  toggle() {
    this.playing = !this.playing;
    $('#pp').innerHTML = this.playing ? ICON.pause : ICON.play;
    if (this.sim) { this.simTimer(); return; }
    this.playing ? this.a.play().catch(() => this.fallback()) : this.a.pause();
  },
  seek(t, play) {
    t = Math.max(0, Math.min(D.entry.duration, t));
    this.t = t;
    if (!this.sim) { try { this.a.currentTime = t; } catch (e) { this.fallback(); } }
    if (play && !this.playing) this.toggle(); else this.tick(t);
  },
  tick(t) {
    this.t = t;
    $('#p-fill').style.width = (t / D.entry.duration) * 100 + '%';
    $('#p-time').textContent = `${hms(t)} / ${hms(D.entry.duration)}`;
    if (!this.turns.length) return;
    let lo = 0, hi = this.turns.length - 1, k = 0;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (this.turns[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; }
    if (k === this.idx) return;
    this.turns[this.idx]?.el.classList.remove('cur');
    this.idx = k;
    const el = this.turns[k].el;
    el.classList.add('cur');
    const head = this.heads.filter((h) => h.compareDocumentPosition(el) & 4).pop();
    if (head) {
      $$('.ol-item').forEach((b) => b.classList.toggle('cur', 's' + b.dataset.s === head.id));
      $('#p-now').textContent = head.textContent;
    }
    if (this.follow && this.playing && $('#pane-transcript').classList.contains('on')) {
      const r = el.getBoundingClientRect();
      if (r.top < 90 || r.bottom > innerHeight - 120) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  },
};

/* ---------------- 启动 ---------------- */
if ($('#brand-logo')) $('#brand-logo').innerHTML = LOGO;
if ($('#entries')) renderList();
if ($('#doc')) {
  renderHead(); renderTranscript(); renderResources();
  initReaderBar(); initTabs(); player.init();
  $('#p-name').textContent = D.entry.title;
  addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(window.redrawChronicle, 200); });
  addEventListener('keydown', (ev) => {
    if (ev.target.matches('input,textarea')) return;
    if (ev.key === ' ') { ev.preventDefault(); player.toggle(); }
    if (ev.key === 'ArrowLeft') player.seek(player.t - 15, false);
    if (ev.key === 'ArrowRight') player.seek(player.t + 30, false);
  });
}
