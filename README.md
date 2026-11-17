# learn-ai

> 一篇一篇，跟上 AI 时代
> **https://xslaoxu.cn/learn-ai**

我深度读透过的东西，一条一条留在这里。判断标准只有一条：
**别人打开这一页，能不能不靠我解释就把这件事学一遍。**

## 条目

- [GPT-4 之后：大语言模型的关键技术](https://xslaoxu.cn/learn-ai/after-gpt4/) —— 注意力、Mixture-of-Experts、残差流、长上下文、后训练、工具调用，2023 年 3 月以来换了哪些做法
- [AlexNet](https://xslaoxu.cn/learn-ai/alexnet/) —— 《ImageNet Classification with Deep Convolutional Neural Networks》论文精读
- [逐字、逐句理解 Transformer](https://xslaoxu.cn/learn-ai/attention-is-all-you-need/) —— 《Attention Is All You Need》论文精读
- [基础概念](https://xslaoxu.cn/learn-ai/basics/) —— 线性代数、概率与信息论、深度学习的常用概念，讲清定义、配图和在 AI 中的应用
- [CS231n 计算机视觉](https://xslaoxu.cn/learn-ai/cs231n/) —— 斯坦福 Spring 2025 全部 18 讲分节笔记，另附 387 篇引用论文和补充视频
- [DDPM](https://xslaoxu.cn/learn-ai/ddpm/) —— 去噪扩散概率模型的来历、完整推导和后续发展，附原论文逐段中英对照
- [DiT](https://xslaoxu.cn/learn-ai/dit/) —— 扩散 Transformer 的来历、结构和后续发展，附原论文逐段中英对照
- [开源一段论文探索之旅](https://xslaoxu.cn/learn-ai/ep117-paper-journey/) —— 张小珺Jùn｜商业访谈录 EP117，模型范式、Infra 和数据、语言、多模态的完整变迁史
- [Flow Matching 与 Rectified Flow](https://xslaoxu.cn/learn-ai/flow-matching/) —— 在噪声和数据之间回归速度场：两篇同期论文的条件构造、理论保证和 reflow
- [GAN](https://xslaoxu.cn/learn-ai/gan/) —— 生成对抗网络的来历、完整推导和后续发展，附原论文逐段中英对照
- [生成模型二十年](https://xslaoxu.cn/learn-ai/generative-models/) —— 只讲图像和视频：自回归、变分自编码器、对抗网络、流模型、扩散、流匹配六类做法各自解决了什么
- [GPT 系列](https://xslaoxu.cn/learn-ai/gpt-evolution/) —— GPT-1、GPT-2、GPT-3、InstructGPT、GPT-4 论文精读
- [History of Diffusion](https://xslaoxu.cn/learn-ai/history-of-diffusion/) —— 扩散模型访谈史：三期访谈的分节笔记，配中英字幕
- [LDM](https://xslaoxu.cn/learn-ai/latent-diffusion/) —— 隐空间扩散模型的来历、方法和后续发展，Stable Diffusion 的基础
- [播客精校稿合集](https://xslaoxu.cn/learn-ai/podcasts/) —— 12 期 AI 播客的逐段精校文字稿
- [ResNet](https://xslaoxu.cn/learn-ai/resnet/) —— 《Deep Residual Learning for Image Recognition》论文精读
- [VAE](https://xslaoxu.cn/learn-ai/vae/) —— 变分自编码器的来历、每个计算环节和后续发展，附原论文逐段中英对照
- [Karpathy《Zero to Hero》](https://xslaoxu.cn/learn-ai/zero-to-hero/) —— 从手写反向传播到复现 GPT-2，播放列表全部 10 集的分节笔记

## 目录

```
content/     每条一个文件夹：entry.json、文稿或成品页、配图
src/         构建：content/ → dist/
public/      站点的 css / js
```

```bash
npm run build
```

这个仓库只放成品和生成它的代码。素材源文件、部署脚本、服务器配置留在本地，不进仓库。
论文精读页的成品 `page.html` 直接提交在 `content/<条目>/` 里，构建时原样发布；重新生成它们的工具也不在这个仓库。

## 出处

节目音频与 Shownotes 版权属于《张小珺Jùn｜商业访谈录》，本站不托管音频；PPT 版权属于嘉宾谢青池，
节目中明确表示开源分享；论文版权属于各自作者与出版方。文字稿与批注由我写成，代码 MIT，见 [LICENSE](LICENSE)。

如果你是上述任何内容的权利人，认为这里的呈现方式不合适，提一个 issue 或者邮件说一声，**收到通知即下架**。
