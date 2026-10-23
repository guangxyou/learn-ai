const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const stamp = (t) => `<button class="ts" type="button" data-t="${t}">${time(t)}</button>`;
const detailedInline = (text) => text.replace(/([pqμσ])([θφ])?\(([^()]*)\)/g, (_, base, index, args) =>
  `<span class="m"><i>${base}</i>${index ? `<sub>${index}</sub>` : ''}(${args.replace(/[xz]/g, '<i>$&</i>')})</span>`);

function responsiveMath(html) {
  const body = html.replace(/^<math\b[^>]*>/, '').replace(/<\/math>$/, '').replace(/^<mrow>/, '').replace(/<\/mrow>$/, '');
  const parts = [];
  let depth = 0, start = 0;
  for (const m of body.matchAll(/<\/?[a-z]+\b[^>]*>/g)) {
    const closing = m[0][1] === '/';
    if (!closing && depth === 0) start = m.index;
    depth += closing ? -1 : 1;
    if (closing && depth === 0) parts.push(body.slice(start, m.index + m[0].length));
  }
  const lines = [];
  let current = [];
  const operator = (s) => /^<mo>[=≈≤∈+−,]<\/mo>$/.test(s);
  for (const part of parts) {
    if (operator(part) && current.some((x) => !operator(x))) {
      lines.push(current.join('')); current = [];
    }
    current.push(part);
  }
  if (current.length) lines.push(current.join(''));
  const compact = `<math class="math-mobile" xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mtable columnalign="left" rowspacing="0.55em">${lines.map((line) => `<mtr><mtd><mrow>${line}</mrow></mtd></mtr>`).join('')}</mtable></math>`;
  return html.replace('<math ', '<math class="math-full" ') + compact;
}

export function renderDetailed(blocks) {
  return blocks.map((b) => {
    if (b.type === 'p') return `<p>${detailedInline(b.text)}</p>`;
    if (b.type === 'equation') return `<figure class="detail-equation"><figcaption>${esc(b.label)}</figcaption><div class="detail-math">${responsiveMath(b.html)}</div></figure>`;
    if (b.type === 'note') return `<div class="note"><p><span class="lbl">补充</span>${detailedInline(b.text)}</p></div>`;
    if (b.type === 'list') return `<ul>${b.items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
    if (b.type === 'table') return `<div class="tbl"><table><thead><tr>${b.head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((row) => `<tr>${row.map((x) => `<td>${detailedInline(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    throw new Error(`Unknown detailed note block: ${b.type}`);
  }).join('\n');
}

export function transcriptParagraphs(segments, start, end) {
  const out = [];
  for (const s of segments.filter((s) => s.start >= start && s.start < end)) {
    const prev = out.at(-1);
    if (prev && s.end - prev.start <= 28 && prev.text.length + s.text.length <= 150) {
      prev.text += s.text; prev.end = s.end;
    } else out.push({ ...s });
  }
  return out;
}

export function addResources(html, resources) {
  if (!resources.length) return html;
  for (const r of resources) {
    if (!/^[a-z0-9-]+$/.test(r.id) || !/^BV[\w]+$/.test(r.bvid)) throw new Error('Invalid CS231n resource identifier');
    let last = -1;
    for (const s of r.sections) {
      if (!Number.isInteger(s.t) || s.t <= last || s.t >= r.duration) throw new Error(`Invalid resource timestamp: ${r.id}`);
      last = s.t;
    }
  }
  html = html.replace(/<!--cs231n-resources-(tab|view|style|script)-->[\s\S]*?<!--\/cs231n-resources-\1-->/g, '');
  const block = (kind, body) => `<!--cs231n-resources-${kind}-->${body.replace(/^[\t ]+$/gm, '')}<!--/cs231n-resources-${kind}-->`;
  const tab = block('tab', '<button class="tb" type="button" role="tab" data-v="resources" aria-selected="false">资源</button>');
  const view = block('view', `<div class="view" id="view-resources">
    <div class="intro"><h2>补充视频</h2><p>详细笔记、原版解析和逐字稿可切换，时间码点了跳播，截图点了放大。</p></div>
    ${resources.map((r) => {
      const url = `https://www.bilibili.com/video/${r.bvid}/`;
      const defaultMode = r.defaultMode || 'transcript';
      return `<details class="ep resource-ep" id="r-${r.id}" data-bv="${r.bvid}" data-p="1" data-mode="${esc(defaultMode)}" open>
        <summary><span class="no">${esc(r.mark)}</span><span class="tt"><b>${esc(r.title)}</b><span class="hook">${esc(r.description)}</span></span><span class="side"><span class="chip">${esc(r.author)}</span><span class="len">${time(r.duration)}</span></span></summary>
        <div class="epb"><div class="epmain">
          <p class="links"><a href="${url}" target="_blank" rel="noreferrer">原视频</a><span>${esc(r.date)}</span><a class="lk" data-l="${r.lecture}" href="#l${r.lecture}">对应第 ${r.lecture} 讲</a></p>
          <p class="lede">${esc(r.lede)}</p>
          <div class="resource-tools"><div class="resource-modes" role="group" aria-label="阅读方式">${r.sections.some((s) => s.detailed) ? `<button type="button" data-r-mode="detailed" aria-pressed="${defaultMode === 'detailed'}">详细笔记</button>` : ''}<button type="button" data-r-mode="notes" aria-pressed="${defaultMode === 'notes'}">原版解析</button><button type="button" data-r-mode="transcript" aria-pressed="${defaultMode === 'transcript'}">逐字稿</button></div><div class="resource-downloads"><a href="__ASSETS__/resources/${esc(r.downloads.text)}" download>下载文字稿</a><a href="__ASSETS__/resources/${esc(r.downloads.srt)}" download>SRT 字幕</a><a href="__ASSETS__/resources/${esc(r.downloads.vtt)}" download>VTT 字幕</a><a href="__ASSETS__/resources/vae-timeline.md" download>时间轴</a></div></div>
          <p class="resource-credit r-transcript">${esc(r.editorial)}</p>
          ${r.detailedIntro ? `<p class="resource-credit r-detailed">${esc(r.detailedIntro)}</p>` : ''}
          ${r.sections.map((s, i) => {
            const paragraphs = transcriptParagraphs(r.transcriptData.segments, s.t, r.sections[i + 1]?.t ?? r.duration);
            return `<section class="sec" id="r-${r.id}-s${i}"><h4>${stamp(s.t)}<span>${esc(s.title)}</span></h4>
              <div class="r-transcript">${paragraphs.map((p) => `<p class="transcript-p" id="r-${r.id}-t${Math.round(p.start * 1000)}">${stamp(p.start)}<span>${esc(p.text)}</span></p>`).join('')}</div>
              <div class="r-analysis">${s.paragraphs.map((p) => `<p>${p}</p>`).join('')}${s.formula ? `<div class="resource-equation">${s.formula}</div>` : ''}${s.note ? `<div class="note"><p><span class="lbl">补充</span>${s.note}</p></div>` : ''}</div>
              ${s.detailed ? `<div class="r-detailed" id="r-${r.id}-detail${i}">${renderDetailed(s.detailed)}</div>` : ''}
              ${s.shot ? `<div class="shots"><figure class="shot"><img src="__ASSETS__/resources/${esc(s.shot.file)}" alt="${esc(s.shot.caption)}" loading="lazy" width="${s.shot.width}" height="${s.shot.height}"><figcaption>${stamp(s.shot.t)}${esc(s.shot.caption)}</figcaption></figure></div>` : ''}
            </section>`;
          }).join('')}
          ${r.takeaways ? `<section class="sec keys r-detailed" id="r-${r.id}-takeaways"><h4>这一讲记住这几条</h4><ul>${r.takeaways.map((x) => `<li>${detailedInline(esc(x))}</li>`).join('')}</ul></section>` : ''}
          <p class="resource-credit r-analysis">核对资料：<a href="https://arxiv.org/abs/1312.6114" target="_blank" rel="noreferrer">Auto-Encoding Variational Bayes</a>；<a href="https://arxiv.org/abs/2112.10752" target="_blank" rel="noreferrer">High-Resolution Image Synthesis with Latent Diffusion Models</a>。后半段比较包含讲者的个人推测，补充说明保留了与原论文的区别。</p>
          <p class="resource-credit r-detailed">补充推导核对：<a href="https://arxiv.org/html/1312.6114v11#S2.SS2" target="_blank" rel="noreferrer">Auto-Encoding Variational Bayes · §2</a>；<a href="https://arxiv.org/html/2112.10752v2#S3" target="_blank" rel="noreferrer">High-Resolution Image Synthesis with Latent Diffusion Models · §3、附录 G</a>。笔记按视频顺序编排，额外解释不作为讲者原话。</p>
        </div><aside class="epside"><div class="pl"><button class="plgo" type="button" aria-label="播放 ${esc(r.title)}" style="background-image:url('__ASSETS__/resources/${esc(r.poster)}')"><span class="tri"></span></button></div><p class="plsrc"><span class="plwhich">点封面或时间码播放</span><a class="plbili" href="${url}" target="_blank" rel="noreferrer">B 站打开</a></p><ol class="tl">${r.sections.map((s, i) => `<li><button type="button" data-t="${s.t}"><b>${time(s.t)}</b><span>${esc(s.title)}</span></button><a class="resource-read" href="#r-${r.id}-s${i}" aria-label="阅读：${esc(s.title)}">读稿</a></li>`).join('')}</ol></aside></div>
      </details>`;
    }).join('')}
  </div>`);
  if (!html.includes('data-v="papers"') || !html.includes('</main>')) throw new Error('CS231n page structure changed');
  html = html.replace(/(<button\b[^>]*data-v="papers"[^>]*>[\s\S]*?<\/button>)/, `$1${tab}`);
  html = html.replace('</main>', `${view}</main>`);
  html = html.replace('</head>', `${block('style', `<style>
    .resource-ep{margin-top:22px}.resource-ep .links{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .resource-credit{font-size:12.5px;color:var(--text-3);margin:14px 0 22px;line-height:1.75}.resource-credit a{color:var(--accent-ink);text-decoration:underline}
    .resource-equation{overflow-x:auto;white-space:nowrap;background:var(--bg-sunken);padding:16px;margin:14px 0;border-radius:var(--r-sm);font:18px/1.9 var(--math);text-align:center}
    .resource-equation i{font-style:italic}.resource-ep .shot img{height:auto}
    .resource-tools{display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;margin:20px 0 10px}
    .resource-modes{display:flex;gap:4px;padding:3px;border-radius:var(--r-full);background:var(--bg-sunken)}
    .resource-modes button{font-size:13px;padding:5px 14px;border-radius:var(--r-full)}.resource-modes button[aria-pressed="true"]{background:var(--accent);color:white}
    .resource-downloads{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--accent-ink)}.resource-downloads a{text-decoration:underline;text-underline-offset:3px}
    .resource-ep:not([data-mode="notes"]) .r-analysis,.resource-ep:not([data-mode="transcript"]) .r-transcript,.resource-ep:not([data-mode="detailed"]) .r-detailed{display:none}
    .r-detailed{font-size:15px;line-height:1.85}.r-detailed .tbl{margin:16px 0}.r-detailed .tbl td{min-width:120px}
    .detail-equation{margin:16px 0 20px;padding:13px 16px;background:var(--bg-sunken);border-radius:var(--r-sm);max-width:100%}
    .detail-equation figcaption{font-size:12px;color:var(--text-3);margin-bottom:10px}.detail-math{overflow-x:auto;max-width:100%;padding:5px 0 10px;overscroll-behavior-x:contain}.detail-math math{font-size:1.05em;margin:0 auto;width:max-content;min-width:0}
    .detail-math .math-mobile{display:none}
    .resource-ep .transcript-p{font-size:14.5px;line-height:1.95;margin:0 0 14px}.transcript-p .ts{font-size:11px;opacity:.75;margin-right:8px}
    .resource-ep .tl li{display:flex;align-items:baseline;gap:6px}.resource-ep .tl li>button{flex:1;min-width:0}.resource-read{flex:none;font-size:11px;color:var(--accent-ink);padding:4px 0;margin-right:12px}
    .resource-ep .sec:target,.transcript-p:target{outline:2px solid var(--accent-line);outline-offset:6px;border-radius:4px}
    @media(max-width:640px){.resource-equation{font-size:15px;text-align:left}.resource-ep .transcript-p{font-size:14px}}
    @media(max-width:640px){.detail-math .math-full{display:none}.detail-math .math-mobile{display:block;margin-left:0}.detail-equation{padding:12px}.detail-math math{font-size:1em}}
  </style>`)}</head>`);
  return html.replace('</body>', `${block('script', `<script>
    (function(){
      function mode(ep,which){ep.dataset.mode=which;ep.querySelectorAll('[data-r-mode]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.rMode===which);});}
      document.querySelectorAll('[data-r-mode]').forEach(function(b){b.addEventListener('click',function(){mode(b.closest('.resource-ep'),b.dataset.rMode);});});
      document.querySelectorAll('.resource-read').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();history.replaceState(null,'',a.getAttribute('href'));resourceHash();});});
      function resourceHash(){
        var id=location.hash.slice(1),el=document.getElementById(id);
        if(id!=='resources'&&!(el&&el.closest('#view-resources')))return;
        document.querySelectorAll('.tb').forEach(function(b){var on=b.dataset.v==='resources';b.classList.toggle('on',on);b.setAttribute('aria-selected',on);});
        document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('on',v.id==='view-resources');});
        if(el){var ep=el.closest('.ep');if(ep){ep.open=true;if(el.closest('.r-transcript'))mode(ep,'transcript');if(el.closest('.r-analysis'))mode(ep,'notes');if(el.closest('.r-detailed'))mode(ep,'detailed');}el.scrollIntoView({block:'start'});}
      }
      resourceHash();addEventListener('hashchange',resourceHash);addEventListener('load',resourceHash);
      // Search results can target a paragraph that was hidden in the other reading mode.
      document.addEventListener('sx:focus',function(e){var el=e.target.closest('.r-transcript,.r-analysis,.r-detailed');if(el)mode(el.closest('.resource-ep'),el.classList.contains('r-transcript')?'transcript':el.classList.contains('r-detailed')?'detailed':'notes');});
    })();
  </script>`)}</body>`);
}
