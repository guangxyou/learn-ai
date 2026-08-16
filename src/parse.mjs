/**
 * 内容解析：Markdown 素材 → 结构化数据。
 * 规则先在本地原型的 Python 版里跑通，这里是直译（原型不进仓库）。
 */

export const t2s = (ts) => {
  const p = ts.split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 去掉 markdown 标记，留纯文本（用于字数统计与卡片摘要） */
export function plain(s) {
  return String(s)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\\([*_`[\]()#.!-])/g, '$1')
    .replace(/\*\*|\*|`/g, '');
}

/** 行内 markdown → HTML。
 *  正文中间的〔时间码〕转成可点的跳转按钮 —— 逐字稿里时间码都在段首、由 parseTranscript
 *  先吃掉了，走不到这儿；详录体则大量把时间码嵌在句子和表格里，靠这里变成锚点。 */
export function inline(s) {
  return esc(s)
    .replace(/\\([*_`[\]()#.!-])/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*]+)\*(?![*\w])/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/〔(\d{2}:\d{2}:\d{2})〕/g,
      (_, t) => `<button class="tsi" data-seek="${t2s(t)}" title="跳到 ${t}">${t}</button>`);
}

/* ══════════════ 精校稿 → 大纲 + 分块正文 ══════════════ */

const LI = /^(?:-|\*)\s+(.*)$/;
const OLI = /^\d+\.\s+(.*)$/;

/** 往当前小节最后一个 turn 里塞一个块；还没有 turn 就先开一个无锚点的 */
function pushBlock(cur, block) {
  if (!cur) return;
  if (!cur.turns.length) cur.turns.push({ spk: '', t: 0, b: [] });
  cur.turns[cur.turns.length - 1].b.push(block);
}

export function parseTranscript(md, speakers) {
  // 说话人来自条目声明，不写死 —— 每期的对谈双方都不一样
  const TURN = new RegExp(
    `^\\*\\*(${speakers.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\*\\*〔(\\d{2}:\\d{2}:\\d{2})〕(.*)$`);
  const sections = [];
  let cur = null, part = null, partTime = null, started = false, pendingPart = false, fence = null;

  for (const raw of md.split('\n')) {
    const s = raw.trimEnd();
    // 正文从第一个 `## ` 开始：在那之前的一级标题是文档标题，还有 frontmatter
    if (!started) {
      if (s.startsWith('## ')) started = true;
      else continue;
    }

    // 代码块：整块原样收走，里面的 #、|、> 都不能当 markdown 解
    if (fence !== null) {
      if (/^```/.test(s)) { pushBlock(cur, { k: 'code', v: fence.join('\n') }); fence = null; }
      else fence.push(raw);
      continue;
    }
    if (/^```/.test(s) && cur) { fence = []; continue; }

    // 一级标题 = 分卷。分卷底下没有 `## ` 时它自己会被当成一节，所以时间码也要在这儿摘掉
    if (/^# /.test(s)) {
      const p = s.slice(2).trim();
      const pt = /〔(\d{2}:\d{2}:\d{2})〕\s*$/.exec(p);
      part = pt ? p.slice(0, pt.index).trim() : p;
      partTime = pt ? t2s(pt[1]) : null;
      pendingPart = true;
      continue;
    }
    if (s.startsWith('## ')) {
      // 详录体的小节标题自带时间码：`## 标题〔00:03:49〕`，摘出来当这一节的锚点
      const t = s.slice(3).trim().replace(/\\/g, '');
      const ht = /〔(\d{2}:\d{2}:\d{2})〕\s*$/.exec(t);
      cur = { title: ht ? t.slice(0, ht.index).trim() : t, hTime: ht ? t2s(ht[1]) : null, part, turns: [] };
      sections.push(cur);
      pendingPart = false;
      continue;
    }
    if (!s || s === '---') continue;
    // 分卷底下直接就是正文、没有 `## ` 小节时，把分卷本身当成一节，
    // 否则这些段落会被并到上一节里，标题也就丢了
    if (pendingPart) {
      cur = { title: part, hTime: partTime, part: null, turns: [] };
      sections.push(cur);
      pendingPart = false;
      part = null;
      partTime = null;
    }
    if (!cur) continue;

    const m = TURN.exec(s);
    if (m && speakers.includes(m[1])) {
      cur.turns.push({ spk: m[1], t: t2s(m[2]), b: [{ k: 'p', v: m[3].trim() }] });
      continue;
    }
    // 同一个人继续说、只另起一个时间码的段落：`〔00:36:48〕正文`。
    // 它也是一个跳转锚点，不能当普通段落，否则时间码会以原文形式漏到页面上。
    const c = /^〔(\d{2}:\d{2}:\d{2})〕(.*)$/.exec(s);
    if (c) {
      cur.turns.push({ spk: '', cont: true, t: t2s(c[1]), b: [{ k: 'p', v: c[2].trim() }] });
      continue;
    }
    if (!cur.turns.length) cur.turns.push({ spk: '', t: 0, b: [] });
    const b = cur.turns[cur.turns.length - 1].b;

    // 插图：`![说明](路径 "出处")` 独占一行
    const im = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(s);
    if (im) { b.push({ k: 'img', v: { src: im[2], alt: im[1], cite: im[3] || '' } }); continue; }

    // 表格：连续的 `|…|` 行并成一块，`|---|` 那行只用来认表头
    if (s.startsWith('|')) {
      const cells = s.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
        if (b.length && b[b.length - 1].k === 'table') b[b.length - 1].v.head = true;
        continue;
      }
      if (!b.length || b[b.length - 1].k !== 'table') b.push({ k: 'table', v: { head: false, rows: [] } });
      b[b.length - 1].v.rows.push(cells);
      continue;
    }

    // 引用块：`> 正文`，`> [!NOTE]` 这种提示头单独标出来
    if (s.startsWith('>')) {
      const q = s.replace(/^>\s?/, '');
      const note = /^\[!(\w+)\]/.exec(q);
      if (!b.length || b[b.length - 1].k !== 'quote') b.push({ k: 'quote', v: { note: '', lines: [] } });
      const qv = b[b.length - 1].v;
      if (note) qv.note = note[1];
      else if (q.trim()) qv.lines.push(q.trim());
      continue;
    }

    if (s.startsWith('### ')) b.push({ k: 'h3', v: s.slice(4).trim() });
    else if (LI.test(s)) {
      if (!b.length || b[b.length - 1].k !== 'ul') b.push({ k: 'ul', v: [] });
      b[b.length - 1].v.push(LI.exec(s)[1].trim());
    } else if (OLI.test(s)) {
      if (!b.length || b[b.length - 1].k !== 'ol') b.push({ k: 'ol', v: [] });
      b[b.length - 1].v.push(OLI.exec(s)[1].trim());
    } else b.push({ k: 'p', v: s.trim() });
  }

  // 小节锚点：标题自带的时间码优先，其次是节内第一个带时间码的段落
  for (const sec of sections) sec.t = sec.hTime ?? (sec.turns.find((x) => x.t)?.t ?? 0);

  // 字数只算正文，插图不计入
  const textOf = (b) => {
    if (b.k === 'img') return [];
    if (b.k === 'table') return b.v.rows.flat();
    if (b.k === 'quote') return b.v.lines;
    if (b.k === 'code') return [b.v];
    return Array.isArray(b.v) ? b.v : [b.v];
  };
  const chars = sections.reduce((n, sec) => n + sec.turns.reduce((m, t) =>
    m + t.b.reduce((k, b) => k + textOf(b).reduce((z, x) => z + plain(x).length, 0), 0), 0), 0);
  const turns = sections.reduce((n, s) => n + s.turns.length, 0);

  return { sections, chars, turns };
}

/* ══════════════ 资料索引 ══════════════ */

function sectionOf(idx, title, level = '## ') {
  const re = new RegExp('^' + (level + title).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*$', 'm');
  const m = re.exec(idx);
  if (!m) throw new Error(`资料索引里找不到标题：${level}${title}`);
  const start = m.index + m[0].length;
  const nxt = new RegExp('^#{1,' + level.trim().length + '} ', 'm').exec(idx.slice(start));
  return nxt ? idx.slice(start, start + nxt.index) : idx.slice(start);
}

/** markdown 表格 → 数据行 */
function rows(block) {
  const out = [];
  let sawSep = false;
  for (const raw of block.split('\n')) {
    const ln = raw.trim();
    if (!ln.startsWith('|')) continue;
    const cells = ln.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) { sawSep = true; continue; }
    if (sawSep) out.push(cells);
  }
  return out;
}

const field = (blk, k) => (new RegExp(`\\*\\*${k}\\*\\*：(.+)`).exec(blk)?.[1] ?? '').trim();

export function parseIndex(idx) {
  /* ---- 论文 ---- */
  const papers = [];
  let part = '';
  for (const blk of idx.split(/\n(?=#{1,3} )/)) {
    const pm = /^## (Part \d[^\n]*)/.exec(blk);
    if (pm) { part = pm[1].trim(); continue; }
    const m = /^### (\d+)(?:-([ab]))?\\?\.\s*(.+)/.exec(blk);
    if (!m) continue;
    const n = Number(m[1]);
    const pub = field(blk, '首次发表');
    const dm = /\*{0,2}(\d{4})[-\s年]*(\d{2})/.exec(pub);
    const fallback = { 1: '2004.08', 2: '2012.12', 27: '2014.06' }[n] ?? '';
    const lm = /链接\*\*：(?:\s*\n\s*-\s*)?[^[]*\[([^\]]+)\]\(([^)]+)\)/.exec(blk);
    papers.push({
      n: `${n}${m[2] ?? ''}`,
      part,
      name: m[3].trim(),
      title: field(blk, '标题').replace(/^\*|\*$/g, '').replace(/（.*?）$/, '').trim().replace(/^\*+|\*+$/g, ''),
      date: dm ? `${dm[1]}.${dm[2]}` : fallback,
      link: lm?.[2] ?? '',
      authors: plain(field(blk, '作者')),
      org: plain(field(blk, '机构')),
      meaning: plain(field(blk, '意义')),
    });
  }

  /* ---- 研究者（不含主持人 / 嘉宾 / 其他被提及人物）---- */
  const people = [];
  for (const blk of sectionOf(idx, '研究者').split('### 其他被提及人物')[0].split(/\n(?=### )/)) {
    const m = /^### (.+)/.exec(blk);
    if (!m) continue;
    const head = m[1].trim();
    const cnt = /—\s*出现\s*(\d+)\s*篇/.exec(head);
    const seen = new Set(), links = [];
    for (const line of blk.split('\n')) {
      if (line.includes('**机构**')) continue;
      for (const [, lab0, url] of line.matchAll(/([^\n[]*?)\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)) {
        if (seen.has(url)) continue;
        seen.add(url);
        let lab = lab0.replace(/\*\*|\*/g, '').trim().replace(/[：:]$/, '').trim();
        lab = lab.split(/[：:]/).pop().replace(/^[\s\-｜|、，,]+|[\s\-｜|、，,]+$/g, '');
        if (!lab || lab.length > 24 || /[；，。]/.test(lab) || lab.startsWith('未查到')) {
          lab = url.split('/')[2].replace(/^www\./, '');
        }
        links.push({ label: lab.length > 15 ? lab.slice(0, 15) + '…' : lab, url });
      }
    }
    people.push({
      name: head.replace(/\s*—\s*出现.*$/, '').trim(),
      count: cnt ? Number(cnt[1]) : 1,
      org: plain(field(blk, '机构')),
      papers: plain(field(blk, '相关篇目')),
      links: links.slice(0, 4),
    });
  }
  people.sort((a, b) => b.count - a.count);

  /* ---- 提及的资料 ---- */
  const tab = (title, level = '## ', cols = 3) =>
    rows(sectionOf(idx, title, level)).map((r) => [...r, '', ''].slice(0, cols).map(inline));

  // 节目 RSS 核到的单集 eid 与标题
  const XYZ = {
    EP89: ['67a1b697247d51713c868367', '逐句讲解 DeepSeek-R1、Kimi K1.5、OpenAI o1 技术报告——“最优美的算法最干净”'],
    EP102: ['683d2ceb38dcc57c641a7d0f', '和张祥雨聊，多模态研究的挣扎史和未来两年的 2 个“GPT-4 时刻”'],
    EP108: ['686b8c0560f8f77d404338cd', '余凯口述 30 年史：世界不止刀光剑影，是一部人来人往的江湖故事'],
    EP115: ['68c29ca12c82c9dccadba127', '对 OpenAI 姚顺雨 3 小时访谈：6 年 Agent 研究、人与系统、吞噬的边界、既单极又多元的世界'],
    EP133: ['69b77577f8b8079bfa8eb837', '对谢赛宁的 7 小时马拉松访谈：世界模型、逃出硅谷、AMI Labs、两次拒绝 Ilya、杨立昆、李飞飞和 42'],
  };
  const interviews = rows(sectionOf(idx, '访谈')).map((r0) => {
    const r = [...r0, '', ''];
    const ep = /EP(\d+)/.exec(r[0]);
    const [eid, subject] = XYZ['EP' + ep?.[1]] ?? ['', ''];
    return {
      title: inline(r[0]), who: inline(r[1]), subject,
      url: eid ? `https://www.xiaoyuzhoufm.com/episode/${eid}` : '',
    };
  });

  const tools = sectionOf(idx, '数据集、工具与项目入口', '### ')
    .split('\n').map((l) => l.trim())
    .filter((l) => /^-\s+/.test(l))
    .map((l) => l.replace(/^-\s+/, ''))
    .filter((l) => !l.includes('BooksCorpus') && !l.includes('WebText'))
    .map(inline);

  return {
    papers, people,
    res: {
      videos: tab('视频教程').map((r) => r.slice(0, 2)),      // 去掉「状态」列
      talks: tab('演讲', '## ', 2).filter((r) => !r[0].includes('Ian Buck')),
      interviews,
      books: tab('书 / 文章').filter((r) => !r[0].includes('扬·盖尔')),
      extra: tab('明确点名', '### '),
      reports: tab('技术报告和官方发布', '### '),
      tools,
    },
  };
}
