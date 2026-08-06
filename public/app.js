/* ============================================================
   learn-ai · 浏览器侧
   内容已在构建期渲染进 HTML，这里只做三件事：交互、编年史 SVG、埋点。
   ============================================================ */
const LA = window.LA || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad((s / 3600) | 0)}:${pad(((s % 3600) / 60) | 0)}:${pad(s % 60)}`;
};

/* ============================================================
   埋点 —— 打到自建的 /analytics（ProductAnalytics，产品 learn_ai）
   不引第三方脚本，不放 cookie，visitor_id 是本地生成的随机串。
   ============================================================ */
const TRACK_URL = '/analytics/api/events';
const VID = (() => {
  try {
    let v = localStorage.getItem('la-vid');
    if (!v) {
      v = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now().toString(36));
      localStorage.setItem('la-vid', v);
    }
    return v;
  } catch { return ''; }        // 隐私模式下取不到就退回服务端的 hash(ip|ua)
})();

function track(event, extra = {}) {
  try {
    const body = JSON.stringify({
      product: 'learn_ai', event, visitor_id: VID,
      path: location.pathname, referrer: document.referrer, ...extra,
    });
    // sendBeacon 在页面跳走 / 开始下载时也不会被打断
    if (navigator.sendBeacon) navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'application/json' }));
    else fetch(TRACK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch { /* 统计失败不能影响页面 */ }
}

track('page_view');

/* 阅读进度：25/50/75/100% 各打一次，用来判断长文是不是真被读了 */
function initReadProgress() {
  const doc = $('#doc');
  if (!doc) return;
  const hit = new Set();
  addEventListener('scroll', () => {
    const r = doc.getBoundingClientRect();
    const seen = Math.min(1, Math.max(0, (innerHeight - r.top) / r.height));
    for (const m of [25, 50, 75, 100]) {
      if (seen * 100 >= m && !hit.has(m)) { hit.add(m); track('read_progress', { detail: m + '%' }); }
    }
  }, { passive: true });
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
  $$('.tab').forEach((t) => (t.onclick = () => { showTab(t.dataset.tab); track('tab_view', { detail: t.dataset.tab }); }));
  document.addEventListener('click', (ev) => {
    const s = ev.target.closest('[data-seek]');
    if (s && !s.closest('.turn')) { ev.preventDefault(); player.seek(+s.dataset.seek, true); }
    const dl = ev.target.closest('[data-dl]');
    if (dl) track('download_started', { detail: dl.dataset.dl });
  });
  const h = location.hash.slice(1);
  showTab(['transcript', 'chronicle', 'resources'].includes(h) ? h : 'transcript');
}

/* ---------------- 文稿 ---------------- */
function initReader() {
  $$('.ol-item').forEach((b) => (b.onclick = () => {
    $('#toc-sheet').classList.remove('on');
    $('#s' + b.dataset.s).scrollIntoView({ block: 'start' });
  }));
  $$('#doc .turn-t').forEach((b) => (b.onclick = () => player.seek(+b.dataset.seek, true)));
  $('#toc-btn').onclick = () => $('#toc-sheet').classList.add('on');
  $('#toc-x').onclick = () => $('#toc-sheet').classList.remove('on');
}

/* ---------------- 资料 ---------------- */
function initResources() {
  $$('.paper').forEach((el) => (el.onclick = (ev) => {
    if (!ev.target.closest('a')) el.classList.toggle('open');
  }));
  $$('#res-nav .chip').forEach((c) => (c.onclick = () => $(c.dataset.to).scrollIntoView({ block: 'start' })));
}

/* ---------------- 编年史（PCB 走线） ---------------- */
const CH = { mode: 'even' };
const ym = (d) => { const [y, m] = d.split('.').map(Number); return y + (m - 1) / 12; };
const cut = (s, k) => (s.length > k ? s.slice(0, k - 1) + '…' : s);

function trackSVG(tr, vertical, avail) {
  const nodes = [...tr.nodes].sort((a, b) => ym(a.date) - ym(b.date));
  const N = nodes.length;
  const all = LA.chronicle.flatMap((t) => t.nodes.map((n) => ym(n.date)));
  const lo = Math.min(...all), hi = Math.max(...all);

  if (vertical) {
    const STEP = 78, PADT = 34, W = Math.max(280, avail), H = PADT * 2 + (N - 1) * STEP, LX = 100;
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

  const PADX = 74, W = Math.max(700, avail), H = 372;
  const RAIL = 250, RISE = 30, JOG = 46;
  const ABOVE = { d: 54, n: 74, s: 92, lead: 104 };
  const BELOW = { d: 300, n: 320, s: 338, lead: 288 };

  let xs;
  if (CH.mode === 'time') {
    xs = nodes.map((n) => PADX + ((ym(n.date) - lo) / (hi - lo)) * (W - PADX * 2));
    for (let i = 1; i < N; i++) if (xs[i] - xs[i - 1] < 26) xs[i] = xs[i - 1] + 26;
  } else xs = nodes.map((_, i) => PADX + i * ((W - PADX * 2) / Math.max(1, N - 1)));

  const pts = nodes.map((n, i) => ({
    x: xs[i], y: RAIL - Math.round((i / (N - 1)) * 3) * RISE - (i % 2 ? JOG : 0), n, above: i % 2 === 0,
  }));
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
  if (!box || !LA.chronicle) return;
  const vertical = innerWidth < 861;
  const avail = Math.max(300, box.clientWidth - 4);
  box.innerHTML = LA.chronicle.map((tr) => {
    const { W, H, svg } = trackSVG(tr, vertical, avail - 28);
    return `<section class="track" data-track="${tr.id}">
      <div class="track-h"><h3>${esc(tr.name)}</h3><span class="n">${tr.nodes.length} 个节点</span></div>
      <div class="track-scroll"><svg class="track-svg" viewBox="0 0 ${W} ${H}"
        style="width:${W}px;height:${H}px" role="img" aria-label="${esc(tr.name)}时间线">${svg}</svg></div>
    </section>`;
  }).join('');
  $$('.tr-node').forEach((g) => (g.onclick = () => openNode(g)));
}

/* 卡片贴着被点的焊盘出现：优先在下方，下方被播放条挡住就翻到上方 */
function placeCard(el, g) {
  if (innerWidth < 861) return;
  const p = g.querySelector('.tr-pad').getBoundingClientRect();
  const w = el.offsetWidth, h = el.offsetHeight;
  const GAP = 12, PLAYER = 76, TOPBAR = 112;
  el.style.left = Math.max(12, Math.min(innerWidth - w - 12, p.left + p.width / 2 - w / 2)) + 'px';
  const below = p.bottom + GAP, above = p.top - GAP - h;
  const top = (below + h <= innerHeight - PLAYER || above < TOPBAR) ? below : above;
  el.style.top = Math.max(TOPBAR, Math.min(innerHeight - PLAYER - h, top)) + scrollY + 'px';
}

function openNode(g) {
  $('#node-card')?.remove();
  $$('.tr-node').forEach((x) => x.classList.remove('sel'));
  g.classList.add('sel');
  const tr = LA.chronicle.find((t) => t.id === g.dataset.track);
  const n = [...tr.nodes].sort((a, b) => ym(a.date) - ym(b.date))[+g.dataset.i];
  const paper = LA.papers[n.paper];
  const sec = n.section >= 0 ? LA.sections[n.section] : null;
  track('chronicle_node', { detail: `${tr.id}/${n.paper}` });

  const el = document.createElement('div');
  el.id = 'node-card';
  el.className = 'node-card';
  el.innerHTML = `<button class="x">×</button>
    <div class="d">${n.date}</div><h4>${esc(n.name)}</h4>
    <p>${esc(n.sub)}${paper ? '。' + esc(paper.meaning) + '…' : ''}</p>
    <div class="acts">
      ${sec ? `<button class="btn" data-go="${sec.i}">读这一段</button>` : ''}
      ${sec ? `<button class="btn" data-jump="${sec.t}">▶ 跳播</button>` : ''}
      ${paper ? `<a class="btn" href="${paper.link}" target="_blank" rel="noreferrer">原文 ↗</a>` : ''}
    </div>`;
  document.body.appendChild(el);
  placeCard(el, g);
  el.querySelector('.x').onclick = () => { el.remove(); g.classList.remove('sel'); };
  el.querySelector('[data-go]')?.addEventListener('click', (ev) => {
    showTab('transcript');
    $('#s' + ev.currentTarget.dataset.go).scrollIntoView({ block: 'start' });
    el.remove();
  });
  el.querySelector('[data-jump]')?.addEventListener('click',
    (ev) => player.seek(+ev.currentTarget.dataset.jump, true));
}

/* ---------------- 播放器 ---------------- */
const ICON = {
  play: '<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8c0-.6.7-1 1.2-.7l7 5.2c.4.3.4.9 0 1.2l-7 5.2c-.5.4-1.2 0-1.2-.6V2.8z"/></svg>',
  pause: '<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="2.5" width="3" height="11" rx="1"/><rect x="9" y="2.5" width="3" height="11" rx="1"/></svg>',
  back15: '<svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.4 8.6A7.2 7.2 0 1 1 3.8 14" stroke-linecap="round"/><path d="M3.2 4.2v4.6h4.6" stroke-linecap="round" stroke-linejoin="round"/><text x="11" y="14.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="-apple-system,system-ui,sans-serif">15</text></svg>',
  fwd30: '<svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.6 8.6A7.2 7.2 0 1 0 18.2 14" stroke-linecap="round"/><path d="M18.8 4.2v4.6h-4.6" stroke-linecap="round" stroke-linejoin="round"/><text x="11" y="14.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="-apple-system,system-ui,sans-serif">30</text></svg>',
};

const player = {
  a: null, t: 0, playing: false, follow: true, sim: false, turns: [], idx: -1, heads: [], played: false,
  init() {
    this.turns = $$('#doc .turn').map((el) => ({ el, t: +el.dataset.t }));
    this.heads = $$('#doc h2');
    this.a = new Audio();
    this.a.preload = 'none';
    this.a.src = LA.audio;
    this.a.addEventListener('timeupdate', () => this.tick(this.a.currentTime));
    this.a.addEventListener('error', () => this.fallback());

    $('#pp').innerHTML = ICON.play;
    $('#back15').innerHTML = ICON.back15;
    $('#fwd30').innerHTML = ICON.fwd30;
    $('#pp').onclick = () => this.toggle();
    $('#back15').onclick = () => this.seek(this.t - 15, false);
    $('#fwd30').onclick = () => this.seek(this.t + 30, false);
    $('#p-bar').onclick = (ev) => {
      const r = ev.currentTarget.getBoundingClientRect();
      this.seek(((ev.clientX - r.left) / r.width) * LA.duration, false);
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
    $('#p-note').textContent = '· 音频源暂时取不到';
  },
  toggle() {
    this.playing = !this.playing;
    $('#pp').innerHTML = this.playing ? ICON.pause : ICON.play;
    if (this.playing && !this.played) { this.played = true; track('play_started'); }
    if (this.sim) return;
    this.playing ? this.a.play().catch(() => this.fallback()) : this.a.pause();
  },
  seek(t, play) {
    t = Math.max(0, Math.min(LA.duration, t));
    this.t = t;
    if (!this.sim) { try { this.a.currentTime = t; } catch { this.fallback(); } }
    if (play && !this.playing) this.toggle(); else this.tick(t);
  },
  tick(t) {
    this.t = t;
    $('#p-fill').style.width = (t / LA.duration) * 100 + '%';
    $('#p-time').textContent = `${hms(t)} / ${hms(LA.duration)}`;
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
// 一处初始化失败不该把整页拖死（少一个按钮 ≠ 白页），逐个隔离
const safe = (name, fn) => { try { fn(); } catch (e) { console.error('[init] ' + name, e); } };

if ($('#doc')) {
  safe('reader', initReader); safe('resources', initResources); safe('tabs', initTabs);
  safe('progress', initReadProgress); safe('player', () => player.init());
  $$('[data-mode]').forEach((b) => (b.onclick = () => {
    CH.mode = b.dataset.mode;
    $$('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    renderChronicle();
  }));
  addEventListener('resize', () => {
    clearTimeout(window._rz);
    window._rz = setTimeout(() => { if ($('#pane-chronicle').classList.contains('on')) renderChronicle(); }, 200);
  });
  addEventListener('keydown', (ev) => {
    if (ev.target.matches('input,textarea')) return;
    if (ev.key === ' ') { ev.preventDefault(); player.toggle(); }
    if (ev.key === 'ArrowLeft') player.seek(player.t - 15, false);
    if (ev.key === 'ArrowRight') player.seek(player.t + 30, false);
  });
}
