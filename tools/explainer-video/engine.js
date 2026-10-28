import { W, H, C, DARK, clamp, lerp, ease, easeOut, estimate, setSize } from './lib.js';

const SANS = `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif`;
const MATH = `"Times New Roman", Times, Georgia, serif`;
const MONO = `"SF Mono", ui-monospace, Menlo, monospace`;
const FONTS = { sans: SANS, math: MATH, mono: MONO };

export const warnings = [];

// ---------- 数学排版：_{} ^{} \sqrt{} \frac{}{} ----------
const UPRIGHT = new Set(['softmax', 'sin', 'cos', 'exp', 'max', 'Attention', 'Concat', 'MultiHead', 'head', 'PE', 'FFN', 'ReLU', 'tanh', 'LayerNorm', 'x', 'in', 'out', 'log', 'KL', 'ELBO', 'min', 'JSD', 'data']);
function parseMath(s) {
  let i = 0;
  const atom = () => {
    if (s[i] === '{') { i++; const it = group('}'); i++; return { t: 'g', items: it }; }
    if (s.startsWith('\\sqrt', i)) { i += 5; return { t: 'sqrt', arg: atom() }; }
    if (s.startsWith('\\frac', i)) { i += 5; const a = atom(), b = atom(); return { t: 'frac', a, b }; }
    return tok(s[i++]);
  };
  const tok = (str) => ({ t: 'txt', s: str, it: /^[A-Za-z]$/.test(str) });
  function run(str) {
    const out = [];
    const re = /[A-Za-z]+|[0-9.]+|\s+|./gu;
    for (const m of str.matchAll(re)) {
      const w = m[0];
      if (/^[A-Za-z]+$/.test(w) && !UPRIGHT.has(w)) for (const ch of w) out.push(tok(ch));
      else if (/^[A-Za-z]+$/.test(w)) out.push({ t: 'txt', s: w, it: false });
      else out.push({ t: 'txt', s: w, it: false });
    }
    return out;
  }
  function group(end) {
    const items = [];
    while (i < s.length && s[i] !== end) {
      const ch = s[i];
      if (ch === '{' || s.startsWith('\\sqrt', i) || s.startsWith('\\frac', i)) items.push(atom());
      else if (ch === '_' || ch === '^') {
        i++; const arg = atom();
        let prev = items.pop() || tok('');
        if (prev.t !== 'script') prev = { t: 'script', base: prev };
        prev[ch === '_' ? 'sub' : 'sup'] = arg; items.push(prev);
      } else {
        let j = i; while (j < s.length && !'{}_^\\'.includes(s[j]) && s[j] !== end) j++;
        if (j === i) j++;
        items.push(...run(s.slice(i, j))); i = j;
      }
    }
    return items;
  }
  return { t: 'g', items: group(undefined) };
}

function layoutMath(ctx, node, size, color) {
  const asc = size * 0.72, desc = size * 0.24;
  if (node.t === 'txt') {
    const cjk = /[　-鿿＀-￯]/.test(node.s);
    const font = cjk ? `${Math.round(size * 0.9)}px ${SANS}` : `${node.it ? 'italic ' : ''}${size}px ${MATH}`;
    ctx.font = font;
    const w = ctx.measureText(node.s).width + (node.it ? size * 0.04 : 0);
    return { w, asc, desc, draw(x, y) { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(node.s, x, y); } };
  }
  if (node.t === 'g') {
    const parts = node.items.map((n) => layoutMath(ctx, n, size, color));
    return {
      w: parts.reduce((a, p) => a + p.w, 0), asc: Math.max(asc, ...parts.map((p) => p.asc)), desc: Math.max(desc, ...parts.map((p) => p.desc)),
      draw(x, y) { for (const p of parts) { p.draw(x, y); x += p.w; } },
    };
  }
  if (node.t === 'script') {
    const b = layoutMath(ctx, node.base, size, color);
    const ss = size * 0.66;
    const sub = node.sub && layoutMath(ctx, node.sub, ss, color);
    const sup = node.sup && layoutMath(ctx, node.sup, ss, color);
    const sw = Math.max(sub ? sub.w : 0, sup ? sup.w : 0);
    return {
      w: b.w + sw + size * 0.04, asc: Math.max(b.asc, sup ? size * 0.42 + sup.asc : 0), desc: Math.max(b.desc, sub ? size * 0.2 + sub.desc : 0),
      draw(x, y) { b.draw(x, y); if (sub) sub.draw(x + b.w + 1, y + size * 0.2); if (sup) sup.draw(x + b.w + 1, y - size * 0.42); },
    };
  }
  if (node.t === 'sqrt') {
    const a = layoutMath(ctx, node.arg, size, color);
    const rw = size * 0.55, top = a.asc + size * 0.1;
    return {
      w: rw + a.w + size * 0.08, asc: top + 3, desc: a.desc,
      draw(x, y) {
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, size * 0.05); ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x, y - size * 0.3); ctx.lineTo(x + rw * 0.3, y - size * 0.38);
        ctx.lineTo(x + rw * 0.55, y + a.desc * 0.6); ctx.lineTo(x + rw * 0.95, y - top); ctx.lineTo(x + rw + a.w + size * 0.04, y - top); ctx.stroke();
        a.draw(x + rw, y);
      },
    };
  }
  if (node.t === 'frac') {
    const fs = size * 0.88;
    const n = layoutMath(ctx, node.a, fs, color), d = layoutMath(ctx, node.b, fs, color);
    const w = Math.max(n.w, d.w) + size * 0.3, axis = size * 0.3, gap = size * 0.12;
    return {
      w: w + size * 0.1, asc: axis + gap + n.desc + n.asc, desc: -axis + gap + d.asc + d.desc,
      draw(x, y) {
        const cx = x + size * 0.05 + w / 2;
        n.draw(cx - n.w / 2, y - axis - gap - n.desc);
        d.draw(cx - d.w / 2, y - axis + gap + d.asc);
        ctx.fillStyle = color; ctx.fillRect(x + size * 0.05, y - axis - 1, w, Math.max(1.5, size * 0.045));
      },
    };
  }
  throw new Error('math node ' + node.t);
}

// ---------- 画图工具 ----------
export function makeG(ctx) {
  const g = {
    ctx, W, H, C, clamp, lerp, ease, easeOut,
    font(size, weight = 400, fam = 'sans') { return `${weight} ${size}px ${FONTS[fam] || fam}`; },
    text(s, x, y, o = {}) {
      const { size = 32, weight = 400, color = C.ink, align = 'left', base = 'alphabetic', fam = 'sans', alpha = 1, italic = false, maxW } = o;
      if (alpha <= 0) return 0;
      ctx.save(); ctx.globalAlpha *= alpha;
      ctx.font = (italic ? 'italic ' : '') + g.font(size, weight, fam); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
      if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
      const w = ctx.measureText(s).width;
      if (maxW && w > maxW) warnings.push(`文字超宽 ${Math.round(w)}>${maxW}: ${s}`);
      ctx.fillText(s, x, y); ctx.restore(); return w;
    },
    measure(s, size = 32, weight = 400, fam = 'sans') { ctx.save(); ctx.font = g.font(size, weight, fam); const w = ctx.measureText(s).width; ctx.restore(); return w; },
    math(s, x, y, o = {}) {
      const { size = 40, color = C.ink, align = 'left', alpha = 1 } = o;
      if (alpha <= 0) return 0;
      ctx.save(); ctx.globalAlpha *= alpha;
      const L = layoutMath(ctx, parseMath(s), size, color);
      const x0 = align === 'center' ? x - L.w / 2 : align === 'right' ? x - L.w : x;
      L.draw(x0, y); ctx.restore(); return L.w;
    },
    mathW(s, size = 40) { return layoutMath(ctx, parseMath(s), size, C.ink).w; },
    rrect(x, y, w, h, r, o = {}) {
      const { fill, stroke, lw = 2, alpha = 1, dash } = o;
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha *= alpha;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.stroke(); }
      ctx.restore();
    },
    circle(x, y, r, o = {}) {
      const { fill, stroke, lw = 2, alpha = 1 } = o;
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
      ctx.restore();
    },
    line(x1, y1, x2, y2, o = {}) {
      const { color = C.ink, lw = 2, alpha = 1, dash, cap = 'round' } = o;
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = cap;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    },
    poly(pts, o = {}) {
      const { color = C.ink, lw = 2, alpha = 1, fill, close = false, dash } = o;
      if (alpha <= 0 || pts.length < 2) return;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      if (close) ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (lw) { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash); ctx.stroke(); }
      ctx.restore();
    },
    arrow(x1, y1, x2, y2, o = {}) {
      const { color = C.ink, lw = 2.5, alpha = 1, head = 13, dash, p = 1 } = o;
      if (alpha <= 0 || p <= 0) return;
      const x = lerp(x1, x2, p), y = lerp(y1, y2, p), a = Math.atan2(y - y1, x - x1);
      const bx = x - Math.cos(a) * head * 0.8, by = y - Math.sin(a) * head * 0.8;
      g.line(x1, y1, bx, by, { color, lw, alpha, dash });
      ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a - 0.42) * head, y - Math.sin(a - 0.42) * head);
      ctx.lineTo(x - Math.cos(a + 0.42) * head, y - Math.sin(a + 0.42) * head); ctx.closePath(); ctx.fill(); ctx.restore();
    },
    curve(x1, y1, cx, cy, x2, y2, o = {}) {
      const { color = C.ink, lw = 2, alpha = 1, p = 1, dash } = o;
      if (alpha <= 0 || p <= 0) return;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      const N = 40;
      for (let k = 1; k <= Math.round(N * p); k++) {
        const t = k / N, u = 1 - t;
        ctx.lineTo(u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2);
      }
      ctx.stroke(); ctx.restore();
    },
    // 一个数值格子：正数青、负数琥珀，深浅按绝对值。
    cellColor(v, max = 1) {
      const t = clamp(Math.abs(v) / max);
      return v >= 0 ? g.mixc(C.white, C.teal, 0.12 + t * 0.78) : g.mixc(C.white, C.amber, 0.12 + t * 0.7);
    },
    mixc(a, b, t) { return mixHex(a, b, t); },
    vec(x, y, vals, o = {}) {
      const { cw = 64, ch = 52, gap = 4, dir = 'h', nums = true, max = 1, alpha = 1, size = 22, fmt = (v) => fmtNum(v), colors, stroke = C.line, reveal = 1 } = o;
      if (alpha <= 0) return;
      vals.forEach((v, i) => {
        const a = clamp(reveal * vals.length - i);
        if (a <= 0) return;
        const cx = dir === 'h' ? x + i * (cw + gap) : x, cy = dir === 'h' ? y : y + i * (ch + gap);
        const fill = colors ? colors[i] : g.cellColor(v, max);
        g.rrect(cx, cy, cw, ch, 6, { fill, stroke, lw: 1.5, alpha: alpha * a });
        if (nums) {
          const dark = colors ? false : Math.abs(v) / max > 0.55;
          g.text(fmt(v), cx + cw / 2, cy + ch / 2 + 1, { size, align: 'center', base: 'middle', color: dark ? C.white : C.ink, fam: 'math', alpha: alpha * a });
        }
      });
    },
    // 标题 + 章节里的大字
    title(s, p = 1, o = {}) {
      const a = easeOut(p);
      g.text(s, W / 2, (o.y || 168) + (1 - a) * 16, { size: o.size || 58, weight: 700, align: 'center', alpha: a, color: o.color || C.ink, spacing: -0.5 });
    },
    tag(s, x, y, o = {}) {
      const { size = 22, color = C.ink3, alpha = 1, align = 'center' } = o;
      g.text(s, x, y, { size, color, align, alpha });
    },
    note(s, x, y, o = {}) {
      // 「示意，非实测」这类角标
      const { alpha = 1, align = 'right' } = o;
      const w = g.measure(s, 20);
      const x0 = align === 'right' ? x - w - 28 : align === 'center' ? x - (w + 28) / 2 : x;
      g.rrect(x0, y - 20, w + 28, 38, 19, { fill: C.amberL, stroke: '#EACB9A', lw: 1.5, alpha });
      g.text(s, x0 + 14, y + 6, { size: 20, color: C.amberD, alpha });
    },
    chip(s, x, y, o = {}) {
      const { size = 30, fill = C.white, stroke = C.line, color = C.ink, alpha = 1, pad = 20, h = 60, weight = 500, lw = 2, align = 'center' } = o;
      const w = g.measure(s, size, weight) + pad * 2;
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      g.rrect(x0, y - h / 2, w, h, 12, { fill, stroke, lw, alpha });
      g.text(s, x0 + w / 2, y + 1, { size, weight, color, align: 'center', base: 'middle', alpha });
      return w;
    },
  };
  return g;
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const r = Math.round(ch(pa, 16) + (ch(pb, 16) - ch(pa, 16)) * t), gg = Math.round(ch(pa, 8) + (ch(pb, 8) - ch(pa, 8)) * t), bb = Math.round(ch(pa, 0) + (ch(pb, 0) - ch(pa, 0)) * t);
  return `rgb(${r},${gg},${bb})`;
}
export function fmtNum(v) {
  const s = Math.abs(v).toFixed(2).replace(/\.?0+$/, '');
  return (v < 0 && s !== '0' ? '−' : '') + s;
}

// ---------- 时间轴 ----------
export function buildTimeline(video, timing) {
  const LEAD = 0.7, GAP = 0.45, TAIL = 1.1;
  let T = 0;
  const scenes = video.scenes.map((sc, k) => {
    const lines = [];
    let t = sc.lead ?? LEAD;
    sc.lines.forEach((ln, i) => {
      const d = timing ? timing.scenes[k].lines[i].dur : estimate(ln.say || ln.sub);
      lines.push({ ...ln, start: t, end: t + d });
      t += d + GAP + (ln.hold || 0);
    });
    const dur = t - GAP + (sc.tail ?? TAIL);
    const out = { ...sc, index: k, start: T, dur, lines };
    T += dur;
    return out;
  });
  return { scenes, total: T };
}

function sceneCtx(sc, t) {
  const L = sc.lines;
  return {
    t, dur: sc.dur,
    s: (i) => L[i].start, e: (i) => L[i].end,
    // 第 i 句开口后 off 秒起、d 秒内从 0 走到 1
    p: (i, d = 0.8, off = 0) => easeOut((t - L[i].start - off) / d),
    lin: (i, d = 1, off = 0) => clamp((t - L[i].start - off) / d),
    at: (i, frac) => L[i].start + (L[i].end - L[i].start) * frac,
    pAt: (i, frac, d = 0.8) => easeOut((t - (L[i].start + (L[i].end - L[i].start) * frac)) / d),
    out: (d = 0.5) => 1 - clamp((t - (sc.dur - d)) / d),
  };
}

export function renderFrame(g, tl, video, T) {
  const { ctx } = g;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // 淡网格背景
  ctx.save(); ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  ctx.restore();

  let k = tl.scenes.findIndex((s) => T >= s.start && T < s.start + s.dur);
  if (k < 0) k = tl.scenes.length - 1;
  const sc = tl.scenes[k], t = T - sc.start;
  const fade = Math.min(clamp(t / 0.45), clamp((sc.dur - t) / 0.45));
  ctx.save(); ctx.globalAlpha = k === 0 ? Math.min(1, clamp((sc.dur - t) / 0.45)) : fade;
  if (video.meta.drift) {
    // 镜头缓慢推近：每个场景从 1 推到 1 + drift，中心略偏上（避开字幕区）
    const z = 1 + video.meta.drift * ease(t / sc.dur);
    const cy = video.meta.driftY ?? 520;
    ctx.translate(W / 2, cy); ctx.scale(z, z); ctx.translate(-W / 2, -cy);
  }
  sc.draw(g, t, sceneCtx(sc, t));
  ctx.restore();
  // 常驻图层（竖版的顶部大标题这类），画在场景之上、字幕之下
  if (video.meta.overlay) video.meta.overlay(g, T, tl);

  // 章节条
  const chapters = [];
  tl.scenes.forEach((s) => { if (!chapters.length || chapters.at(-1).name !== s.chapter) chapters.push({ name: s.chapter, start: s.start, end: s.start + s.dur }); else chapters.at(-1).end = s.start + s.dur; });
  const ci = chapters.findIndex((c) => T >= c.start && T < c.end);
  if (!video.meta.noChip && (k > 0 || video.meta.chipOnFirst)) {
    const label = `${String(ci + 1).padStart(2, '0')}  ${chapters[ci < 0 ? 0 : ci].name}`;
    g.rrect(64, 44, g.measure(label, 24, 600) + 64, 48, 24, { fill: C.white, stroke: C.line, lw: 1.5 });
    g.circle(88, 68, 7, { fill: C.teal });
    g.text(label, 104, 69, { size: 24, weight: 600, color: C.ink, base: 'middle' });
  }
  if (video.meta.brand) g.text(video.meta.brand, W - 64, 76, { size: 22, color: C.ink3, align: 'right' });

  // 字幕
  const li = sc.lines.findIndex((ln, i) => t >= ln.start - 0.05 && t < (sc.lines[i + 1] ? sc.lines[i + 1].start - 0.05 : sc.dur - 0.2));
  if (li >= 0) {
    const ln = sc.lines[li];
    const a = clamp((t - ln.start + 0.05) / 0.18);
    const s = ln.sub;
    // 字幕：默认横版底部一行；竖版用 meta.sub = { y, size, maxW }，放不下就在最靠中间的逗号处断成两行
    const so = video.meta.sub || {};
    const maxW = so.maxW ?? 1640, sy = so.y ?? 950;
    let size = so.size ?? 40;
    let rows = [s];
    if (so.wrap && g.measure(s, size, 500) > maxW) {
      const cuts = [...s.matchAll(/[，；：、。？]/g)].filter((m) => m.index < s.length - 1).map((m) => m.index + 1);
      if (cuts.length) { const c = cuts.reduce((b, x) => (Math.abs(x - s.length / 2) < Math.abs(b - s.length / 2) ? x : b)); rows = [s.slice(0, c), s.slice(c)]; }
    }
    let w = Math.max(...rows.map((r) => g.measure(r, size, 500)));
    if (w > maxW) { warnings.push(`字幕超宽 ${Math.round(w)}: ${s}`); size = Math.floor(size * maxW / w); w = Math.max(...rows.map((r) => g.measure(r, size, 500))); }
    const lh = size * 1.45, bh = lh * rows.length + size * 0.35;
    g.rrect(W / 2 - w / 2 - 34, sy, w + 68, bh, 14, { fill: C.subBg, alpha: a });
    rows.forEach((r, i) => g.text(r, W / 2, sy + size * 0.18 + lh * (i + 0.5), { size, weight: 500, color: C.subFg, align: 'center', base: 'middle', alpha: a }));
  }

  // 进度条
  const pw = W, py = H - 6;
  ctx.fillStyle = C.line2; ctx.fillRect(0, py, pw, 6);
  ctx.fillStyle = C.teal; ctx.fillRect(0, py, pw * T / tl.total, 6);
  ctx.fillStyle = C.bg; for (const c of chapters.slice(1)) ctx.fillRect(pw * c.start / tl.total - 2, py, 4, 6);
}

// ---------- 浏览器入口 ----------
export async function boot(canvas, videoPath, q) {
  const video = (await import(videoPath)).default;
  const dir = videoPath.replace(/[^/]+$/, '');
  let timing = null;
  try { const r = await fetch(dir + 'build/timing.json', { cache: 'no-store' }); if (r.ok) timing = await r.json(); } catch {}
  if (timing && timing.scenes.length !== video.scenes.length) timing = null;
  const tl = buildTimeline(video, timing);
  if (video.meta.theme === 'dark') Object.assign(C, DARK);
  if (video.meta.size) { setSize(...video.meta.size); canvas.width = W; canvas.height = H; }
  await document.fonts.ready;
  const ctx = canvas.getContext('2d');
  const g = makeG(ctx);
  g.img = {};
  await Promise.all(Object.entries(video.meta.images || {}).map(([k, src]) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { g.img[k] = im; res(); }; im.onerror = () => rej(new Error('image ' + src)); im.src = dir + src;
  })));
  window.TL = tl;
  window.renderAt = (T) => renderFrame(g, tl, video, T);
  window.frame = (T, q = 0.9) => { renderFrame(g, tl, video, T); return canvas.toDataURL('image/jpeg', q).slice(23); };
  window.takeWarnings = () => warnings.splice(0);
  window.ready = true;
  if (q.has('t')) return window.renderAt(parseFloat(q.get('t')));
  if (q.has('play')) {
    const audio = new Audio(dir + 'build/audio.m4a');
    let t0 = parseFloat(q.get('play') || '0') || 0;
    canvas.addEventListener('click', () => { if (audio.paused) { audio.currentTime = t0; audio.play(); } else { t0 = audio.currentTime; audio.pause(); } });
    const loop = () => { window.renderAt(audio.paused ? t0 : audio.currentTime); requestAnimationFrame(loop); };
    loop();
    return;
  }
  window.renderAt(0);
}
