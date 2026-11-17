# learn-ai

AI 论文、课程和播客的中文精读笔记，在线阅读：<https://xslaoxu.cn/learn-ai/>

每一条都按"不看原文也能读懂"来写：论文逐句批注、配自绘示意图，附原论文的逐段中英对照；课程和播客整理成分节笔记或精校文字稿，时间码可以直接跳到录像。全站可搜索。

### 论文精读

- [逐字、逐句理解 Transformer](https://xslaoxu.cn/learn-ai/attention-is-all-you-need/)：《Attention Is All You Need》全文批注，开头两张全景图画出整个架构和一句话从输入到输出的过程
- [GPT 系列](https://xslaoxu.cn/learn-ai/gpt-evolution/)：GPT-1、GPT-2、GPT-3、InstructGPT、GPT-4 五篇论文
- [GPT-4 之后：大语言模型的关键技术](https://xslaoxu.cn/learn-ai/after-gpt4/)：2023 年 3 月以来注意力、Mixture-of-Experts、长上下文、后训练、推理模型、工具调用等方面换了哪些做法，每个概念给出机制和出处
- [AlexNet](https://xslaoxu.cn/learn-ai/alexnet/)：《ImageNet Classification with Deep Convolutional Neural Networks》
- [ResNet](https://xslaoxu.cn/learn-ai/resnet/)：《Deep Residual Learning for Image Recognition》

### 生成模型

- [生成模型二十年](https://xslaoxu.cn/learn-ai/generative-models/)：只讲图像和视频，自回归、变分自编码器、对抗网络、流模型、扩散、流匹配六类做法各自解决了什么问题，卡在哪里，后来怎么合到一起
- [VAE](https://xslaoxu.cn/learn-ai/vae/)、[GAN](https://xslaoxu.cn/learn-ai/gan/)、[DDPM](https://xslaoxu.cn/learn-ai/ddpm/)、[LDM](https://xslaoxu.cn/learn-ai/latent-diffusion/)、[DiT](https://xslaoxu.cn/learn-ai/dit/)、[Flow Matching 与 Rectified Flow](https://xslaoxu.cn/learn-ai/flow-matching/)：每篇都有综述（来历、推导、后续发展）、原论文中英对照、常见问题，以及相关视频讲解的笔记
- [History of Diffusion](https://xslaoxu.cn/learn-ai/history-of-diffusion/)：Jascha Sohl-Dickstein、宋飏、Sander Dieleman 三期访谈的分节笔记

### 课程

- [基础概念](https://xslaoxu.cn/learn-ai/basics/)：线性代数、概率与信息论、深度学习常用概念，共 132 节，按依赖顺序排
- [CS231n 计算机视觉](https://xslaoxu.cn/learn-ai/cs231n/)：斯坦福 Spring 2025 全部 18 讲，另附 387 篇引用论文
- [Karpathy《Zero to Hero》](https://xslaoxu.cn/learn-ai/zero-to-hero/)：从手写反向传播到复现 GPT-2，全部 10 集

### 播客

- [开源一段论文探索之旅](https://xslaoxu.cn/learn-ai/ep117-paper-journey/)：《张小珺Jùn｜商业访谈录》EP117，谢青池讲 36 篇论文。逐段精校文字稿、四条可跳播的编年史、论文与人物索引
- [播客精校稿合集](https://xslaoxu.cn/learn-ai/podcasts/)：12 期 AI 播客的逐段精校文字稿，包括 DeepSeek 论文、注意力机制之争、Kimi 与杨植麟、多模态与世界模型

### 本地构建

需要 Node.js 18.18 以上和 `zip`，没有其他依赖。

```bash
npm run dev      # 构建到 dist/，在 http://localhost:8188 预览
```

仓库只放网站成品和构建代码：

```
content/<条目>/   entry.json（标题、摘要、出处）、page.html 成品页、配图和附件
src/             构建脚本，把 content/ 组装成 dist/，并生成全站搜索索引
public/          站点共用的 css 和 js
```

论文精读页的 `page.html` 是提交进来的成品，构建时只替换链接、把内联图片拆成独立文件，不会重新生成。生成这些页面的素材和工具不在这个仓库里。

### 版权

论文版权属于各自作者和出版方。播客音频和 Shownotes 版权属于原节目，本站不托管音频；EP117 的 PPT 版权属于嘉宾谢青池，节目中说明了开源分享。课程录像版权属于原课程。

批注、译文、文字稿整理和示意图由我完成，代码以 MIT 许可发布，见 [LICENSE](LICENSE)。

如果你是上述内容的权利人，认为这里的呈现方式不合适，请提 issue 告知，收到后即下架。
