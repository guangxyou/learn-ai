/**
 * 内容解析：Markdown 素材 → 结构化数据。
 * 规则与 design/extract.py 一致（原型先在 Python 里跑通，这里是直译）。
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

/** 行内 markdown → HTML */
export function inline(s) {
  return esc(s)
    .replace(/\\([*_`[\]()#.!-])/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*]+)\*(?![*\w])/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/* ══════════════ 精校稿 → 大纲 + 分块正文 ══════════════ */

const LI = /^(?:-|\*)\s+(.*)$/;
const OLI = /^\d+\.\s+(.*)$/;

export function parseTranscript(md, speakers) {
  // 说话人来自条目声明，不写死 —— 每期的对谈双方都不一样
  const TURN = new RegExp(
    `^\\*\\*(${speakers.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\*\\*〔(\\d{2}:\\d{2}:\\d{2})〕(.*)$`);
  const sections = [];
  let cur = null, part = null, started = false, pendingPart = false;

  for (const raw of md.split('\n')) {
    const s = raw.trimEnd();
    // 正文从第一个 `## ` 开始：在那之前的一级标题是文档标题，还有 frontmatter
    if (!started) {
      if (s.startsWith('## ')) started = true;
      else continue;
    }
    if (/^# /.test(s)) { part = s.slice(2).trim(); pendingPart = true; continue; }  // 一级标题 = 分卷
    if (s.startsWith('## ')) {
      cur = { title: s.slice(3).trim().replace(/\\/g, ''), part, turns: [] };
      sections.push(cur);
      pendingPart = false;
      continue;
    }
    if (!s || s === '---' || s.startsWith('>')) continue;
    // 分卷底下直接就是正文、没有 `## ` 小节时，把分卷本身当成一节，
    // 否则这些段落会被并到上一节里，标题也就丢了
    if (pendingPart) {
      cur = { title: part, part: null, turns: [] };
      sections.push(cur);
      pendingPart = false;
      part = null;
    }
    if (!cur) continue;

    const m = TURN.exec(s);
    if (m && speakers.includes(m[1])) {
      cur.turns.push({ spk: m[1], t: t2s(m[2]), b: [{ k: 'p', v: m[3].trim() }] });
      continue;
    }
    if (!cur.turns.length) cur.turns.push({ spk: '', t: 0, b: [] });
    const b = cur.turns[cur.turns.length - 1].b;

    if (s.startsWith('### ')) b.push({ k: 'h3', v: s.slice(4).trim() });
    else if (LI.test(s)) {
      if (!b.length || b[b.length - 1].k !== 'ul') b.push({ k: 'ul', v: [] });
      b[b.length - 1].v.push(LI.exec(s)[1].trim());
    } else if (OLI.test(s)) {
      if (!b.length || b[b.length - 1].k !== 'ol') b.push({ k: 'ol', v: [] });
      b[b.length - 1].v.push(OLI.exec(s)[1].trim());
    } else b.push({ k: 'p', v: s.trim() });
  }

  for (const sec of sections) sec.t = sec.turns.find((x) => x.t)?.t ?? 0;

  const chars = sections.reduce((n, sec) => n + sec.turns.reduce((m, t) =>
    m + t.b.reduce((k, b) => k + (Array.isArray(b.v) ? b.v : [b.v])
      .reduce((z, x) => z + plain(x).length, 0), 0), 0), 0);
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
