# learn-ai

> 一篇一篇，跟上 AI 时代
> **https://xslaoxu.cn/learn-ai**

我深度读透过的东西，一条一条留在这里。判断标准只有一条：
**别人打开这一页，能不能不靠我解释就把这件事学一遍。**

所以每条至少要有一份可读的正文、一条可跳播的时间线，和一份能追到原文的索引。

## 目前收录

| 学于 | 条目 | 产出 |
|---|---|---|
| 2026.07 | [开源一段论文探索之旅](https://xslaoxu.cn/learn-ai/ep117-paper-journey/) —— 张小珺Jùn｜商业访谈录 EP117 | 4.9 万字精校文稿 · 4 条可点编年史 · 36 篇论文与 36 位研究者索引 |

## 这个站是怎么做的

**静态站，运行时零进程。** 构建期把 Markdown 编译成完整 HTML，nginx 直接发文件。
文稿 4.9 万字全部在 HTML 里，不靠前端解析 —— 首屏、SEO、可检索都靠这个。

```
content/<条目>/
├── entry.json        元数据 + 模块清单（详情页按它拼装，所以每条可以长得不一样）
├── transcript.md     精校文稿，段首带 〔00:00:00〕 时间码
├── index.md          资料索引：论文 / 人物 / 视频 / 演讲 / 访谈 / 书 / 延伸 / 报告 / 数据集
├── chronicle.json    编年史轨道与节点
└── assets/           PPT 等附件

src/parse.mjs   Markdown → 结构化数据
src/render.mjs  结构化数据 → HTML
src/build.mjs   content/ → dist/（含下载包、sitemap、交叉引用校验）
public/         app.css / app.js（浏览器只负责交互、编年史 SVG 与埋点）
```

构建：

```bash
node src/build.mjs            # 输出到 dist/，默认 BASE_PATH=/learn-ai
BASE_PATH= node src/build.mjs # 本地预览用（根路径）
```

构建期会做交叉校验：编年史每个节点都要指得到论文和文稿章节，论文都要有原文链接 ——
指不到就让构建失败，而不是上线后发现点了没反应。

设计稿与设计说明在 [`design/`](design/)，完整技术方案在 [`技术方案.md`](技术方案.md)。

## 素材来源与权利

这个仓库里的东西来自不同的人，分开说清楚：

- **节目本身**（音频、Shownotes）版权属于《张小珺Jùn｜商业访谈录》与语言即世界工作室。
  本站不托管音频，播放走[小宇宙原页](https://www.xiaoyuzhoufm.com/episode/68ff9d1b083a71a4eb86c52c)的地址。
- **PPT**《AI演义，36篇论文开启你的探索之旅》版权属于嘉宾**谢青池**。
  节目中明确表示开源分享，[原始飞书链接](https://w7py8ou4dk.feishu.cn/wiki/KacewdlmSiSGC9kUOKDch9gwnKf)在 Shownotes 里。
- **文字稿与资料索引**由我基于公开音频转写、逐段精校、逐条查证而成，可自由取用（CC BY 4.0），
  注明出处即可。校订依据见 `content/*/revisions.md`。
- **论文**版权属于各自作者与出版方。**本仓库与本站都不托管任何论文 PDF**，
  只提供查证过的原文链接（资料区逐篇可点，下载包里也有一份 `论文链接.txt`）。
- **代码**（`src/`、`public/`、构建脚本）MIT，见 [LICENSE](LICENSE)。

如果你是上述任何内容的权利人，认为这里的呈现方式不合适，
提一个 issue 或者邮件说一声，**收到通知即下架**。

## 统计

站上有极轻量的访问统计（PV / UV / 下载 / 阅读进度），打到我自建的服务上，
**不引第三方脚本、不放 cookie**，visitor id 是浏览器本地生成的随机串。
