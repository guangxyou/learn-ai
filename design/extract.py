#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把真实素材抽成原型用的 data.js —— 与正式构建脚本同一套解析规则。

  02-精校稿.md    → 大纲 + 分块正文（p / h3 / ul / ol）
  03-资料索引.md  → 论文 36 篇 / 研究者 36 位 / 视频·演讲·访谈·书·延伸·报告·数据集
"""
import re, html, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '00_论文探索之旅')     # 原始素材，只在本地
OUT = os.path.join(ROOT, 'design', 'data.js')


def t2s(ts):
    p = [int(x) for x in ts.split(':')]
    return p[0] * 3600 + p[1] * 60 + p[2] if len(p) == 3 else p[0] * 60 + p[1]


def md2html(s):
    """行内 markdown → HTML。链接、粗体、斜体、行内码。"""
    s = html.escape(s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)',
               r'<a href="\2" target="_blank" rel="noreferrer">\1</a>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'(?<![\w*])\*([^*]+)\*(?![\w*])', r'<i>\1</i>', s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    return s


def plain(s):
    s = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', s)
    s = re.sub(r'\\([*_`\[\]()#.!\-])', r'\1', s)     # 先解转义，再去标记
    return re.sub(r'\*\*|\*|`', '', s)


# ══════════════ 1. 精校稿 → 大纲 + 分块正文 ══════════════
md = open(f'{SRC}/02-精校稿.md', encoding='utf-8').read()

TURN = re.compile(r'^\*\*(张小珺|谢青池)\*\*〔(\d{2}:\d{2}:\d{2})〕(.*)$')
LI = re.compile(r'^(?:-|\*)\s+(.*)$')
OLI = re.compile(r'^\d+\.\s+(.*)$')

sections, cur, part, started = [], None, None, False
for raw in md.split('\n'):
    s = raw.rstrip()
    if not started:
        if s.startswith('## ') or s.startswith('# Part'):
            started = True
        else:
            continue
    if s.startswith('# Part'):
        part = s[2:].strip()
        continue
    if s.startswith('## '):
        cur = {'title': s[3:].strip().replace('\\', ''), 'part': part, 'turns': []}
        sections.append(cur)
        continue
    if not s or s == '---' or s.startswith('>') or cur is None:
        continue

    m = TURN.match(s)
    if m:
        cur['turns'].append({'spk': m.group(1), 't': t2s(m.group(2)),
                             'b': [{'k': 'p', 'v': m.group(3).strip()}]})
        continue
    if not cur['turns']:                       # 章节开头没有说话人的独立段落
        cur['turns'].append({'spk': '', 't': 0, 'b': []})
    blocks = cur['turns'][-1]['b']

    if s.startswith('### '):
        blocks.append({'k': 'h3', 'v': s[4:].strip()})
    elif LI.match(s):
        if not blocks or blocks[-1]['k'] != 'ul':
            blocks.append({'k': 'ul', 'v': []})
        blocks[-1]['v'].append(LI.match(s).group(1).strip())
    elif OLI.match(s):
        if not blocks or blocks[-1]['k'] != 'ol':
            blocks.append({'k': 'ol', 'v': []})
        blocks[-1]['v'].append(OLI.match(s).group(1).strip())
    else:
        blocks.append({'k': 'p', 'v': s.strip()})

# 章节起始时间：第一个有时间码的发言
for sec in sections:
    sec['t'] = next((t['t'] for t in sec['turns'] if t['t']), 0)


def blk_chars(b):
    return sum(len(plain(x)) for x in (b['v'] if isinstance(b['v'], list) else [b['v']]))


chars = sum(blk_chars(b) for s_ in sections for t in s_['turns'] for b in t['b'])
turns = sum(len(s_['turns']) for s_ in sections)
print(f'章节 {len(sections)} · 发言 {turns} · 正文 {chars} 字')


# Shownotes 不再进页面（详情页只有 文稿 / 编年史 / 资料 三个 tab）。
# 原始片段仍在 01-播客网页存档.html 里：从 '今天的嘉宾是谢青池' 往前找最近的 <p>、
# 到 </article> 为止，剥掉 <figure> 与哈希 class 就是干净的 3 KB。


# ══════════════ 2. 编年史四条轨道（PPT 第 8/26/32/41 页） ══════════════
CH = [
 {'id': 'paradigm', 'name': '模型的范式变迁', 'slide': 8, 'nodes': [
   ('2004.08', 'Brook', '用 GPU 进行计算', 1), ('2012.10', 'AlexNet', '深度学习的开端', 2),
   ('2014.09', 'Attention & seq2seq', '对序列建模', 3), ('2015.03', '蒸馏', '模型能被学习吗？', 4),
   ('2015.12', 'ResNet', '比深更深', 5), ('2017.06', 'Transformer', '拉开一个时代的序幕', 6),
   ('2017.01', 'MoE', '现代 MoE 的开端', 8), ('2017.10', 'AlphaGo Zero', '强化学习的突破', 7),
   ('2021.06', 'LoRA', '那个我们每天都在用的东西', 10), ('2022.01', 'CoT', 'Prompt Engineering 的奠基之作', 9),
   ('2022.10', 'ReAct', 'Agent 从理论到落地', 11)]},
 {'id': 'infra', 'name': 'Infra 与数据的变迁', 'slide': 26, 'nodes': [
   ('2019.10', 'ZeRO', '大规模 GPU 并行', 13), ('2020.01', 'Scaling Law', '上帝的指挥棒', 14),
   ('2022.03', 'Chinchilla', '上帝的指挥棒（下）', 15), ('2022.10', 'LAION-5B', '开源社区的英雄主义', 16),
   ('2023.06', 'The RefinedWeb', '互联网数据也很够用', 17), ('2024.02', 'MegaScale', '万卡 GPU 集群训练', 18),
   ('2019.03', 'The Bitter Lesson', '过去 70 年的教训', 12)]},
 {'id': 'lm', 'name': '语言模型的发展', 'slide': 32, 'nodes': [
   ('2013.01', 'Word2Vec', '用机器学习将单词向量化', 19), ('2016.09', 'Google Translate', '神经网络大规模线上部署', 20),
   ('2018.06', 'GPT-1', '它来了', 21), ('2018.10', 'BERT', '曾经的王', 22),
   ('2019.02', 'GPT-2', '是时候告别微调了', 23), ('2020.05', 'GPT-3', 'ChatGPT 来临前夜', 24),
   ('2022.03', 'InstructGPT', '给 LLM 以文明', 25), ('2024.11', 'Tulu 3', '后训练的开源', 26)]},
 {'id': 'mm', 'name': '多模态模型的发展', 'slide': 41, 'nodes': [
   ('2014.06', 'DeepVideo', '深度学习进入视频领域', 27), ('2014.06', '双流网络', 'Karén 和牛津登场', 28),
   ('2014.06', 'GAN', '图像生成的序章', 29), ('2015.03', 'Diffusion', '在 GAN 的阴影下悄然成长', 30),
   ('2020.06', 'DDPM', '重回图像舞台的中央', 31), ('2020.10', 'ViT', '当图像遇到 Transformer', 32),
   ('2021.03', 'CLIP', '文生图的奠基石', 33), ('2021.12', 'Stable Diffusion', '在潜空间里生成', 34),
   ('2022.12', 'DiT', '人们期待一个融合的未来', 35)]},
]


# ══════════════ 3. 资料索引 ══════════════
idx = open(f'{SRC}/03-资料索引.md', encoding='utf-8').read()


def section_of(title, level='## '):
    """取某个标题下、到下一个同级或更高级标题为止的内容。"""
    m = re.search(r'^' + re.escape(level + title) + r'\s*$', idx, re.M)
    if not m:
        print('  ! 找不到标题', level + title)
        return ''
    start = m.end()
    nxt = re.search(r'^#{1,' + str(len(level.strip())) + r'} ', idx[start:], re.M)
    return idx[start: start + nxt.start()] if nxt else idx[start:]


def rows(block):
    """markdown 表格 → 数据行（跳过表头与分隔行）。"""
    out, seen_sep = [], False
    for ln in block.split('\n'):
        ln = ln.strip()
        if not ln.startswith('|'):
            continue
        cells = [c.strip() for c in ln.strip('|').split('|')]
        if all(re.fullmatch(r':?-{2,}:?', c) for c in cells):
            seen_sep = True
            continue
        if seen_sep:
            out.append(cells)
    return out


# ---- 3.1 论文 36 篇 ----
papers, part = [], ''
for blk in re.split(r'\n(?=#{1,3} )', idx):
    pm = re.match(r'## (Part \d[^\n]*)', blk)
    if pm:
        part = pm.group(1).strip()
        continue
    m = re.match(r'### (\d+)(?:-([ab]))?\\?\.\s*(.+)', blk)
    if not m:
        continue
    n, sub, name = int(m.group(1)), m.group(2) or '', m.group(3).strip()

    def field(k, b=blk):
        mm = re.search(r'\*\*' + k + r'\*\*：(.+)', b)
        return mm.group(1).strip() if mm else ''

    title = re.sub(r'（.*?）$', '', re.sub(r'^\*|\*$', '', field('标题'))).strip(' *')
    pub = field('首次发表')
    dm = re.search(r'\*{0,2}(\d{4})[-\s年]*(\d{2})', pub)
    date = f'{dm.group(1)}.{dm.group(2)}' if dm else \
        {1: '2004.08', 2: '2012.12', 27: '2014.06'}.get(n, '')
    lm = re.search(r'链接\*\*：(?:\s*\n\s*-\s*)?[^\[]*\[([^\]]+)\]\(([^)]+)\)', blk)

    papers.append({
        'n': f'{n}{sub}', 'part': part, 'name': name, 'title': title, 'date': date,
        'link': lm.group(2) if lm else '',
        'authors': plain(field('作者')), 'org': plain(field('机构')),
        'meaning': plain(field('意义')),
    })

# ---- 3.2 研究者（不含主持人 / 嘉宾 / 其他被提及人物）----
people = []
res = section_of('研究者').split('### 其他被提及人物')[0]
for blk in re.split(r'\n(?=### )', res):
    m = re.match(r'### (.+)', blk)
    if not m:
        continue
    head = m.group(1).strip()
    cnt = re.search(r'—\s*出现\s*(\d+)\s*篇', head)
    name = re.sub(r'\s*—\s*出现.*$', '', head).strip()

    def f(k, b=blk):
        mm = re.search(r'\*\*' + k + r'\*\*：(.+)', b)
        return mm.group(1).strip() if mm else ''

    seen, links = set(), []
    for line in blk.split('\n'):
        if '**机构**' in line:                            # 机构描述里的链接不算社交入口
            continue
        for lab, url in re.findall(r'([^\n\[]*?)\[[^\]]+\]\((https?://[^)]+)\)', line):
            if url in seen:
                continue
            seen.add(url)
            lab = re.sub(r'\*\*|\*', '', lab).strip().rstrip('：:').strip()
            lab = re.split(r'[：:]', lab)[-1].strip(' -｜|、，,')
            if not lab or len(lab) > 24 or re.search(r'[；，。]', lab):
                lab = re.sub(r'^www\.', '', url.split('/')[2])
            links.append({'label': lab[:15] + ('…' if len(lab) > 15 else ''), 'url': url})
    people.append({'name': name, 'count': int(cnt.group(1)) if cnt else 1,
                   'org': plain(f('机构')), 'papers': plain(f('相关篇目')),
                   'note': plain(f('备注')), 'links': links[:4]})
people.sort(key=lambda p: -p['count'])

# ---- 3.3 提及的资料 ----
def tab(title, level='## ', cols=3):
    return [[md2html(c) for c in (r + [''] * cols)[:cols]] for r in rows(section_of(title, level))]


videos = [r[:2] for r in tab('视频教程')]                     # 去掉「状态」列
talks = [r for r in tab('演讲', cols=2) if 'Ian Buck' not in r[0]]
books = [r for r in tab('书 / 文章') if '扬·盖尔' not in r[0]]
extra = tab('明确点名', '### ')
reports = tab('技术报告和官方发布', '### ')

# 访谈：补上小宇宙单集链接与标题（eid 与标题从节目 RSS 核到）
XYZ = {
  'EP89':  ('67a1b697247d51713c868367', '逐句讲解 DeepSeek-R1、Kimi K1.5、OpenAI o1 技术报告——“最优美的算法最干净”'),
  'EP102': ('683d2ceb38dcc57c641a7d0f', '和张祥雨聊，多模态研究的挣扎史和未来两年的 2 个“GPT-4 时刻”'),
  'EP108': ('686b8c0560f8f77d404338cd', '余凯口述 30 年史：世界不止刀光剑影，是一部人来人往的江湖故事'),
  'EP115': ('68c29ca12c82c9dccadba127', '对 OpenAI 姚顺雨 3 小时访谈：6 年 Agent 研究、人与系统、吞噬的边界、既单极又多元的世界'),
  'EP133': ('69b77577f8b8079bfa8eb837', '对谢赛宁的 7 小时马拉松访谈：世界模型、逃出硅谷、AMI Labs、两次拒绝 Ilya、杨立昆、李飞飞和 42'),
}
interviews = []
for r in rows(section_of('访谈')):
    r = (r + ['', ''])[:3]
    ep = re.search(r'EP(\d+)', r[0])
    eid, subject = XYZ.get('EP' + ep.group(1), ('', '')) if ep else ('', '')
    interviews.append({'title': md2html(r[0]), 'who': md2html(r[1]), 'subject': subject,
                       'url': f'https://www.xiaoyuzhoufm.com/episode/{eid}' if eid else ''})

# 数据集 / 工具：踢掉 BooksCorpus、WebText
tools = []
for ln in section_of('数据集、工具与项目入口', '### ').split('\n'):
    ln = ln.strip()
    if not re.match(r'^-\s+', ln):
        continue
    body = re.sub(r'^-\s+', '', ln)
    if 'BooksCorpus' in body or 'WebText' in body:
        continue
    tools.append(md2html(body))

print(f'论文 {len(papers)} · 研究者 {len(people)} · 视频 {len(videos)} · 演讲 {len(talks)} · '
      f'访谈 {len(interviews)} · 书 {len(books)} · 延伸 {len(extra)} · 报告 {len(reports)} · '
      f'工具 {len(tools)}')


# ══════════════ 4. 输出 ══════════════
data = {
  'entry': {
    'id': 'ep117-paper-journey', 'kind': 'podcast',
    'title': '开源一段论文探索之旅',
    'subtitle': '模型范式、Infra 和数据、语言、多模态的完整变迁史',
    'topics': ['AI 基础', '论文', '编年史'],
    'date': '2025-10', 'studied': '2026-07',
    'source': '张小珺Jùn｜商业访谈录 EP117',
    'guest': '谢青池', 'host': '张小珺',
    'duration': 15757, 'plays': 49542,
    'cover': 'https://image.xyzcdn.net/Fnuyt9PQDQx0I0wlErG3ZHcW9Gpu.png?imageMogr2/thumbnail/160x160',
    'audio': 'https://media.xyzcdn.net/626b46ea9cbbf0451cf5a962/ludOBUWHSc2Y_GA47pSOwlGC8JPS.m4a',
    'origin': 'https://www.xiaoyuzhoufm.com/episode/68ff9d1b083a71a4eb86c52c',
    'video': 'https://www.bilibili.com/video/BV1pkyqBxEdB/',
    'ppt': 'https://w7py8ou4dk.feishu.cn/wiki/KacewdlmSiSGC9kUOKDch9gwnKf',
    'chars': chars, 'turns': turns, 'papers': len(papers), 'slides': 51,
  },
  'sections': sections,
  'chronicle': CH,
  'papers': papers,
  'people': people,
  'res': {'videos': videos, 'talks': talks, 'interviews': interviews, 'books': books,
          'extra': extra, 'reports': reports, 'tools': tools},
}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('/* 由 extract.py 从真实素材生成，勿手改 */\nwindow.DATA = ')
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('写出', OUT, os.path.getsize(OUT) // 1024, 'KB')
