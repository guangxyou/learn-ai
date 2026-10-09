/** 全站搜索：构建期把每一页的产物扫一遍，切成段落级的小块，记下它在哪个 tab、哪一节。
 *
 *  各页是不同工具生成的（make-paper、05_Basic、14_CS231n、render.mjs），结构不统一，
 *  小节、段落大多没有 id。所以不在生成器里各改一遍，而是在发布这一步统一处理：
 *  每个被收进索引的块，没有 id 的就补一个 sx-N，搜索结果拿它当落点。
 *  跳过去之后切 tab、展开讲次和批注、高亮关键词，由 public/search.js 在页面里做。
 *
 *  纯 Node，无依赖：一个够用的 HTML 词法扫描，不建 DOM。 */

/* 不进索引的整棵子树：脚本样式、图里的标注、MathML（textContent 是拆碎的字母）、
   目录和大纲（跟正文标题重复）、顶栏和 tab 条、播放器旁的时间轴、灯箱和手机抽屉、
   参考文献下面「本文在这些地方引用它」那段（是正文原句的重复） */
const SKIP_TAG = new Set(['script', 'style', 'svg', 'math', 'nav', 'noscript', 'template', 'cite', 'object', 'iframe', 'video', 'audio']);
const SKIP_CLASS = ['toc', 'outline', 'topbar', 'bar', 'legend', 'epside', 'lb', 'sheet', 'ts', 'dot', 'player',
  'res-nav', 'rc', 'ep-head', 'chs', 'links', 'mats', 'tl', 'plsrc', 'turn-t', 'vshots'];
const SKIP_ID = new Set(['lightbox', 'sheet', 'scrim', 'toc-sheet']);

/* 收成一块的元素。外层优先：li 里套着 p，整个 li 算一块 */
const BLOCK = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figcaption', 'summary', 'tr', 'dt', 'dd', 'blockquote', 'pre']);
/* 这些 div 自己就是一个完整单元：批注卡片、ep117 资料里的论文行和人物卡 */
const UNIT = (tag, cls, attrs) => tag === 'div' && (cls.has('nt') || cls.has('person') || (cls.has('paper') && /\bdata-n=/.test(attrs)));

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/* 前后要补空格的元素和 class（编号和标题、讲者和时长挤在一起，既难看也搜不准） */
const SPACED = new Set(['br', 'td', 'th', 'li', 'p', 'div', 'h2', 'h3', 'h4', 'figcaption', 'button', 'summary', 'dt', 'dd', 'em']);
const SPACED_CLASS = ['hn', 'n', 'no', 'num', 'lbl', 'tag', 'chip', 'len', 'qt', 'turn-who', 'd'];

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', middot: '·', times: '×', minus: '−', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
  return ENT[e.toLowerCase()] ?? m;
});
const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(attrs);
  return m ? decode(m[1] ?? m[2] ?? m[3]) : null;
};
const squash = (s) => s.replace(/\s+/g, ' ').trim();

/* 块里单独记一份的字段：批注的题目、类型、正文；讲次的序号和中文名 */
function fieldOf(tag, cls, cur) {
  if (cur.kind === '批注') return cls.has('qt') ? 'qt' : cls.has('tag') ? 'tag' : cls.has('nt-a') ? 'body' : null;
  if (cur.kind === '讲次') return cls.has('no') ? 'no' : tag === 'b' && cur.field === 'tt' ? 'name' : cls.has('tt') ? 'tt' : null;
  return null;
}

/** 扫一页。返回补过 id 的 html 和这一页的块。
 *  块：{ tab, crumb, kind, id, text, title?, sub? } —— tab 是 tab 条上的名字，crumb 是「讲次 › 小节」 */
export function indexPage(html) {
  // tab 名：make-paper / 05_Basic 的 .tb[data-v] 对 #view-*；render.mjs 的 .tab[data-tab] 对 #pane-*
  const tabName = new Map();
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const cls = attr(m[1], 'class') || '';
    const tb = /\btb\b/.test(cls), v = tb ? attr(m[1], 'data-v') : /\btab\b/.test(cls) ? attr(m[1], 'data-tab') : null;
    if (v == null) continue;
    const label = squash(decode(m[2].replace(/<span class="n">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '')));
    tabName.set((tb ? 'view-' : 'pane-') + v, label);
  }
  // 论文正文没有包在 #view-paper 里（它是默认那一屏），不在任何视图里的块就归它
  const homeTab = tabName.get('view-paper') ?? null;

  const ids = new Set([...html.matchAll(/\sid=["']?([^"'\s>]+)/g)].map((m) => m[1]));
  let seq = 0;
  const newId = () => { let id; do id = `sx-${++seq}`; while (ids.has(id)); return id; };

  const RE = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|[^<]+|</g;
  const stack = [];          // 每层：{ tag, cls, skipped, block, outer（外层字段）, saved（外层上下文） }
  const chunks = [];
  const heads = [];          // 当前视图 / 讲次里的标题栈：[{ lv, text }]
  let skip = 0;              // 处在多少层跳过的子树里
  let glued = false;         // 上一个记号是结束标签
  let cur = null;            // 正在收集的块
  let view = null, ep = null; // 当前 tab（#view-* / #pane-* 的 id）、当前讲次标题
  const inserts = [];        // [位置, 文本]：补 id
  const put = (t) => { cur.text += t; if (cur.field) cur.fields[cur.field] = (cur.fields[cur.field] || '') + t; };

  for (const m of html.matchAll(RE)) {
    const [tok, , close, rawTag, attrs = ''] = m;
    if (tok.startsWith('<!--') || m[1]) continue;
    if (!rawTag) {                                   // 文本
      if (!skip && cur) put(decode(tok));
      glued = false;
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (!close) {
      const cls = new Set((attr(attrs, 'class') || '').split(/\s+/).filter(Boolean));
      const id = attr(attrs, 'id');
      // 一个元素刚结束、紧接着另一个开始，中间没有字：<i>TRPO</i><i>GAE</i> 这种标签条，补个空格隔开。
      // 有字隔着的（<b>正则化</b>的）不动，不然中文词会被拆开
      if (cur && !skip && (SPACED.has(tag) || glued)) put(' ');
      glued = false;
      if (VOID.has(tag) || /\/\s*$/.test(attrs)) continue;

      const fr = { tag, cls, skipped: false, block: false, outer: cur?.field ?? null };
      if (skip || SKIP_TAG.has(tag) || SKIP_CLASS.some((c) => cls.has(c)) || (id && SKIP_ID.has(id))) {
        fr.skipped = true; skip++;
      } else {
        // 进视图、进讲次时记下外层的上下文，出来时还原
        const enterView = id && (id.startsWith('view-') || id.startsWith('pane-')) && tabName.has(id);
        const enterEp = tag === 'details' && cls.has('ep');
        if (enterView || enterEp) fr.saved = { view, ep, heads: heads.slice() };
        if (enterView) { view = id; heads.length = 0; ep = null; }
        if (enterEp) { ep = ''; heads.length = 0; }
        if (!cur && (BLOCK.has(tag) || UNIT(tag, cls, attrs)) && !(tag === 'summary' && stack[stack.length - 1]?.cls.has('refs'))) {
          fr.block = true;
          // 落点：自己有 id 用自己的，没有就补一个
          let anchor = id;
          // 插在开始标签的末尾：别的脚本按 <div class="nt" data-n= 这种原样字串数东西，不能插在中间
          if (!anchor) { anchor = newId(); inserts.push([m.index + tok.length - 1, ` id="${anchor}"`]); }
          cur = { tag, id: anchor, text: '', fields: {}, field: null, kind: kindOf(tag, cls, stack), view,
            crumb: [ep, ...heads.map((h) => h.text)].filter(Boolean) };
        }
        if (cur) { const f = fieldOf(tag, cls, cur); if (f) cur.field = f; }
      }
      stack.push(fr);
      continue;
    }

    glued = true;
    // 结束标签：一路弹到对得上的那一层（容错没闭合的元素）
    let k = stack.length - 1;
    while (k >= 0 && stack[k].tag !== tag) k--;
    if (k < 0) continue;
    while (stack.length > k) {
      const fr = stack.pop();
      if (fr.skipped) skip--;
      if (cur && !skip && (SPACED.has(fr.tag) || SPACED_CLASS.some((c) => fr.cls.has(c)))) put(' ');
      if (cur) cur.field = fr.outer;
      if (fr.block && cur) finish(cur);
      if (fr.saved) { ({ view, ep } = fr.saved); heads.splice(0, heads.length, ...fr.saved.heads); }
    }
  }

  function finish(c) {
    cur = null;
    let text = squash(c.text);
    const lv = /^h([1-6])$/.exec(c.tag)?.[1];
    if (lv && text) {
      while (heads.length && heads[heads.length - 1].lv >= +lv) heads.pop();
      c.crumb = [ep, ...heads.map((h) => h.text)].filter(Boolean);   // 标题自己的路径不含同级的上一节
      heads.push({ lv: +lv, text });
    }
    const out = { tab: c.view ? tabName.get(c.view) : homeTab, crumb: c.crumb, kind: c.kind, id: c.id };
    if (c.kind === '讲次') {
      // details.ep 的标题：「3. 正则化与优化」，这一讲里后面的块都挂在它下面
      const name = squash(c.fields.name || c.fields.tt || '') || text;
      ep = out.title = (c.fields.no ? `${squash(c.fields.no)}. ` : '') + name;
      out.crumb = [];
      // 正文里去掉开头那段跟标题重复的「3 正则化与优化」，摘要从英文原名和一句话简介开始
      const no = squash(c.fields.no || '');
      if (no && text.startsWith(no)) text = text.slice(no.length).trim();
      if (text.startsWith(name)) text = text.slice(name.length).trim();
    }
    if (c.kind === '参考文献') out.crumb = [];
    if (c.kind === '批注') {
      out.title = squash(c.fields.qt || '');
      if (c.fields.tag) out.sub = squash(c.fields.tag);
      text = squash(c.fields.body || '') || text;
    }
    // 单个字、纯编号这类没有信息量的块不收
    if (text.length < 2 || /^[\d\s.·:]+$/.test(text)) return;
    out.text = text;
    chunks.push(out);
  }

  // 补 id：按位置切开再拼回去
  inserts.sort((a, b) => a[0] - b[0]);
  const parts = [];
  let at = 0;
  for (const [pos, s] of inserts) { parts.push(html.slice(at, pos), s); at = pos; }
  parts.push(html.slice(at));
  return { html: parts.join(''), chunks };
}

function kindOf(tag, cls, stack) {
  const up = (pred) => stack.some(pred);
  if (cls.has('nt')) return '批注';
  if (tag === 'div' && cls.has('person')) return '人物';
  if (tag === 'div' && cls.has('paper')) return '论文';
  if (up((s) => s.cls.has('refs'))) return '参考文献';
  if (tag === 'summary') {
    const d = stack[stack.length - 1];
    if (d?.cls.has('ep')) return '讲次';
    if (d?.cls.has('pz')) return '思考题';
    return '正文';
  }
  if (up((s) => s.tag === 'details' && s.cls.has('pz'))) return '思考题';
  if (tag === 'figcaption') return up((s) => s.cls.has('shot')) ? '截图' : '图注';
  if (/^h[1-6]$/.test(tag)) return '标题';
  if (tag === 'tr' || up((s) => s.tag === 'table')) return '表格';
  if (cls.has('pp')) return '原文';
  if (up((s) => s.cls.has('turn'))) return '文稿';
  return '正文';
}
