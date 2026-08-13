/**
 * 批注审阅页：候选 → 一页可点的取舍界面
 *
 *   一审（原始候选池）  node tools/make-triage.mjs --pool 01_Transformer/notes-pool.json --out 01_Transformer/审阅.html
 *   二审（清洗后）      node tools/make-triage.mjs --pool 01_Transformer/notes.json --out 01_Transformer/审阅-二轮.html --round 2
 *
 * 一审看的是原始问答，决定留不留；二审看的是清洗、精简、定好位之后的成品，
 * 决定这条值不值得留在页面上 —— 所以二审直接渲染答案 HTML，按落位分组。
 * 选择存在浏览器 localStorage（两轮各存各的），导出即是下一步的输入。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { KINDS } from './note-kinds.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const a = process.argv.slice(2), o = {};
for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];

const R2 = o.round === '2';
const KEY = R2 ? 'triage-attention-v2' : 'triage-attention-v1';
const OUTNAME = R2 ? 'notes-final.json' : 'notes-picked.json';

const raw = JSON.parse(readFileSync(o.pool || '01_Transformer/notes-pool.json', 'utf8'));

/** 二审按「落在页面哪儿」分组 —— 这决定读者会在什么位置看到它 */
const SEC_TAIL = { '§2–§3.1': '3.1', '§3.2.1': '3.2.1', '§3.2.2': '3.2.2', '§3.3': '3.3',
  '§3.4–§3.5': '3.5', '§4': '4', '§5–§6.2': '6.2', '§6.3–§7': '7' };
const placeOf = (p) => p.anchor ? '行内高亮'
  : String(p.sec).startsWith('岔路') ? '岔路区'
  : SEC_TAIL[p.sec] ? `§${SEC_TAIL[p.sec]} 节末`
  : '预备区';

const pool = raw.map((p) => R2
  ? { ...p, place: placeOf(p), aLen: (p.a || '').replace(/<[^>]+>/g, '').length }
  : { ...p, a: (p.a || '').slice(0, 700), hint: undefined });

const GROUP = R2 ? 'place' : 'sec';
const secs = [...new Set(pool.map((p) => p[GROUP]))];
const kinds = Object.keys(KINDS);

const html = `<!doctype html>
<html lang="zh-Hans"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>批注审阅 · 逐句啃 Attention</title>
<style>
:root{--accent:#0F766E;--accent-soft:#E6F4F1;--accent-line:#B8DED8;--accent-ink:#0B5750;
--bg:#FBFAF8;--bg-elev:#FFF;--bg-sunken:#F3F1ED;--bg-hover:#F1EFEA;
--text:#14161A;--text-2:#4E5560;--text-3:#868D98;--line:#E4E1DA;--line-soft:#EFEDE7;
--drop:#B4231F;--drop-soft:#FDECEB;
--r-sm:6px;--r-md:10px;--r-full:999px;
--sans:-apple-system,BlinkMacSystemFont,"SF Pro SC","PingFang SC",system-ui,sans-serif;
--mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 var(--sans);-webkit-font-smoothing:antialiased;padding-bottom:80px}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;text-align:left}
h1{margin:0;font-size:21px;letter-spacing:-.01em}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
header{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
header .wrap{padding-top:14px;padding-bottom:12px}
.top{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.top p{margin:0;font-size:13px;color:var(--text-3)}
.stat{display:flex;gap:16px;margin:12px 0 0;font-size:13px;color:var(--text-2);flex-wrap:wrap;align-items:center}
.stat b{font-weight:650;color:var(--text);font-variant-numeric:tabular-nums}
.stat .keep b{color:var(--accent)}.stat .drop b{color:var(--drop)}
.pbar{flex:1;min-width:160px;height:6px;border-radius:var(--r-full);background:var(--bg-sunken);overflow:hidden;display:flex}
.pbar i{display:block;height:100%}.pbar .k{background:var(--accent)}.pbar .d{background:var(--drop);opacity:.5}
.tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}
.chip{padding:4px 11px;border:1px solid var(--line);border-radius:var(--r-full);font-size:12.5px;color:var(--text-2);background:var(--bg-elev);white-space:nowrap}
.chip:hover{background:var(--bg-hover);color:var(--text)}
.chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.chip .n{opacity:.65;margin-left:5px;font-variant-numeric:tabular-nums}
.chip.k{border-color:transparent}
.act{margin-left:auto;display:flex;gap:8px}
.btn{padding:6px 13px;border:1px solid var(--line);border-radius:var(--r-sm);font-size:13px;background:var(--bg-elev)}
.btn:hover{background:var(--bg-hover)}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
.btn-primary:hover{background:var(--accent-ink)}
main{padding-top:18px}
.sec{margin-bottom:26px}
.sec-h{display:flex;align-items:center;gap:10px;padding:8px 0;position:sticky;top:calc(100% - 0px);font-size:13px;color:var(--text-3);border-bottom:1px solid var(--line-soft);margin-bottom:6px}
.sec-h b{font-size:14px;color:var(--text);font-weight:650}
.sec-h .bulk{margin-left:auto;display:flex;gap:6px}
.sec-h .bulk button{font-size:11.5px;color:var(--text-3);border:1px solid var(--line);border-radius:var(--r-full);padding:2px 9px}
.sec-h .bulk button:hover{color:var(--text);background:var(--bg-hover)}
.row{display:grid;grid-template-columns:58px 92px minmax(0,1fr) auto;gap:12px;align-items:start;
  padding:11px 12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--bg-elev);margin-bottom:7px}
.row.keep{border-color:var(--accent-line);background:linear-gradient(90deg,var(--accent-soft),var(--bg-elev) 55%)}
.row.drop{border-color:#F0D6D4;background:linear-gradient(90deg,var(--drop-soft),var(--bg-elev) 55%);opacity:.62}
.row.hide{display:none}
.rid{font:11px/1.9 var(--mono);color:var(--text-3)}
.rid em{display:block;font-style:normal;font-size:10px;opacity:.7}
.kind{border:1px solid var(--line);border-radius:var(--r-sm);padding:3px 6px;font-size:12px;background:var(--bg);width:100%}
.q{font-size:14.5px;font-weight:600;line-height:1.5;border:0;background:transparent;width:100%;resize:none;overflow:hidden;font-family:inherit;padding:2px 0}
.q:focus{outline:0;background:var(--bg-sunken);border-radius:4px}
.meta{display:flex;gap:8px;align-items:center;margin-top:3px;flex-wrap:wrap}
.tagline{font-size:11.5px;color:var(--text-3)}
.tagline.was{color:#8C4A16;background:#FEF6E7;border-radius:3px;padding:0 5px}
.sel{font:11.5px/1.6 var(--mono);color:var(--text-2);background:var(--bg-sunken);border-radius:4px;padding:2px 6px;margin-top:4px;display:inline-block}
.more{font-size:11.5px;color:var(--accent)}
.ans{display:none;margin-top:8px;padding:9px 11px;background:var(--bg-sunken);border-radius:var(--r-sm);font-size:12.5px;line-height:1.75;color:var(--text-2);white-space:pre-wrap;max-height:280px;overflow:auto}
.row.open .ans{display:block}
.ans.rich{white-space:normal;font-size:13px}
.ans.rich p{margin:0 0 7px}.ans.rich b{color:var(--text)}
.ans.rich ul{margin:0 0 7px;padding-left:1.1em}.ans.rich li{margin-bottom:3px}
.ans.rich .m{font-family:var(--mono);font-size:.92em;background:var(--bg);padding:1px 4px;border-radius:3px}
.ans.rich .eg{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-sm);
  padding:7px 9px;margin:0 0 7px;font:11.5px/1.7 var(--mono);white-space:pre-wrap}
.ans.rich details{margin-top:6px;border-top:1px dashed var(--line);padding-top:6px}
.ans.rich summary{cursor:pointer;color:var(--accent);font-size:12px}
.pick{display:flex;gap:5px}
.pick button{width:34px;height:30px;border:1px solid var(--line);border-radius:var(--r-sm);text-align:center;font-size:14px;color:var(--text-3);background:var(--bg)}
.pick button:hover{background:var(--bg-hover);color:var(--text)}
.row.keep .pick .y{background:var(--accent);border-color:var(--accent);color:#fff}
.row.drop .pick .n{background:var(--drop);border-color:var(--drop);color:#fff}
.empty{padding:40px 0;text-align:center;color:var(--text-3);font-size:14px}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--text);color:#fff;
  padding:9px 16px;border-radius:var(--r-full);font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s}
.toast.on{opacity:1}
@media(max-width:760px){.row{grid-template-columns:1fr;gap:7px}.rid{display:flex;gap:8px}.rid em{display:inline}}
</style></head><body>

<header><div class="wrap">
  <div class="top">
    <h1>批注审阅</h1>
    <p>逐句啃 Attention is All You Need · ${R2 ? '二审（清洗后）' : '一审（原始候选）'} ${pool.length} 条</p>
  </div>
  <div class="stat">
    <span class="keep">保留 <b id="n-keep">0</b></span>
    <span class="drop">丢弃 <b id="n-drop">0</b></span>
    <span>待定 <b id="n-todo">0</b></span>
    <span class="pbar"><i class="k" id="bar-k"></i><i class="d" id="bar-d"></i></span>
    <span id="pct" style="font-variant-numeric:tabular-nums"></span>
  </div>
  <div class="tools">
    <button class="chip" data-f="all" aria-pressed="true">全部<span class="n">${pool.length}</span></button>
    <button class="chip" data-f="todo" aria-pressed="false">只看待定<span class="n" id="n-todo2"></span></button>
    ${kinds.filter((k) => pool.some((p) => p.kind === k)).map((k) => `<button class="chip k" data-f="kind:${k}" aria-pressed="false"
      style="background:${KINDS[k].c};color:${KINDS[k].ink}">${k}<span class="n">${pool.filter((p) => p.kind === k).length}</span></button>`).join('')}
    <span class="act">
      <button class="btn" id="import">导入已存的</button>
      ${pool.some((p) => p.kind === '噪音') ? '<button class="btn" id="drop-noise">一键丢弃噪音</button>' : ''}
      <button class="btn" id="reset">清空选择</button>
      <button class="btn btn-primary" id="export">导出 ${OUTNAME}</button>
    </span>
  </div>
</div></header>

<main class="wrap" id="list"></main>
<div class="toast" id="toast"></div>

<script>
const KINDS=${JSON.stringify(KINDS)};
const POOL=${JSON.stringify(pool)};
const SECS=${JSON.stringify(secs)};
const R2=${R2};
const GROUP=${JSON.stringify(GROUP)};
const KEY=${JSON.stringify(KEY)};
const OUTNAME=${JSON.stringify(OUTNAME)};
let state=JSON.parse(localStorage.getItem(KEY)||'{}');

function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function st(id){return state[id]||{}}
function kindOf(p){return st(p.id).kind||p.kind}
function keepOf(p){const s=st(p.id);return s.keep===undefined?p.keep:s.keep}
function qOf(p){return st(p.id).q||p.q}

function render(){
  const list=document.getElementById('list');
  list.innerHTML=SECS.map(sec=>{
    const items=POOL.filter(p=>p[GROUP]===sec);
    if(!items.length)return '';
    return '<section class="sec" data-sec="'+sec+'"><div class="sec-h"><b>'+sec+'</b><span>'+items.length+' 条</span>'
      +'<span class="bulk"><button data-bulk="keep" data-sec="'+sec+'">本节全留</button>'
      +'<button data-bulk="drop" data-sec="'+sec+'">本节全丢</button></span></div>'
      + items.map(row).join('')+'</section>';
  }).join('');
  paint();
}

function row(p){
  const k=kindOf(p), keep=keepOf(p);
  return '<div class="row '+(keep===true?'keep':keep===false?'drop':'')+'" data-id="'+p.id+'" data-kind="'+k+'">'
   +'<div class="rid">'+p.id+(p.src?'<em>'+p.src+'</em>':'')+'</div>'
   +'<div><select class="kind" data-k="'+p.id+'" style="background:'+KINDS[k].c+';color:'+KINDS[k].ink+'">'
     +Object.keys(KINDS).map(x=>'<option'+(x===k?' selected':'')+'>'+x+'</option>').join('')+'</select></div>'
   +'<div><textarea class="q" rows="1" data-q="'+p.id+'">'+qOf(p)+'</textarea>'
     +(p.anchor?'<div class="sel">挂在原句：'+p.anchor+'</div>':'')
     +(p.sel?'<div class="sel">选中原文：'+p.sel+'</div>':'')
     +'<div class="meta">'
       +(p.sec&&R2?'<span class="tagline">'+p.sec+'</span>':'')
       +(p.inPage?'<span class="tagline" style="color:var(--accent)">已在阅读页</span>':'')
       +(p.qRaw?'<span class="tagline was">原话：'+p.qRaw+'</span>':'')
       +(p.a?'<button class="more" data-more="'+p.id+'">答案 '+p.aLen+' 字 ▾</button>':'')
     +'</div>'
     +(p.a?'<div class="ans'+(R2?' rich':'')+'">'+(R2?p.a:p.a)+'</div>':'')
   +'</div>'
   +'<div class="pick"><button class="y" data-pick="1" title="保留">✓</button>'
     +'<button class="n" data-pick="0" title="丢弃">✕</button></div>'
   +'</div>';
}

function paint(){
  let k=0,d=0;
  POOL.forEach(p=>{const v=keepOf(p); if(v===true)k++; else if(v===false)d++;});
  const t=POOL.length, todo=t-k-d;
  document.getElementById('n-keep').textContent=k;
  document.getElementById('n-drop').textContent=d;
  document.getElementById('n-todo').textContent=todo;
  document.getElementById('n-todo2').textContent=todo;
  document.getElementById('bar-k').style.width=(k/t*100)+'%';
  document.getElementById('bar-d').style.width=(d/t*100)+'%';
  document.getElementById('pct').textContent=Math.round((k+d)/t*100)+'% 已定';
  filter();
  document.querySelectorAll('.q').forEach(a=>{a.style.height='auto';a.style.height=a.scrollHeight+'px'});
}

let F='all';
function filter(){
  document.querySelectorAll('.row').forEach(r=>{
    const p=POOL.find(x=>x.id===r.dataset.id);
    let show=true;
    if(F==='todo')show=keepOf(p)===null||keepOf(p)===undefined;
    else if(F.startsWith('kind:'))show=kindOf(p)===F.slice(5);
    r.classList.toggle('hide',!show);
  });
  document.querySelectorAll('.sec').forEach(s=>{
    s.style.display=s.querySelector('.row:not(.hide)')?'':'none';
  });
}

function set(id,patch){state[id]=Object.assign({},state[id],patch);save()}

document.addEventListener('click',e=>{
  const pick=e.target.closest('[data-pick]');
  if(pick){
    const r=pick.closest('.row'),id=r.dataset.id,want=pick.dataset.pick==='1';
    const cur=keepOf(POOL.find(x=>x.id===id));
    set(id,{keep:cur===want?null:want});
    const p=POOL.find(x=>x.id===id),v=keepOf(p);
    r.classList.toggle('keep',v===true);r.classList.toggle('drop',v===false);
    paint();return;
  }
  const more=e.target.closest('[data-more]');
  if(more){more.closest('.row').classList.toggle('open');
    more.textContent=more.textContent.replace(/[▾▴]/,more.closest('.row').classList.contains('open')?'▴':'▾');return}
  const chip=e.target.closest('.chip');
  if(chip){document.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c===chip));
    F=chip.dataset.f;filter();return}
  const bulk=e.target.closest('[data-bulk]');
  if(bulk){
    POOL.filter(p=>p[GROUP]===bulk.dataset.sec).forEach(p=>set(p.id,{keep:bulk.dataset.bulk==='keep'}));
    render();return;
  }
});

document.addEventListener('change',e=>{
  if(e.target.matches('.kind')){
    const id=e.target.dataset.k,k=e.target.value;
    set(id,{kind:k});
    e.target.style.background=KINDS[k].c;e.target.style.color=KINDS[k].ink;
    e.target.closest('.row').dataset.kind=k;filter();
  }
});
document.addEventListener('input',e=>{
  if(e.target.matches('.q')){set(e.target.dataset.q,{q:e.target.value});
    e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px'}
});

const dn=document.getElementById('drop-noise');
if(dn)dn.onclick=()=>{
  POOL.forEach(p=>{if(kindOf(p)==='噪音'&&keepOf(p)===null)set(p.id,{keep:false})});
  render();toast('噪音已全部标为丢弃');
};
// 换台机器 / 清过缓存时，把之前导出的 json 拖回来接着审
document.getElementById('import').onclick=()=>{
  const f=document.createElement('input');f.type='file';f.accept='.json';
  f.onchange=()=>{const r=new FileReader();
    r.onload=()=>{try{
      const arr=JSON.parse(r.result);let n=0;
      arr.forEach(x=>{if(!x.id)return;n++;set(x.id,{keep:x.picked===false?null:true,kind:x.kind,q:x.q})});
      // 导出文件里没有的，就是当时被丢弃的
      const ids=new Set(arr.map(x=>x.id));
      POOL.forEach(p=>{if(!ids.has(p.id))set(p.id,{keep:false})});
      render();toast('导入 '+n+' 条');
    }catch(e){toast('这个文件读不了：'+e.message)}};
    r.readAsText(f.files[0])};
  f.click();
};
document.getElementById('reset').onclick=()=>{
  if(!confirm('清空所有选择？'))return;
  state={};save();render();
};
document.getElementById('export').onclick=()=>{
  const out=POOL.filter(p=>keepOf(p)!==false).map(p=>R2
    ? {id:p.id,anchor:p.anchor||'',kind:kindOf(p),sec:p.sec,q:qOf(p),a:p.a}
    : {picked:keepOf(p)===true,id:p.id,src:p.src,n:p.n,sec:p.sec,kind:kindOf(p),q:qOf(p),
       anchor:p.anchor||'',sel:p.sel||'',a:p.a});
  const blob=new Blob([JSON.stringify(out,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=OUTNAME;a.click();
  const yes=out.filter(x=>x.picked).length;
  toast(R2?('导出 '+out.length+' 条'):('导出 '+out.length+' 条（明确保留 '+yes+'，未标记 '+(out.length-yes)+'）'));
};
function toast(s){const t=document.getElementById('toast');t.textContent=s;t.classList.add('on');
  setTimeout(()=>t.classList.remove('on'),1800)}

render();
</script>
</body></html>`;

writeFileSync(o.out || '01_Transformer/审阅.html', html);
console.log(`✓ ${o.out || '01_Transformer/审阅.html'}（${pool.length} 条，${(html.length / 1024).toFixed(0)} KB）`);
