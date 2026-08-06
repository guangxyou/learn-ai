#!/usr/bin/env node
/**
 * 生成「文稿 + 媒体」本地阅读页 —— 单个自包含 HTML，双击就能开，不用起服务。
 *
 *   node tools/make-reader.mjs 02_Attention/ep119-kimi-linear
 *
 * 约定：期目录下有 02-精校稿.md，外加 video/*.mp4 或 audio/*.m4a|mp3。
 *
 * 每期的媒体形态是**目录里的事实，不是运行时开关**：
 *   有 video/ → 视频页（右侧视频台，可切宽屏，为的是看清投屏里的论文页）
 *   有 audio/ → 音频页（顶部一条播放条 + 封面，单栏，没有宽屏这回事）
 * 两者都没有就直接报错。跳转、跟随、目录、灯箱、快捷键两种页面完全一样。
 *
 * 媒体走相对路径，所以生成的 阅读.html 要和 video/ ｜ audio/ 放在同一层。
 */
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseTranscript, esc, inline, plain } from '../src/parse.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('用法：node tools/make-reader.mjs <素材目录>');
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => {
  s = Math.max(0, Math.floor(s));
  return `${pad((s / 3600) | 0)}:${pad(((s % 3600) / 60) | 0)}:${pad(s % 60)}`;
};

const md = await readFile(join(dir, '02-精校稿.md'), 'utf8');

/* ---- frontmatter：标题、副标题、元信息、论文表 ---- */
const head = md.split(/\n## /)[0];
const title = /^#\s+(.+)/m.exec(head)?.[1].trim() ?? basename(dir);
const subtitle = plain(/^\*\*(.+)\*\*\s*$/m.exec(head)?.[1] ?? '');
const metaLine = plain((/^>\s*(.+EP\d+.+)$/m.exec(head)?.[1] ?? '')).replace(/\s*｜\s*/g, ' · ');
const allLinks = [...head.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)]
  .filter(([, t]) => !/校订/.test(t))
  .map(([, t, u]) => ({ t: t.replace(/（.*?）/g, '').trim(), u }));
/* 播客本身归「原节目」，其余（论文、讲义）归「课件」，一起放页尾资料区。
   按域名分比按链接文字分稳：往期节目的文字是它自己的标题，认不出来。 */
const isShow = (l) => /xiaoyuzhoufm|bilibili|podcast/.test(l.u) || /音频|视频版|播客/.test(l.t);
const showLinks = allLinks.filter(isShow);
const paperLinks = allLinks.filter((l) => !isShow(l));

/* ---- 说话人：frontmatter 的「对谈：A × B」 ---- */
const spk = [...head.matchAll(/\*\*([一-龥A-Za-z·]{2,12})\*\*(?=（)/g)].map((m) => m[1]);
const speakers = [...new Set(spk)].slice(0, 2);
if (speakers.length < 2) throw new Error('没能从 frontmatter 认出两位说话人：' + JSON.stringify(spk));

const { sections, chars, turns } = parseTranscript(md, speakers);
if (!sections.length) throw new Error('没解析出章节');

/* ---- 媒体：目录里有什么就是什么 ---- */
const pick = async (sub, re) => (await readdir(join(dir, sub)).catch(() => [])).find((f) => re.test(f));
const mp4 = await pick('video', /\.mp4$/i);
const m4a = mp4 ? null : await pick('audio', /\.(m4a|mp3)$/i);
if (!mp4 && !m4a) throw new Error(`${dir} 下既没有 video/*.mp4，也没有 audio/*.m4a`);
const isVideo = Boolean(mp4);
const msrc = (isVideo ? 'video/' : 'audio/') + encodeURIComponent(mp4 ?? m4a);
const mbytes = (await stat(join(dir, isVideo ? 'video' : 'audio', mp4 ?? m4a))).size;
/* 音频页的封面：有就用，没有就不画那块 */
const cover = isVideo ? null : await pick('raw', /^cover\.(png|jpg|jpeg|webp)$/i);
const lastT = Math.max(...sections.flatMap((s) => s.turns.map((t) => t.t)));

/* ---- 正文 ---- */
const blk = (b) => {
  if (b.k === 'img') return `<figure class="fig"><img src="${b.v.src}" alt="${esc(b.v.alt)}" loading="lazy">`
    + `<figcaption>${esc(b.v.alt)}${b.v.cite ? `<span class="cite">${esc(b.v.cite)}</span>` : ''}</figcaption></figure>`;
  if (b.k === 'h3') return `<h3>${inline(b.v)}</h3>`;
  if (b.k === 'ul') return `<ul>${b.v.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
  if (b.k === 'ol') return `<ol>${b.v.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
  return `<p>${inline(b.v)}</p>`;
};

let doc = '', toc = '', outline = '', part = null;
sections.forEach((sec, i) => {
  if (sec.part && sec.part !== part) {
    part = sec.part;
    doc += `<div class="part">${esc(part)}</div>`;
    toc += `<div class="toc-part">${esc(part)}</div>`;
    outline += `<div class="ol-part">${esc(part)}</div>`;
  }
  doc += `<h2 id="s${i}">${esc(sec.title)}</h2>`;
  toc += `<button class="toc-i" data-s="${i}"><span class="t">${hms(sec.t)}</span><span>${esc(sec.title)}</span></button>`;
  outline += `<button class="ol-item" data-s="${i}"><span class="t">${hms(sec.t)}</span><span>${esc(sec.title)}</span></button>`;
  for (const tn of sec.turns) {
    const anchored = tn.spk || tn.cont;
    doc += `<div class="turn${tn.cont ? ' cont' : ''}" data-t="${tn.t}">`
      + `<button class="ts" data-seek="${tn.t}" title="跳到 ${hms(tn.t)}">${anchored ? hms(tn.t) : ''}</button>`
      + `<div class="body">${tn.spk ? `<div class="who${tn.spk === speakers[0] ? ' host' : ''}">${esc(tn.spk)}</div>` : ''}`
      + tn.b.map(blk).join('') + `</div></div>`;
  }
});

const wan = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : String(n));

/* ---- 页尾资料区 ---- */
const chips = (ls) => ls.map((l) =>
  `<a href="${l.u}" target="_blank" rel="noreferrer" class="chip">${esc(l.t)} ↗</a>`).join('');
const group = (label, ls) => (ls.length ? `<div class="g"><span class="t">${label}</span>${chips(ls)}</div>` : '');
const refs = (paperLinks.length || showLinks.length)
  ? `<footer class="refs"><h2>资料</h2>${group('这一期的「课件」', paperLinks)}${group('原节目', showLinks)}</footer>`
  : '';

const CSS = `
:root{
  --accent:#0F766E; --accent-soft:#E6F4F1; --accent-line:#B8DED8; --accent-ink:#0B5750;
  --bg:#FBFAF8; --elev:#fff; --sunken:#F3F1ED; --hover:#F1EFEA;
  --text:#14161A; --t2:#4E5560; --t3:#868D98; --line:#E4E1DA; --line-soft:#EFEDE7;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro SC","PingFang SC","Hiragino Sans GB",system-ui,sans-serif;
  --mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
  --bar:52px; --stage:clamp(400px,38vw,620px); --player-h:64px;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 var(--sans);-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
h1,h2,h3{margin:0;font-weight:650;letter-spacing:-.01em}
code{font:12.5px var(--mono);background:var(--sunken);padding:1px 4px;border-radius:4px}
::selection{background:var(--accent-soft);color:var(--accent-ink)}

.bar{position:sticky;top:0;z-index:60;height:var(--bar);display:flex;align-items:center;gap:14px;
  padding:0 18px;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--line)}
.bar h1{font-size:15px;white-space:nowrap;flex:none}
.bar .sub{font-size:12px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  flex:1 1 auto;min-width:0}
/* 控件一律不许被挤，要让位的是标题那行说明文字 */
.bar>.chip{flex:none}
.chip{padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--t2);
  background:var(--elev);white-space:nowrap}
.chip:hover{border-color:var(--accent-line);color:var(--text)}
.chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}

/* ---- 页尾资料区：论文原文、讲义、原节目 ---- */
.refs{margin:56px 0 0;padding-top:18px;border-top:1px solid var(--line)}
.refs h2{font-size:12px;font-weight:650;letter-spacing:.06em;color:var(--accent);margin:0 0 14px}
.refs .g{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px}
.refs .g .t{font-size:12px;color:var(--t3);margin-right:2px;flex:none}

.wrap{display:grid;grid-template-columns:minmax(0,1fr) var(--stage);gap:34px;
  max-width:1680px;margin:0 auto;padding:24px 24px 120px}
body.wide .wrap{grid-template-columns:minmax(0,1fr);gap:0}

/* ---- 视频台 ---- */
.stage{position:sticky;top:calc(var(--bar) + 18px);align-self:start;height:fit-content}
/* 单列时视频要排到文稿前面才吸得住顶 —— 它们是 grid 子项，用 order 换位 */
body.wide .stage{order:-1;position:sticky;top:var(--bar);margin:-24px -24px 22px;padding:14px 24px 12px;
  background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(12px);
  border-bottom:1px solid var(--line);z-index:50}
.stage video{width:100%;aspect-ratio:16/9;height:auto;display:block;border-radius:12px;
  background:#000;box-shadow:0 4px 18px rgba(20,22,26,.12)}
/* 宽屏 / 窄屏都用高度反推宽度，避免 max-height 让 16:9 的画面左右留黑边 */
body.wide .stage video{max-height:56vh;width:auto;max-width:100%;margin:0 auto}
body.wide .stage .inner{max-width:1100px;margin:0 auto}
/* 播放控制交给 <video controls> 原生那一条，这里只留「现在讲到哪」和跟随开关 */
.nowbar{display:flex;align-items:center;gap:12px;margin-top:10px}
.now{flex:1;min-width:0;font-size:12.5px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.now b{color:var(--text);font-weight:600}

/* ---- 音频页：左目录 + 右正文，两边留白，播放器钉在页面底部 ----
   结构与线上那一期（content/ep117-paper-journey）对齐，样式直接沿用 public/app.css。 */
body.audio{padding-bottom:calc(var(--player-h) + env(safe-area-inset-bottom,0px))}
body.audio .wrap{grid-template-columns:240px minmax(0,1fr);gap:34px;max-width:1180px;padding:26px 24px 70px}
body.audio .outline{position:sticky;top:calc(var(--bar) + 18px);align-self:start;
  max-height:calc(100vh - var(--bar) - var(--player-h) - 46px);overflow-y:auto;
  padding-right:8px;scrollbar-width:thin}
.outline h4{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);margin:0 0 10px}
.ol-part{margin:16px 0 6px;font-size:12px;font-weight:650;color:var(--accent)}
.ol-item{display:flex;gap:8px;width:100%;text-align:left;padding:5px 8px;border-radius:6px;
  font-size:13px;color:var(--t2);line-height:1.45;border-left:2px solid transparent}
.ol-item:hover{background:var(--hover);color:var(--text)}
.ol-item.cur{color:var(--accent);background:var(--accent-soft);border-left-color:var(--accent);font-weight:600}
.ol-item .t{font:11px var(--mono);color:var(--t3);padding-top:2px;flex:none}

.player{position:fixed;left:0;right:0;bottom:0;z-index:70;height:var(--player-h);
  background:color-mix(in srgb,var(--elev) 94%,transparent);backdrop-filter:saturate(1.6) blur(14px);
  border-top:1px solid var(--line);box-shadow:0 -2px 24px rgba(20,22,26,.10);
  padding-bottom:env(safe-area-inset-bottom,0px)}
.player .inner{height:var(--player-h);max-width:1180px;margin:0 auto;padding:0 24px;
  display:flex;align-items:center;gap:14px}
.p-cover{width:42px;height:42px;border-radius:6px;flex:none;object-fit:cover;background:var(--sunken)}
.p-ctrl{display:flex;align-items:center;gap:4px;flex:none}
.p-nudge{width:34px;height:34px;border-radius:6px;color:var(--t2);display:grid;place-items:center}
.p-nudge:hover{background:var(--hover);color:var(--text)}
.pp{width:38px;height:38px;flex:none;border-radius:50%;background:var(--accent);color:#fff;
  display:grid;place-items:center}
.pp:hover{background:var(--accent-ink)}
.p-mid{flex:1;min-width:0}
.p-title{font-size:12.5px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px}
.p-title b{color:var(--text);font-weight:600}
.p-bar{height:4px;border-radius:2px;background:var(--sunken);position:relative;cursor:pointer}
.p-bar i{position:absolute;inset:0 auto 0 0;background:var(--accent);border-radius:2px}
.p-bar::after{content:"";position:absolute;inset:-8px 0}
.p-time{font:11.5px var(--mono);color:var(--t3);white-space:nowrap;font-variant-numeric:tabular-nums}
.p-rate{padding:5px 8px;font-size:12px;color:var(--t2);border-radius:6px}
.p-rate:hover{background:var(--hover);color:var(--text)}
@media (max-width:860px){
  body.audio .wrap{grid-template-columns:minmax(0,1fr);gap:0;padding:16px 16px 70px}
  body.audio .outline{display:none}
  .player .inner{padding:0 14px;gap:10px}
  .p-time{display:none}
  .p-cover{width:36px;height:36px}
}

/* ---- 文稿 ---- */
.doc{max-width:none}
.doc h2{font-size:19px;margin:44px 0 16px;padding-top:15px;border-top:1px solid var(--line-soft);
  scroll-margin-top:calc(var(--bar) + 16px)}
body.wide .doc h2{scroll-margin-top:calc(var(--bar) + 58vh)}
body.audio .doc h2{scroll-margin-top:calc(var(--bar) + 96px)}
.doc h2:first-child{margin-top:0;border-top:0;padding-top:0}
.doc h3{font-size:15px;margin:20px 0 9px;color:var(--accent-ink)}
/* ---- 插图 ---- */
.fig{margin:16px 0 18px;padding:0}
.fig img{width:100%;display:block;border:1px solid var(--line);border-radius:8px;background:#fff;cursor:zoom-in}
.fig figcaption{margin-top:7px;font-size:12px;color:var(--t3);line-height:1.55}
.fig .cite{display:block;margin-top:2px;font-size:11.5px;opacity:.85}
.lightbox{position:fixed;inset:0;z-index:90;display:none;place-items:center;padding:24px;
  background:rgba(20,22,26,.86);cursor:zoom-out}
.lightbox.on{display:grid}
.lightbox img{max-width:100%;max-height:100%;border-radius:8px;background:#fff}
.doc ul,.doc ol{margin:9px 0 13px;padding-left:1.4em}
.doc li{margin:0 0 7px}
.part{display:flex;align-items:center;gap:12px;margin:58px 0 4px;font-size:12px;font-weight:650;
  letter-spacing:.06em;color:var(--accent);scroll-margin-top:calc(var(--bar) + 16px)}
.part::after{content:"";flex:1;height:1px;background:var(--accent-line)}
.turn{display:grid;grid-template-columns:76px minmax(0,1fr);gap:14px;margin:0 0 20px}
/* 同一个人续说、只换了时间码的段落：贴近上一段，别读成换人了 */
.turn.cont{margin-top:-8px}
.ts{font:11.5px var(--mono);color:var(--t3);text-align:right;padding-top:5px;align-self:start;
  font-variant-numeric:tabular-nums}
.ts:hover{color:var(--accent)}
.who{font-weight:650;font-size:13px;margin-bottom:4px}
.who.host{color:var(--accent)}
.body{font-size:16px;line-height:1.85}
.body>p{margin:0 0 11px}
.body>*:last-child{margin-bottom:0}
.turn.cur .body{background:var(--accent-soft);box-shadow:-10px 0 0 var(--accent-soft),10px 0 0 var(--accent-soft);border-radius:2px}
.turn.cur .ts{color:var(--accent);font-weight:600}

/* ---- 目录 ---- */
.toc{position:fixed;inset:0;z-index:80;display:none;background:color-mix(in srgb,var(--bg) 97%,transparent);
  backdrop-filter:blur(6px);overflow-y:auto;padding:18px 22px 60px}
.toc.on{display:block}
.toc .h{display:flex;justify-content:space-between;align-items:center;max-width:900px;margin:0 auto 14px}
.toc .h b{font-size:15px}
.toc .list{max-width:900px;margin:0 auto;display:grid;gap:2px}
.toc-part{margin:16px 0 6px;font-size:12px;font-weight:650;color:var(--accent)}
.toc-i{display:flex;gap:10px;text-align:left;padding:8px 10px;border-radius:6px;font-size:14px;color:var(--t2);
  border-left:2px solid transparent}
.toc-i:hover{background:var(--hover);color:var(--text)}
.toc-i.cur{color:var(--accent);background:var(--accent-soft);border-left-color:var(--accent);font-weight:600}
.toc-i .t{font:11.5px var(--mono);color:var(--t3);padding-top:3px;flex:none}

@media (max-width:1080px){
  .wrap{grid-template-columns:minmax(0,1fr);gap:0;padding:16px 16px 100px}
  .stage{order:-1;position:sticky;top:var(--bar);margin:-16px -16px 18px;padding:12px 16px 10px;
    background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(12px);
    border-bottom:1px solid var(--line);z-index:50}
  .stage video{max-height:42vh;width:auto;max-width:100%;margin:0 auto}
  .doc h2{scroll-margin-top:calc(var(--bar) + 46vh)}
  .bar .sub{display:none}
  .turn{grid-template-columns:minmax(0,1fr);gap:3px}
  .ts{text-align:left;padding-top:0}
}`;

const JS = `
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const hms=s=>{s=Math.max(0,Math.floor(s));return pad(s/3600|0)+':'+pad(s%3600/60|0)+':'+pad(s%60)};
const V=$('#v'), KEY='reader:${basename(dir)}';
const turns=$$('.turn').map(el=>({el,t:+el.dataset.t}));
const heads=$$('#doc h2');
const off=0;
let idx=-1;

/* 时间码 → 视频 */
function seek(t,play){ if(!V) return; V.currentTime=Math.max(0,t+off); if(play!==false) V.play().catch(()=>{}); }
$$('[data-seek]').forEach(b=>b.onclick=()=>seek(+b.dataset.seek));

/* 视频 → 高亮 + 跟随 */
function sync(){
  if(!V) return;
  const t=V.currentTime-off;
  let lo=0,hi=turns.length-1,k=0;
  while(lo<=hi){const m=lo+hi>>1; if(turns[m].t<=t){k=m;lo=m+1}else hi=m-1}
  if(k===idx) return;
  turns[idx]?.el.classList.remove('cur');
  idx=k; const el=turns[k].el; el.classList.add('cur');
  const h=heads.filter(x=>x.compareDocumentPosition(el)&4).pop();
  // 视频页这行是独立的一句，要「当前 ·」；音频页它跟在播放器的标题后面，只留分隔点
  if(h){ $('#now').innerHTML=${isVideo ? "'当前 · '" : "'· '"}+'<b>'+h.textContent+'</b>';
         $$('.toc-i,.ol-item').forEach(b=>b.classList.toggle('cur','s'+b.dataset.s===h.id));
         // 侧边大纲跟着滚，别让当前节跑出可视区
         const cur=$('.ol-item.cur');
         if(cur){const box=cur.parentElement,r=cur.getBoundingClientRect(),br=box.getBoundingClientRect();
           if(r.top<br.top||r.bottom>br.bottom) cur.scrollIntoView({block:'nearest'});}
  }
  if(!V.paused){
    // 顶上被什么挡住，跟随时就得躲开多少：宽屏是半屏视频，音频页是底部播放器
    const r=el.getBoundingClientRect(),
      audio=document.body.classList.contains('audio'),
      top=document.body.classList.contains('wide') ? innerHeight*.62 : 120,
      bottom=audio ? 110 : 80;
    if(r.top<top||r.bottom>innerHeight-bottom) el.scrollIntoView({block:'center',behavior:'smooth'});
  }
}
V?.addEventListener('timeupdate',sync);
V?.addEventListener('loadedmetadata',sync);

/* 底部播放器 —— 只有音频页有。图标与交互沿用线上那一期（public/app.js） */
const PP=$('#pp');
if(PP){
  const ICON={
    play:'<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8c0-.6.7-1 1.2-.7l7 5.2c.4.3.4.9 0 1.2l-7 5.2c-.5.4-1.2 0-1.2-.6V2.8z"/></svg>',
    pause:'<svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="2.5" width="3" height="11" rx="1"/><rect x="9" y="2.5" width="3" height="11" rx="1"/></svg>',
    back15:'<svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.4 8.6A7.2 7.2 0 1 1 3.8 14" stroke-linecap="round"/><path d="M3.2 4.2v4.6h4.6" stroke-linecap="round" stroke-linejoin="round"/><text x="11" y="14.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="-apple-system,system-ui,sans-serif">15</text></svg>',
    fwd30:'<svg width="21" height="21" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.6 8.6A7.2 7.2 0 1 0 18.2 14" stroke-linecap="round"/><path d="M18.8 4.2v4.6h-4.6" stroke-linecap="round" stroke-linejoin="round"/><text x="11" y="14.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="-apple-system,system-ui,sans-serif">30</text></svg>'};
  PP.innerHTML=ICON.play; $('#back15').innerHTML=ICON.back15; $('#fwd30').innerHTML=ICON.fwd30;
  PP.onclick=()=>V.paused?V.play():V.pause();
  $('#back15').onclick=()=>seek(V.currentTime-15,false);
  $('#fwd30').onclick=()=>seek(V.currentTime+30,false);
  $('#p-bar').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();
    seek((e.clientX-r.left)/r.width*(V.duration||${lastT}),false)};
  $('#rate').onclick=e=>{const rs=[1,1.25,1.5,1.75,2];
    const n=rs[(rs.indexOf(V.playbackRate)+1)%rs.length];V.playbackRate=n;e.currentTarget.textContent=n+'×'};
  const paint=()=>{
    PP.innerHTML=V.paused?ICON.play:ICON.pause;
    const d=V.duration||${lastT};
    $('#p-fill').style.width=(V.currentTime/d*100||0)+'%';
    $('#p-time').textContent=hms(V.currentTime)+' / '+hms(d);
  };
  ['timeupdate','play','pause','loadedmetadata'].forEach(ev=>V.addEventListener(ev,paint));
  paint();
}

/* 宽屏 —— 只有视频页有这个按钮 */
const WIDE=$('#wide');
if(WIDE){
  WIDE.onclick=e=>{const w=!document.body.classList.contains('wide');document.body.classList.toggle('wide',w);
    e.currentTarget.setAttribute('aria-pressed',w);try{localStorage.setItem(KEY+':wide',w?'1':'')}catch{}};
  try{ if(localStorage.getItem(KEY+':wide')) WIDE.click(); }catch{}
}

/* 插图点开看大图 */
const LB=document.createElement('div');LB.className='lightbox';LB.innerHTML='<img alt="">';
document.body.appendChild(LB);
$$('.fig img').forEach(im=>im.onclick=()=>{LB.querySelector('img').src=im.src;LB.classList.add('on')});
LB.onclick=()=>LB.classList.remove('on');

/* 目录 */
$('#toc-btn').onclick=()=>$('#toc').classList.add('on');
$('#toc-x').onclick=()=>$('#toc').classList.remove('on');
$$('.toc-i,.ol-item').forEach(b=>b.onclick=()=>{$('#toc').classList.remove('on');$('#s'+b.dataset.s).scrollIntoView({block:'start'})});


/* 键盘 */
addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea')||!V) return;
  if(e.key===' '){e.preventDefault();V.paused?V.play():V.pause()}
  if(e.key==='ArrowLeft'){e.preventDefault();V.currentTime-=15}
  if(e.key==='ArrowRight'){e.preventDefault();V.currentTime+=30}
  if(e.key==='Escape'){$('#toc').classList.remove('on');LB.classList.remove('on')}
});

sync();
`;

const html = `<!DOCTYPE html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · 文稿 + ${isVideo ? '视频' : '音频'}</title>
<style>${CSS}</style>
</head>
<body${isVideo ? '' : ' class="audio"'}>

<header class="bar">
  <h1>${esc(title)}</h1>
  <span class="sub">${esc(metaLine)} · ${wan(chars)}字 · ${turns} 段 · ${sections.length} 节</span>
  ${isVideo ? '<button class="chip" id="wide">宽屏</button>' : ''}
  <button class="chip" id="toc-btn">目录</button>
</header>

<div class="wrap">
  ${isVideo ? '' : `<aside class="outline"><h4>大纲</h4>${outline}</aside>`}
  <div>
    <article class="doc" id="doc">${doc}</article>
    ${refs}
  </div>
${isVideo ? `
  <aside class="stage">
    <div class="inner">
      <video id="v" src="${msrc}" controls preload="metadata" playsinline></video>
      <div class="nowbar">
        <span class="now" id="now">点文稿里任意时间码，视频跳到那一秒</span>
      </div>
    </div>
  </aside>` : ''}
</div>
${isVideo ? '' : `
<div class="player">
  <div class="inner">
    ${cover ? `<img class="p-cover" src="raw/${encodeURIComponent(cover)}" alt="">` : ''}
    <div class="p-ctrl">
      <button class="p-nudge" id="back15" aria-label="后退 15 秒"></button>
      <button class="pp" id="pp" aria-label="播放 / 暂停"></button>
      <button class="p-nudge" id="fwd30" aria-label="前进 30 秒"></button>
    </div>
    <div class="p-mid">
      <div class="p-title"><b>${esc(title)}</b> <span class="now" id="now"></span></div>
      <div class="p-bar" id="p-bar"><i id="p-fill" style="width:0"></i></div>
    </div>
    <span class="p-time" id="p-time"></span>
    <button class="p-rate" id="rate">1×</button>
  </div>
  <audio id="v" src="${msrc}" preload="metadata"></audio>
</div>`}

<div class="toc" id="toc">
  <div class="h"><b>目录 · ${sections.length} 节</b><button class="chip" id="toc-x">关闭 esc</button></div>
  <div class="list">${toc}</div>
</div>

<script>${JS}</script>
</body>
</html>
`;

const out = join(dir, '阅读.html');
await writeFile(out, html, 'utf8');
console.log(`[reader] ${out}`);
console.log(`[reader] ${sections.length} 节 / ${turns} 段 / ${chars} 字 / ${isVideo ? '视频' : '音频'} ${(mbytes / 1048576).toFixed(0)} MB`);
console.log(`[reader] 说话人：${speakers.join(' × ')} · 最后一个时间码 ${hms(lastT)}`);
