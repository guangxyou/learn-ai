#!/usr/bin/env node
/**
 * 生成「文稿 + 视频」本地阅读页 —— 单个自包含 HTML，双击就能开，不用起服务。
 *
 *   node tools/make-reader.mjs 02_Attention
 *
 * 约定：素材目录下有 02-精校稿.md 和 video/*.mp4。
 * 视频用相对路径引用，所以生成的 阅读.html 要和 video/ 放在同一层。
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
const links = [...head.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)]
  .filter(([, t]) => !/音频原址|视频版|校订/.test(t))
  .map(([, t, u]) => ({ t: t.replace(/（.*?）/g, '').trim(), u }));

/* ---- 说话人：frontmatter 的「对谈：A × B」 ---- */
const spk = [...head.matchAll(/\*\*([一-龥A-Za-z·]{2,12})\*\*(?=（)/g)].map((m) => m[1]);
const speakers = [...new Set(spk)].slice(0, 2);
if (speakers.length < 2) throw new Error('没能从 frontmatter 认出两位说话人：' + JSON.stringify(spk));

const { sections, chars, turns } = parseTranscript(md, speakers);
if (!sections.length) throw new Error('没解析出章节');

/* ---- 视频 ---- */
const vdir = join(dir, 'video');
const mp4 = (await readdir(vdir).catch(() => [])).find((f) => f.endsWith('.mp4'));
if (!mp4) throw new Error(`${vdir} 下没有 .mp4`);
const vsrc = 'video/' + encodeURIComponent(mp4);
const vbytes = (await stat(join(vdir, mp4))).size;
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

let doc = '', toc = '', part = null;
sections.forEach((sec, i) => {
  if (sec.part && sec.part !== part) {
    part = sec.part;
    doc += `<div class="part">${esc(part)}</div>`;
    toc += `<div class="toc-part">${esc(part)}</div>`;
  }
  doc += `<h2 id="s${i}">${esc(sec.title)}</h2>`;
  toc += `<button class="toc-i" data-s="${i}"><span class="t">${hms(sec.t)}</span><span>${esc(sec.title)}</span></button>`;
  for (const tn of sec.turns) {
    const anchored = tn.spk || tn.cont;
    doc += `<div class="turn${tn.cont ? ' cont' : ''}" data-t="${tn.t}">`
      + `<button class="ts" data-seek="${tn.t}" title="跳到 ${hms(tn.t)}">${anchored ? hms(tn.t) : ''}</button>`
      + `<div class="body">${tn.spk ? `<div class="who${tn.spk === speakers[0] ? ' host' : ''}">${esc(tn.spk)}</div>` : ''}`
      + tn.b.map(blk).join('') + `</div></div>`;
  }
});

const wan = (n) => (n >= 10000 ? (n / 10000).toFixed(1) + ' 万' : String(n));

const CSS = `
:root{
  --accent:#0F766E; --accent-soft:#E6F4F1; --accent-line:#B8DED8; --accent-ink:#0B5750;
  --bg:#FBFAF8; --elev:#fff; --sunken:#F3F1ED; --hover:#F1EFEA;
  --text:#14161A; --t2:#4E5560; --t3:#868D98; --line:#E4E1DA; --line-soft:#EFEDE7;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro SC","PingFang SC","Hiragino Sans GB",system-ui,sans-serif;
  --serif:"Songti SC","STSong","Noto Serif CJK SC",Georgia,serif;
  --mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
  --bar:52px; --stage:clamp(400px,38vw,620px);
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
.bar .seg,.bar>.chip{flex:none}
.bar .seg button{white-space:nowrap}
/* 三篇论文原文 = 这期的「课件」，跟着视频放 */
.papers{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 26px;padding-bottom:16px;
  border-bottom:1px solid var(--line-soft)}
.papers .t{font-size:12px;color:var(--t3);margin-right:2px}
.chip{padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:12px;color:var(--t2);
  background:var(--elev);white-space:nowrap}
.chip:hover{border-color:var(--accent-line);color:var(--text)}
.chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.seg{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;background:var(--elev)}
.seg button{padding:3px 9px;font-size:12px;color:var(--t2)}
.seg button[aria-pressed=true]{background:var(--accent);color:#fff}

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
.miss{padding:20px;border:1px dashed var(--line);border-radius:12px;color:var(--t2);font-size:13px;line-height:1.7}

/* ---- 文稿 ---- */
.doc{max-width:none}
.doc h2{font-size:19px;margin:44px 0 16px;padding-top:15px;border-top:1px solid var(--line-soft);
  scroll-margin-top:calc(var(--bar) + 16px)}
body.wide .doc h2{scroll-margin-top:calc(var(--bar) + 58vh)}
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
.body>p{margin:0 0 11px}
.body>*:last-child{margin-bottom:0}
.turn.cur .body{background:var(--accent-soft);box-shadow:-10px 0 0 var(--accent-soft),10px 0 0 var(--accent-soft);border-radius:2px}
.turn.cur .ts{color:var(--accent);font-weight:600}
.doc[data-font=serif] .body{font-family:var(--serif)}
.doc[data-ts=off] .ts{visibility:hidden}
.doc[data-size=s] .body{font-size:14px}
.doc[data-size=m] .body{font-size:16px;line-height:1.85}
.doc[data-size=l] .body{font-size:18px;line-height:1.9}

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
const V=$('#v'), DOC=$('#doc'), KEY='reader:${basename(dir)}';
const turns=$$('.turn').map(el=>({el,t:+el.dataset.t}));
const heads=$$('#doc h2');
let follow=true, idx=-1, off=0;

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
  if(h){ $('#now').innerHTML='当前 · <b>'+h.textContent+'</b>';
         $$('.toc-i').forEach(b=>b.classList.toggle('cur','s'+b.dataset.s===h.id)); }
  if(follow&&!V.paused){
    const r=el.getBoundingClientRect(), top=document.body.classList.contains('wide')?innerHeight*.62:120;
    if(r.top<top||r.bottom>innerHeight-80) el.scrollIntoView({block:'center',behavior:'smooth'});
  }
}
V?.addEventListener('timeupdate',sync);
V?.addEventListener('loadedmetadata',sync);

/* 控件 */
$('#follow').onclick=e=>{follow=!follow;e.currentTarget.setAttribute('aria-pressed',follow);e.currentTarget.textContent=follow?'跟随中':'不跟随'};
$('#wide').onclick=e=>{const w=!document.body.classList.contains('wide');document.body.classList.toggle('wide',w);
  e.currentTarget.setAttribute('aria-pressed',w);try{localStorage.setItem(KEY+':wide',w?'1':'')}catch{}};

/* 阅读设置 */
$$('[data-set]').forEach(b=>b.onclick=()=>{const[k,v]=b.dataset.set.split(':');DOC.dataset[k]=v;
  $$('[data-set^="'+k+':"]').forEach(x=>x.setAttribute('aria-pressed',x===b));try{localStorage.setItem(KEY+':'+k,v)}catch{}});
try{
  ['font','size','ts'].forEach(k=>{const v=localStorage.getItem(KEY+':'+k);if(v)$('[data-set="'+k+':'+v+'"]')?.click()});
  if(localStorage.getItem(KEY+':wide'))$('#wide').click();
}catch{}

/* 插图点开看大图 */
const LB=document.createElement('div');LB.className='lightbox';LB.innerHTML='<img alt="">';
document.body.appendChild(LB);
$$('.fig img').forEach(im=>im.onclick=()=>{LB.querySelector('img').src=im.src;LB.classList.add('on')});
LB.onclick=()=>LB.classList.remove('on');

/* 目录 */
$('#toc-btn').onclick=()=>$('#toc').classList.add('on');
$('#toc-x').onclick=()=>$('#toc').classList.remove('on');
$$('.toc-i').forEach(b=>b.onclick=()=>{$('#toc').classList.remove('on');$('#s'+b.dataset.s).scrollIntoView({block:'start'})});


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
<title>${esc(title)} · 文稿 + 视频</title>
<style>${CSS}</style>
</head>
<body>

<header class="bar">
  <h1>${esc(title)}</h1>
  <span class="sub">${esc(metaLine)} · ${wan(chars)}字 · ${turns} 段 · ${sections.length} 节</span>
  <span class="seg"><button data-set="size:s">小</button><button data-set="size:m" aria-pressed="true">中</button><button data-set="size:l">大</button></span>
  <span class="seg"><button data-set="font:sans" aria-pressed="true">黑</button><button data-set="font:serif">宋</button></span>
  <span class="seg"><button data-set="ts:on" aria-pressed="true">时间码</button><button data-set="ts:off">隐藏</button></span>
  <button class="chip" id="wide">宽屏</button>
  <button class="chip" id="toc-btn">目录</button>
</header>

<div class="wrap">
  <div>
    ${links.length ? `<div class="papers"><span class="t">这一期的「课件」</span>${links.map((l) =>
      `<a href="${l.u}" target="_blank" rel="noreferrer" class="chip">${esc(l.t)} ↗</a>`).join('')}</div>` : ''}
    <article class="doc" id="doc" data-font="sans" data-size="m" data-ts="on">${doc}</article>
  </div>

  <aside class="stage">
    <div class="inner">
      <video id="v" src="${vsrc}" controls preload="metadata" playsinline></video>
      <div class="nowbar">
        <span class="now" id="now">点文稿里任意时间码，视频跳到那一秒</span>
            </div>
    </div>
  </aside>
</div>

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
console.log(`[reader] ${sections.length} 节 / ${turns} 段 / ${chars} 字 / 视频 ${(vbytes / 1048576).toFixed(0)} MB`);
console.log(`[reader] 说话人：${speakers.join(' × ')} · 最后一个时间码 ${hms(lastT)}`);
