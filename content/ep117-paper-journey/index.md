# 04 - 资料索引

> 对应节目：**张小珺Jùn｜商业访谈录 EP117**《开源一段论文探索之旅：模型范式、Infra和数据、语言、多模态的完整变迁史》  
> 嘉宾：谢青池 ｜ 发布：2025-10-28 ｜ 时长：4h22m  
> 节目页：[https://www.xiaoyuzhoufm.com/episode/68ff9d1b083a71a4eb86c52c](https://www.xiaoyuzhoufm.com/episode/68ff9d1b083a71a4eb86c52c)

## 关于本索引

-   共收录 **36 篇**论文 / 资料（Shownotes 列了 34 行，其中「seq2seq 和 Attention 的引入」「Scaling Law & Chinchilla」各含 2 篇，合计 36）。
-   **「首次发表」一律以 arXiv v1 提交日期为准**；无 arXiv 版本的（AlexNet、AlphaGo Zero、GPT-1、GPT-2、Brook、DeepVideo、The Bitter Lesson）以会议/期刊/官方发布日期为准，并注明来源。
-   `papers/` 主目录统一按 `YYYY.MM.DD-短标题` 命名。仅有月份而没有可靠日信息的 Brook 以当月 1 日占位；AlexNet、DeepVideo 使用会议起始日。
-   每条都标注了与 Shownotes 时间的核对结果：`✅ 一致` / `⚠️ 有出入` / `ℹ️ 需要说明`。
-   所有链接均经实际查证；查不到的写「未查到」。
-   PPT 右上角的 34 个 URI 只作线索，不能单独作为完整性依据：它没有覆盖全部 36 篇，且 Tulu 3 有一条错链。文件核对、补遗资料与待确认线索现已合并在本索引。

---

# 论文索引

主线清单实际是 **36 篇**：Shownotes 虽写成 34 个编号，但“seq2seq 和 Attention”与“Scaling Law 和 Chinchilla”各包含两篇。`papers/` 主目录现有 **36 个可打开的主线 PDF**；`延伸资料/` 收纳 ImageNet/ILSVRC 综述。

复核时修正了以下问题：

| 项 | 原状 | 处理 |
| --- | --- | --- |
| Tulu 3 | PPT 第 40 页链接为 `arXiv:2407.15541`，实际是流体力学论文 | 已按标题核到正确的 `arXiv:2411.15124` 并下载 82 页全文； |

## Part 1 模型的范式变迁

### 1\. Brook：用 GPU 做通用计算

-   **标题**：*Brook for GPUs: Stream Computing on Graphics Hardware*
-   **作者**：Ian Buck、Tim Foley、Daniel Horn、Jeremy Sugerman、Kayvon Fatahalian、Mike Houston、**Pat Hanrahan**
-   **机构**：斯坦福大学 计算机图形学实验室
-   **首次发表**：2004 年 8 月，SIGGRAPH 2004 / *ACM Transactions on Graphics* 23(3) —— **✅ 与 Shownotes 标注（2004.08）一致**
-   **链接**：
    -   PDF：[https://graphics.stanford.edu/papers/brookgpu/brookgpu.pdf](https://graphics.stanford.edu/papers/brookgpu/brookgpu.pdf)
    -   ACM DL：[https://dl.acm.org/doi/10.1145/1015706.1015800](https://dl.acm.org/doi/10.1145/1015706.1015800)
-   **意义**：把 GPU 从"画图的芯片"变成"可编程的流式协处理器"。用 C 语言的数据并行扩展屏蔽掉图形管线细节，是 GPGPU 的开山之作 —— 第一作者 Ian Buck 次年入职 NVIDIA，直接把 Brook 的思路做成了 CUDA。

### 2\. AlexNet：深度学习的开端

-   **标题**：*ImageNet Classification with Deep Convolutional Neural Networks*
-   **作者**：**Alex Krizhevsky**、**Ilya Sutskever**、**Geoffrey E. Hinton**
-   **机构**：多伦多大学
-   **首次发表**：**NIPS 2012（2012 年 12 月正式发表，无 arXiv 预印本）** —— **ℹ️ Shownotes 标注 2012.10 需说明**：论文本身发表于 12 月的 NIPS；2012 年 10 月对应的是 ILSVRC-2012 竞赛结果在 ECCV 2012 workshop（10 月 13 日，佛罗伦萨）上公布、AlexNet 一战成名的时刻。两个日期指向不同事件，Shownotes 取的是"出圈时刻"。
-   **链接**：
    -   NIPS 论文页：[https://papers.nips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks](https://papers.nips.cc/paper/4824-imagenet-classification-with-deep-convolutional-neural-networks)
    -   ImageNet 官方存档 PDF：[https://www.image-net.org/static\_files/files/supervision.pdf](https://www.image-net.org/static_files/files/supervision.pdf)
-   **意义**：ImageNet top-5 错误率从 26.2% 一举降到 15.3%。第一次证明"大数据 + 大网络 + GPU"这条路走得通，深度学习十年浪潮的起点。

### 3-a. seq2seq：对序列建模

-   **标题**：*Sequence to Sequence Learning with Neural Networks*
-   **作者**：**Ilya Sutskever**、**Oriol Vinyals**、**Quoc V. Le**
-   **机构**：Google
-   **首次发表**：**2014-09-10**（arXiv v1）—— **✅ 与 Shownotes（2014.09）一致**
-   **链接**：[https://arxiv.org/abs/1409.3215](https://arxiv.org/abs/1409.3215)
-   **意义**：确立"编码器把整句压成一个向量 → 解码器逐词生成"的范式，让神经网络第一次能端到端做变长序列到变长序列的映射。

### 3-b. Attention 的引入

-   **标题**：*Neural Machine Translation by Jointly Learning to Align and Translate*
-   **作者**：**Dzmitry Bahdanau**、**Kyunghyun Cho**、**Yoshua Bengio**
-   **机构**：Jacobs University Bremen（Bahdanau）+ 蒙特利尔大学 / MILA
-   **首次发表**：**2014-09-01**（arXiv v1）—— **✅ 与 Shownotes（2014.09）一致**
-   **链接**：[https://arxiv.org/abs/1409.0473](https://arxiv.org/abs/1409.0473)
-   **意义**：指出"把整句压进一个固定向量"是瓶颈，让解码器每一步自己去原句里"看"该看的位置 —— Attention 机制的原始出处，三年后 Transformer 把它推到极致。

### 4\. 知识蒸馏：模型能被学习吗？

-   **标题**：*Distilling the Knowledge in a Neural Network*
-   **作者**：**Geoffrey Hinton**、**Oriol Vinyals**、**Jeff Dean**
-   **机构**：Google
-   **首次发表**：**2015-03-09**（arXiv v1）—— **✅ 与 Shownotes（2015.03）一致**
-   **链接**：[https://arxiv.org/abs/1503.02531](https://arxiv.org/abs/1503.02531)
-   **意义**：用大模型输出的"软标签"（带温度的概率分布）去训小模型，把知识从教师迁移到学生。今天所有模型压缩、小模型蒸馏大模型的做法都源于此。

### 5\. ResNet：比深更深

-   **标题**：*Deep Residual Learning for Image Recognition*
-   **作者**：**何恺明 Kaiming He**、张祥雨 Xiangyu Zhang、任少卿 Shaoqing Ren、孙剑 Jian Sun
-   **机构**：微软亚洲研究院（MSRA）
-   **首次发表**：**2015-12-10**（arXiv v1）—— **✅ 与 Shownotes（2015.12）一致**
-   **链接**：[https://arxiv.org/abs/1512.03385](https://arxiv.org/abs/1512.03385)
-   **意义**：残差连接（`y = F(x) + x`）解决了深层网络退化问题，网络深度从几十层直接推到 152 层乃至上千层。残差连接后来成为 Transformer 等几乎所有现代架构的标配。CVPR 2016 最佳论文，是 21 世纪被引用最多的论文之一。

### 6\. Transformer：拉开一个时代的序幕

-   **标题**：*Attention Is All You Need*
-   **作者**：**Ashish Vaswani**、**Noam Shazeer**、Niki Parmar、Jakob Uszkoreit、Llion Jones、Aidan N. Gomez、Łukasz Kaiser、Illia Polosukhin
-   **机构**：Google Brain / Google Research
-   **首次发表**：**2017-06-12**（arXiv v1）—— **✅ 与 Shownotes（2017.06）一致**
-   **链接**：[https://arxiv.org/abs/1706.03762](https://arxiv.org/abs/1706.03762)
-   **意义**：彻底抛弃 RNN/CNN，只用注意力 + 前馈层。因为可以完全并行，它把"堆算力"从工程难题变成了可执行方案 —— 今天所有大模型的共同祖先。

### 7\. AlphaGo Zero：强化学习的突破

-   **标题**：*Mastering the game of Go without human knowledge*
-   **作者**：**David Silver**、Julian Schrittwieser、**Karen Simonyan** 等，通讯 **Demis Hassabis**
-   **机构**：DeepMind
-   **首次发表**：**2017-10-19**，*Nature* 550, 354–359（无 arXiv 预印本）—— **✅ 与 Shownotes（2017.10）一致**
-   **链接**：[https://www.nature.com/articles/nature24270](https://www.nature.com/articles/nature24270) （DOI: 10.1038/nature24270）
-   **意义**：完全不用人类棋谱，纯自我对弈从零学起，3 天超越战胜李世石的 AlphaGo。"自博弈 + 搜索 + 强化学习"能产生超越人类的能力，这个结论直接启发了今天的 RL 后训练和推理模型。

### 8\. 现代 MoE 的开端

-   **标题**：*Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer*
-   **作者**：**Noam Shazeer**、Azalia Mirhoseini、Krzysztof Maziarz、Andy Davis、**Quoc Le**、**Geoffrey Hinton**、**Jeff Dean**
-   **机构**：Google Brain
-   **首次发表**：**2017-01-23**（arXiv v1）—— **✅ 与 Shownotes（2017.01）一致**
-   **链接**：[https://arxiv.org/abs/1701.06538](https://arxiv.org/abs/1701.06538)
-   **意义**：稀疏门控让模型总参数量涨到 1370 亿，但每个 token 只激活极小一部分专家 —— “参数量和计算量解耦”。DeepSeek、Mixtral、Qwen 等今天的 MoE 架构都是这条线的延续。

### 9\. CoT：Prompt Engineering 的奠基之作

-   **标题**：*Chain-of-Thought Prompting Elicits Reasoning in Large Language Models*
-   **作者**：**Jason Wei**、Xuezhi Wang、Dale Schuurmans、Maarten Bosma、Brian Ichter、Fei Xia、Ed Chi、**Quoc Le**、Denny Zhou
-   **机构**：Google Research, Brain team
-   **首次发表**：**2022-01-28**（arXiv v1）—— **✅ 与 Shownotes（2022.01）一致**
-   **链接**：[https://arxiv.org/abs/2201.11903](https://arxiv.org/abs/2201.11903)
-   **意义**：只要在提示里给几个"写出中间推理步骤"的示例，大模型的数学和逻辑能力就大幅跃升。揭示了推理能力是"涌现"出来、可以被提示激发的 —— 后来 o1 / R1 一系推理模型的思想源头。

### 10\. LoRA：那个我们每天都在用的东西

-   **标题**：*LoRA: Low-Rank Adaptation of Large Language Models*
-   **作者**：**Edward J. Hu**、Yelong Shen、Phillip Wallis、Zeyuan Allen-Zhu、Yuanzhi Li、Shean Wang、Lu Wang、Weizhu Chen
-   **机构**：微软
-   **首次发表**：**2021-06-17**（arXiv v1）—— **✅ 与 Shownotes（2021.06）一致**
-   **链接**：[https://arxiv.org/abs/2106.09685](https://arxiv.org/abs/2106.09685)
-   **意义**：冻住预训练权重，只训练注入的低秩矩阵，可训练参数量降到万分之一而效果几乎不掉。让个人和小团队也能微调大模型 —— Stable Diffusion 社区几十万个 LoRA 就是它的产物。

### 11\. ReAct：Agent 从理论到落地

-   **标题**：*ReAct: Synergizing Reasoning and Acting in Language Models*
-   **作者**：**姚顺雨 Shunyu Yao**、Jeffrey Zhao、Dian Yu、Nan Du、Izhak Shafran、**Karthik Narasimhan**、Yuan Cao
-   **机构**：普林斯顿大学 + Google Brain
-   **首次发表**：**2022-10-06**（arXiv v1）—— **✅ 与 Shownotes（2022.10）一致**
-   **链接**：[https://arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)
-   **意义**：把"推理（Thought）"和"行动（Action）"交错起来 —— 模型先想、再调工具、看到结果再想。这就是今天几乎所有 Agent 框架（LangChain、AutoGPT 等）的基本循环。

### 12\. The Bitter Lesson：过去 70 年的教训

-   **标题**：*The Bitter Lesson*（**博客文章，不是论文**）
-   **作者**：**Richard S. Sutton**（强化学习之父，2024 年图灵奖得主）
-   **机构**：阿尔伯塔大学 / Amii（写作时同时在 DeepMind Alberta）
-   **首次发表**：**2019-03-13** —— **⚠️ 与 Shownotes 标注（2018.08）不符，实际晚了约 7 个月。本清单中时间出入最大的一条。**
-   **链接**：[http://incompleteideas.net/IncIdeas/BitterLesson.html](http://incompleteideas.net/IncIdeas/BitterLesson.html)
-   **意义**：一篇不到 1200 词的短文，结论是 AI 70 年历史反复证明：**依赖人类先验知识的方法最终都会输给能吃掉算力的通用方法（搜索与学习）**。今天几乎所有关于 Scaling 的争论都绕不开它。

---

## Part 2 Infra 与数据的变迁

### 13\. ZeRO：大规模 GPU 并行

-   **标题**：*ZeRO: Memory Optimizations Toward Training Trillion Parameter Models*
-   **作者**：**Samyam Rajbhandari**、Jeff Rasley、Olatunji Ruwase、**Yuxiong He**
-   **机构**：微软（DeepSpeed 团队）
-   **首次发表**：**2019-10-04**（arXiv v1）—— **✅ 与 Shownotes（2019.10）一致**
-   **链接**：[https://arxiv.org/abs/1910.02054](https://arxiv.org/abs/1910.02054)
-   **意义**：把优化器状态、梯度、参数分片到不同 GPU 上而不是每卡各存一份，显存瓶颈被打开。DeepSpeed 由此诞生，是"千亿参数训练变成工程可行"的关键一步。

### 14\. Scaling Law：上帝的指挥棒（上）

-   **标题**：*Scaling Laws for Neural Language Models*
-   **作者**：**Jared Kaplan**、Sam McCandlish、Tom Henighan、Tom B. Brown、Benjamin Chess、Rewon Child、Scott Gray、**Alec Radford**、Jeffrey Wu、**Dario Amodei**
-   **机构**：OpenAI（+ 约翰霍普金斯大学）
-   **首次发表**：**2020-01-23**（arXiv v1）—— **✅ 与 Shownotes（2020.01）一致**
-   **链接**：[https://arxiv.org/abs/2001.08361](https://arxiv.org/abs/2001.08361)
-   **意义**：模型性能随参数量、数据量、算力呈平滑幂律提升，且可外推预测。它把"再大一点会更好吗"从信仰变成了可计算的工程决策 —— GPT-3 是直接的产物。

### 15\. Chinchilla：上帝的指挥棒（下）

-   **标题**：*Training Compute-Optimal Large Language Models*
-   **作者**：**Jordan Hoffmann**、Sebastian Borgeaud、Arthur Mensch、…、**Karen Simonyan**、**Oriol Vinyals**、Laurent Sifre 等
-   **机构**：DeepMind
-   **首次发表**：**2022-03-29**（arXiv v1）—— **✅ 与 Shownotes（2022.03）一致**
-   **链接**：[https://arxiv.org/abs/2203.15556](https://arxiv.org/abs/2203.15556)
-   **意义**：修正了 Kaplan 的结论 —— 在给定算力下，此前的模型普遍"参数太大、数据太少"。参数和数据应大致等比例增长（约 20 token / 参数）。700 亿参数的 Chinchilla 打败了 2800 亿的 Gopher，此后所有大模型的配方都被改写。

### 16\. LAION-5B：开源社区的英雄主义

-   **标题**：*LAION-5B: An open large-scale dataset for training next generation image-text models*
-   **作者**：**Christoph Schuhmann**、Romain Beaumont、Richard Vencu、Cade Gordon、Ross Wightman、Mehdi Cherti、…、Ludwig Schmidt、Robert Kaczmarczyk、Jenia Jitsev
-   **机构**：LAION（德国非营利组织）+ Hugging Face、Stability AI、UC Berkeley、华盛顿大学、于利希超算中心等
-   **首次发表**：**2022-10-16**（arXiv v1）—— **✅ 与 Shownotes（2022.10）一致**
-   **链接**：[https://arxiv.org/abs/2210.08402](https://arxiv.org/abs/2210.08402)
-   **意义**：58.5 亿图文对，全部开放。一群志愿者做出了此前只有大公司才有的规模数据集 —— Stable Diffusion、OpenCLIP 都建在它之上。
-   **勘误提示**：节目下有听众指出，Schuhmann 做 LAION 的直接动因是被 OpenAI 的 **DALL·E**（权重未开源）刺激，而非 CLIP（权重已开源）。

### 17\. The RefinedWeb：互联网数据也很够用

-   **标题**：*The RefinedWeb Dataset for Falcon LLM: Outperforming Curated Corpora with Web Data, and Web Data Only*
-   **作者**：**Guilherme Penedo**、Quentin Malartic、Daniel Hesslow、Ruxandra Cojocaru、Alessandro Cappelli、Hamza Alobeidli、Baptiste Pannier、Ebtesam Almazrouei、Julien Launay
-   **机构**：Technology Innovation Institute（TII，阿布扎比）
-   **首次发表**：**2023-06-01**（arXiv v1）—— **✅ 与 Shownotes（2023.06）一致**
-   **链接**：[https://arxiv.org/abs/2306.01116](https://arxiv.org/abs/2306.01116)
-   **意义**：证明只要清洗和去重做得足够狠，纯 CommonCrawl 网页数据训出来的模型能超过掺了大量精选语料（书籍、维基）的模型。"数据质量 > 数据来源高贵"的关键证据，也解答了"数据会不会用完"的焦虑。

### 18\. MegaScale：万卡 GPU 集群训练

-   **标题**：*MegaScale: Scaling Large Language Model Training to More Than 10,000 GPUs*
-   **作者**：**Ziheng Jiang**、Haibin Lin、Yinmin Zhong 等 33 人，通讯含 **Xin Jin**（北大）、Xin Liu
-   **机构**：字节跳动 + 北京大学
-   **首次发表**：**2024-02-23**（arXiv v1）—— **✅ 与 Shownotes（2024.02）一致**
-   **链接**：[https://arxiv.org/abs/2402.15627](https://arxiv.org/abs/2402.15627)
-   **意义**：万卡级训练的系统工程全景 —— 算法与系统协同设计、全栈可观测性、故障自动诊断与恢复。在 12288 卡上训 1750 亿模型达到 55.2% MFU。国产团队在超大规模 Infra 上罕见的公开细节。

---

## Part 3 语言模型的发展

### 19\. Word2Vec：把单词向量化

-   **标题**：*Efficient Estimation of Word Representations in Vector Space*
-   **作者**：**Tomáš Mikolov**、Kai Chen、Greg Corrado、**Jeffrey Dean**
-   **机构**：Google
-   **首次发表**：**2013-01-16**（arXiv v1）—— **✅ 与 Shownotes（2013.01）一致**
-   **链接**：[https://arxiv.org/abs/1301.3781](https://arxiv.org/abs/1301.3781)
-   **意义**：CBOW 与 Skip-gram 让词向量的训练成本降到能跑十亿级语料，并展示了 `king - man + woman ≈ queen` 这样的向量算术。"语义可以被几何表示"这个直觉从此深入人心。2023 年获 NeurIPS 时间检验奖。

### 20\. Google Translate（GNMT）：神经网络的大规模线上部署

-   **标题**：*Google’s Neural Machine Translation System: Bridging the Gap between Human and Machine Translation*
-   **作者**：**Yonghui Wu**、Mike Schuster、Zhifeng Chen、**Quoc V. Le**、…、**Oriol Vinyals**、Greg Corrado、Macduff Hughes、**Jeffrey Dean**（共 31 人）
-   **机构**：Google
-   **首次发表**：**2016-09-26**（arXiv v1）—— **✅ 与 Shownotes（2016.09）一致**
-   **链接**：[https://arxiv.org/abs/1609.08144](https://arxiv.org/abs/1609.08144)
-   **意义**：不是新算法，而是把 seq2seq + Attention 真正推上了服务几亿用户的生产系统（8 层 LSTM、低精度推理、WordPiece 分词、TPU 部署）。深度学习第一次大规模商业落地的标志性事件。

### 21\. GPT-1，它来了

-   **标题**：*Improving Language Understanding by Generative Pre-Training*（OpenAI 技术报告，无 arXiv 版本）
-   **作者**：**Alec Radford**、**Karthik Narasimhan**、Tim Salimans、**Ilya Sutskever**
-   **机构**：OpenAI
-   **首次发表**：**2018-06-11** —— **✅ 与 Shownotes（2018.06）一致**
-   **链接**：[https://cdn.openai.com/research-covers/language-unsupervised/language\_understanding\_paper.pdf](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf)
-   **意义**：确立"大规模无监督预训练 + 下游有监督微调"两段式范式，且只用 Transformer 的 Decoder。整个 GPT 家族的第一块砖。

### 22\. BERT：曾经的王

-   **标题**：*BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding*
-   **作者**：**Jacob Devlin**、Ming-Wei Chang、Kenton Lee、Kristina Toutanova
-   **机构**：Google AI Language
-   **首次发表**：**2018-10-11**（arXiv v1）—— **✅ 与 Shownotes（2018.10）一致**
-   **链接**：[https://arxiv.org/abs/1810.04805](https://arxiv.org/abs/1810.04805)
-   **意义**：用掩码语言模型做双向预训练，11 项 NLP 任务全面刷榜，统治学术界与工业界数年。**注意架构差别**：BERT 是 encoder-only，GPT 是 decoder-only，标准 Transformer 是 encoder-decoder（节目中此处有听众指出的口误）。

### 23\. GPT-2：是时候告别微调了

-   **标题**：*Language Models are Unsupervised Multitask Learners*（OpenAI 技术报告，无 arXiv 版本）
-   **作者**：**Alec Radford**、Jeffrey Wu、Rewon Child、David Luan、**Dario Amodei**、**Ilya Sutskever**
-   **机构**：OpenAI
-   **首次发表**：**2019-02-14** —— **✅ 与 Shownotes（2019.02）一致**
-   **链接**：
    -   论文 PDF（OpenAI 官方仓库给出的地址）：[https://d4mucfpksywv.cloudfront.net/better-language-models/language-models.pdf](https://d4mucfpksywv.cloudfront.net/better-language-models/language-models.pdf)
    -   代码：[https://github.com/openai/gpt-2](https://github.com/openai/gpt-2)
-   **意义**：15 亿参数，零样本就能在 8 个语言建模基准中的 7 个上刷到 SOTA。提出"所有 NLP 任务都可以是语言建模任务"，微调不再是必须。也是第一次因"太危险"而分阶段发布模型的事件。

### 24\. GPT-3：ChatGPT 来临前夜

-   **标题**：*Language Models are Few-Shot Learners*
-   **作者**：**Tom B. Brown**、Benjamin Mann、Nick Ryder、Melanie Subbiah、**Jared Kaplan**、Prafulla Dhariwal、…、**Alec Radford**、**Ilya Sutskever**、**Dario Amodei**（共 31 人）
-   **机构**：OpenAI
-   **首次发表**：**2020-05-28**（arXiv v1）—— **✅ 与 Shownotes（2020.05）一致**
-   **链接**：[https://arxiv.org/abs/2005.14165](https://arxiv.org/abs/2005.14165)
-   **意义**：1750 亿参数，把"上下文学习（in-context learning）"确立为大模型的核心能力 —— 不改一个权重，只给几个例子就能做新任务。Prompt 成为新的接口。

### 25\. InstructGPT：给 LLM 以文明

-   **标题**：*Training language models to follow instructions with human feedback*
-   **作者**：**Long Ouyang**、Jeff Wu、Xu Jiang、Diogo Almeida、Carroll L. Wainwright、Pamela Mishkin、…、**John Schulman**、**Jan Leike**、**Ryan Lowe**
-   **机构**：OpenAI
-   **首次发表**：**2022-03-04**（arXiv v1）—— **✅ 与 Shownotes（2022.03）一致**
-   **链接**：[https://arxiv.org/abs/2203.02155](https://arxiv.org/abs/2203.02155)
-   **意义**：RLHF（人类反馈强化学习）的奠基之作 —— 13 亿参数的 InstructGPT 在人类偏好上打败 1750 亿的 GPT-3。"对齐"从理念变成可复现的工程流程，8 个月后 ChatGPT 就是用这套方法做的。

### 26\. Tulu 3：后训练的开源

-   **标题**：*Tulu 3: Pushing Frontiers in Open Language Model Post-Training*
-   **作者**：**Nathan Lambert**、Jacob Morrison、Valentina Pyatkin、Shengyi Huang、Hamish Ivison 等，通讯含 **Noah A. Smith**、**Hannaneh Hajishirzi**
-   **机构**：艾伦人工智能研究院（Ai2）+ 华盛顿大学
-   **首次发表**：**2024-11-22**（arXiv v1）—— **✅ 与 Shownotes（2024.11）一致**
-   **链接**：[https://arxiv.org/abs/2411.15124](https://arxiv.org/abs/2411.15124)
-   **意义**：把后训练（SFT → DPO → RLVR）的完整配方、数据、代码、评测全部开源。此前后训练是各家最不肯说的黑箱，Tulu 3 把它摊在了桌面上；其中提出的 RLVR（可验证奖励强化学习）是后来推理模型训练的重要一环。

---

## Part 4 多模态模型的发展

### 27\. DeepVideo：深度学习进入视频领域

-   **标题**：*Large-scale Video Classification with Convolutional Neural Networks*
-   **作者**：**Andrej Karpathy**、George Toderici、Sanketh Shetty、Thomas Leung、Rahul Sukthankar、**李飞飞 Fei-Fei Li**
-   **机构**：斯坦福大学 + Google Research
-   **首次发表**：**CVPR 2014（2014 年 6 月 23–28 日举办）**，无 arXiv 预印本 —— **✅ 与 Shownotes（2014.06）一致**
-   **链接**：
    -   CVPR 开放获取：[https://openaccess.thecvf.com/content\_cvpr\_2014/html/Karpathy\_Large-scale\_Video\_Classification\_2014\_CVPR\_paper.html](https://openaccess.thecvf.com/content_cvpr_2014/html/Karpathy_Large-scale_Video_Classification_2014_CVPR_paper.html)
    -   Google Research：[https://research.google/pubs/large-scale-video-classification-with-convolutional-neural-networks/](https://research.google/pubs/large-scale-video-classification-with-convolutional-neural-networks/)
-   **意义**：Sports-1M 数据集（100 万 YouTube 视频、487 类）+ CNN 时序融合方案的系统性评估，把 CNN 从静态图像推向视频。也是 Karpathy 博士期间的成名作之一。

### 28\. 双流网络：Karén 与牛津登场

-   **标题**：*Two-Stream Convolutional Networks for Action Recognition in Videos*
-   **作者**：**Karen Simonyan**、**Andrew Zisserman**
-   **机构**：牛津大学 VGG（Visual Geometry Group）
-   **首次发表**：**2014-06-09**（arXiv v1）—— **✅ 与 Shownotes（2014.06）一致**
-   **链接**：[https://arxiv.org/abs/1406.2199](https://arxiv.org/abs/1406.2199)
-   **意义**：一条空间流看 RGB 单帧（“是什么”），一条时间流看光流堆叠（“怎么动”），两路融合。奠定了此后多年动作识别的主流架构，也是"多模态/多路输入分别建模再融合"思路的早期范本。

### 29\. GAN：图像生成的序章

-   **标题**：*Generative Adversarial Networks*
-   **作者**：**Ian J. Goodfellow**、Jean Pouget-Abadie、Mehdi Mirza、Bing Xu、David Warde-Farley、Sherjil Ozair、**Aaron Courville**、**Yoshua Bengio**
-   **机构**：蒙特利尔大学
-   **首次发表**：**2014-06-10**（arXiv v1）—— **✅ 与 Shownotes（2014.06）一致**
-   **链接**：[https://arxiv.org/abs/1406.2661](https://arxiv.org/abs/1406.2661)
-   **意义**：生成器与判别器对抗博弈。第一次让神经网络能生成以假乱真的图像，统治图像生成领域近 6 年，直到被 Diffusion 取代。

### 30\. Diffusion 原始论文：在 GAN 的阴影下

-   **标题**：*Deep Unsupervised Learning using Nonequilibrium Thermodynamics*
-   **作者**：**Jascha Sohl-Dickstein**、Eric A. Weiss、Niru Maheswaranathan、**Surya Ganguli**
-   **机构**：斯坦福大学
-   **首次发表**：**2015-03-12**（arXiv v1）—— **✅ 与 Shownotes（2015.03）一致**
-   **链接**：[https://arxiv.org/abs/1503.03585](https://arxiv.org/abs/1503.03585)
-   **意义**：借非平衡热力学的思路 —— 一步步给数据加噪声直到变成纯高斯，再学会逆向一步步去噪。Diffusion 模型的数学起点，但在 GAN 的光芒下沉寂了整整 5 年。

### 31\. DDPM：Diffusion 重回舞台中央

-   **标题**：*Denoising Diffusion Probabilistic Models*
-   **作者**：**Jonathan Ho**、Ajay Jain、**Pieter Abbeel**
-   **机构**：加州大学伯克利分校
-   **首次发表**：**2020-06-19**（arXiv v1）—— **✅ 与 Shownotes（2020.06）一致**
-   **链接**：[https://arxiv.org/abs/2006.11239](https://arxiv.org/abs/2006.11239)
-   **意义**：把 2015 年的理论框架大幅简化 —— 目标函数化归为"预测噪声"的简单 MSE，样本质量首次超过 GAN。Diffusion 从此接管图像生成。

### 32\. ViT：当图像遇到 Transformer

-   **标题**：*An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale*
-   **作者**：**Alexey Dosovitskiy**、Lucas Beyer、Alexander Kolesnikov、Dirk Weissenborn、Xiaohua Zhai、Thomas Unterthiner、Mostafa Dehghani、…、**Jakob Uszkoreit**、Neil Houlsby
-   **机构**：Google Research, Brain Team
-   **首次发表**：**2020-10-22**（arXiv v1）—— **✅ 与 Shownotes（2020.10）一致**
-   **链接**：[https://arxiv.org/abs/2010.11929](https://arxiv.org/abs/2010.11929)
-   **意义**：把图像切成 16×16 的 patch 当"单词"喂给标准 Transformer，在足够大的数据上全面超越 CNN。视觉与语言的架构就此统一，是多模态大模型的前提条件。

### 33\. CLIP：文生图的奠基石

-   **标题**：*Learning Transferable Visual Models From Natural Language Supervision*
-   **作者**：**Alec Radford**、Jong Wook Kim、Chris Hallacy、**Aditya Ramesh**、Gabriel Goh、Sandhini Agarwal、Girish Sastry、Amanda Askell、Pamela Mishkin、Jack Clark、Gretchen Krueger、**Ilya Sutskever**
-   **机构**：OpenAI
-   **首次发表**：**2021-02-26**（arXiv v1）—— **⚠️ 与 Shownotes 标注（2021.03）差几天、跨了一个月。**（OpenAI 博客发布更早，为 2021 年 1 月 5 日与 DALL·E 同日预告。）
-   **链接**：[https://arxiv.org/abs/2103.00020](https://arxiv.org/abs/2103.00020)
-   **意义**：4 亿图文对做对比学习，把图像和文本映射到同一语义空间，零样本 ImageNet 分类就能媲美有监督 ResNet-50。它提供了"文字如何指挥图像"的桥梁 —— 后来所有文生图模型的文本编码器几乎都源于此。

### 34\. Stable Diffusion（Latent Diffusion）

-   **标题**：*High-Resolution Image Synthesis with Latent Diffusion Models*
-   **作者**：**Robin Rombach**、Andreas Blattmann、Dominik Lorenz、Patrick Esser、**Björn Ommer**
-   **机构**：慕尼黑大学 CompVis 组 + 海德堡大学 IWR + Runway ML
-   **首次发表**：**2021-12-20**（arXiv v1）—— **✅ 与 Shownotes（2021.12）一致**
-   **链接**：[https://arxiv.org/abs/2112.10752](https://arxiv.org/abs/2112.10752)
-   **意义**：把扩散过程从像素空间搬到 VAE 的低维隐空间，算力需求下降一到两个数量级，消费级显卡也能跑。**ℹ️ 需要区分**：这篇是 \*\*Latent Diffusion（LDM）\*\*论文（CVPR 2022）；以 LDM 为基础的 **Stable Diffusion 模型权重是 2022 年 8 月才公开发布的**，两者相差约 8 个月。

### 35\. DiT：人们期待一个融合的未来

-   **标题**：*Scalable Diffusion Models with Transformers*
-   **作者**：**William (Bill) Peebles**、**谢赛宁 Saining Xie**
-   **机构**：加州大学伯克利分校 + 纽约大学
-   **首次发表**：**2022-12-19**（arXiv v1）—— **✅ 与 Shownotes（2022.12）一致**
-   **链接**：[https://arxiv.org/abs/2212.09748](https://arxiv.org/abs/2212.09748)
-   **意义**：把扩散模型里的 U-Net 换成 Transformer，并证明 Diffusion 也遵循 Scaling Law。第一作者 Peebles 后来去 OpenAI 主导了 **Sora** —— DiT 正是 Sora 的骨干架构。

---

## 时间标注核对汇总

| 条目 | Shownotes 标注 | 实际首次发表 | 结论 |
| --- | --- | --- | --- |
| **The Bitter Lesson** | 2018.08 | **2019-03-13** | ⚠️ **相差约 7 个月，本清单出入最大的一条** |
| **CLIP** | 2021.03 | **2021-02-26**（arXiv v1） | ⚠️ 差几天，跨月 |
| **AlexNet** | 2012.10 | NIPS 2012（**2012 年 12 月**） | ℹ️ 2012.10 指的是 ILSVRC-2012 结果在 ECCV workshop 公布、AlexNet 出圈的时刻，非论文发表日 |
| **Stable Diffusion** | 2021.12 | LDM 论文 2021-12-20 ✓；**SD 模型权重 2022 年 8 月** | ℹ️ 论文日期正确，但"Stable Diffusion"这个名字对应的模型晚约 8 个月 |
| 其余 32 篇 | — | — | ✅ 全部与实际发表月份吻合 |

---

# 人物索引

## 播客主持人 & 嘉宾

### 张小珺（Zhang Xiaojun）

-   **身份**：《张小珺Jùn｜商业访谈录》主播、语言即世界工作室（Language is World）创始人；资深财经科技记者
-   **履历**：曾先后供职于《财经》杂志、腾讯新闻（科技主笔）。
-   **奖项**：13 次国内外新闻奖；2022–2024 连续三届亚洲卓越新闻奖（SOPA，“亚洲普利策”）
-   **公开渠道**：
    -   小宇宙播客主页：[https://www.xiaoyuzhoufm.com/podcast/626b46ea9cbbf0451cf5a962](https://www.xiaoyuzhoufm.com/podcast/626b46ea9cbbf0451cf5a962)
    -   Apple Podcasts：[https://podcasts.apple.com/us/podcast/id1634356920](https://podcasts.apple.com/us/podcast/id1634356920)

### 谢青池（Xie Qingchi）

-   **身份**：本期嘉宾。Shownotes 介绍为"美团光年之外产品负责人"
    
-   **履历**（据雷峰网 2025 年报道）：85 后；2011 年北京邮电大学计算机应用硕士；曾任小麦公社联合创始人、壹间家居创始人；先后就职于豆瓣、百度糯米、美团优选；美团收购光年之外后转岗至光年之外任产品负责人，向王慧文直接汇报；2024 年读了近 300 篇 AI 论文。目前已离职创业，方向为 AI 健身教练（硬件负责人有 10 年大疆背景，软件负责人有 Meta 和 Apple 背景）。雷峰网报道：[https://m.leiphone.com/category/weiwu/exAw2Lq8SaCvJ4dW.html](https://m.leiphone.com/category/weiwu/exAw2Lq8SaCvJ4dW.html)
    

---

## 研究者

按在本清单中出现的篇数排序。

### Ilya Sutskever（伊利亚·苏茨克维）— 出现 6 篇

-   **机构**：Safe Superintelligence Inc.（SSI）联合创始人兼首席科学家；前 OpenAI 联合创始人兼首席科学家
-   **链接**：
    -   X：[https://x.com/ilyasut](https://x.com/ilyasut)
    -   Google Scholar：[https://scholar.google.com/citations?user=x04W\_mMAAAAJ](https://scholar.google.com/citations?user=x04W_mMAAAAJ)
    -   LinkedIn：[https://www.linkedin.com/in/ilya-sutskever/](https://www.linkedin.com/in/ilya-sutskever/)
-   **相关篇目**：AlexNet(2)、seq2seq(3-a)、GPT-1(21)、GPT-2(23)、GPT-3(24)、CLIP(33)

### Alec Radford — 出现 5 篇

-   **机构**：2024 年 12 月离开 OpenAI 转做独立研究；据报道 2025 年起以顾问身份参与 Mira Murati 的 Thinking Machines Lab
-   **链接**：
    -   Wikipedia：[https://en.wikipedia.org/wiki/Alec\_Radford](https://en.wikipedia.org/wiki/Alec_Radford)
    -   X：账号自 2019 年起已清空历史推文，**无活跃公开账号**
-   **相关篇目**：Scaling Law(14)、GPT-1(21)、GPT-2(23)、GPT-3(24)、CLIP(33)
-   **备注**：GPT 系列与 CLIP、Whisper 的共同一作，被称为"最低调的 GPT 之父"

### Jeff Dean（杰夫·迪恩）— 出现 4 篇

-   **机构**：Google DeepMind & Google Research 首席科学家；Google Brain 联合创始人（2011）
-   **链接**：X：[https://x.com/JeffDean](https://x.com/JeffDean) ｜ LinkedIn：[https://www.linkedin.com/in/jeff-dean-8b212555/](https://www.linkedin.com/in/jeff-dean-8b212555/)
-   **相关篇目**：知识蒸馏(4)、MoE(8)、Word2Vec(19)、GNMT(20)

### Quoc V. Le（Lê Viết Quốc）— 出现 4 篇

-   **机构**：Google DeepMind，Google Fellow；Google Brain 创始成员
-   **链接**：
    -   Google Scholar：[https://scholar.google.com/citations?user=vfT6-XIAAAAJ](https://scholar.google.com/citations?user=vfT6-XIAAAAJ)
    -   Wikipedia：[https://en.wikipedia.org/wiki/Quoc\_V.\_Le](https://en.wikipedia.org/wiki/Quoc_V._Le)
    -   X：**未查到活跃认证账号**
-   **相关篇目**：seq2seq(3-a)、MoE(8)、CoT(9)、GNMT(20)

### Oriol Vinyals — 出现 4 篇

-   **机构**：Google DeepMind 研究副总裁、深度学习负责人，Gemini 联合技术负责人
-   **链接**：
    -   X：[https://x.com/oriolvinyalsml](https://x.com/oriolvinyalsml)
    -   Google Scholar：[https://scholar.google.com/citations?user=NkzyCvUAAAAJ](https://scholar.google.com/citations?user=NkzyCvUAAAAJ)
    -   Google Research 主页：[https://research.google/people/oriolvinyals/](https://research.google/people/oriolvinyals/)
-   **相关篇目**：seq2seq(3-a)、知识蒸馏(4)、Chinchilla(15)、GNMT(20)

### Geoffrey Hinton（杰弗里·辛顿）— 出现 3 篇

-   **机构**：多伦多大学名誉教授；2018 年图灵奖、2024 年诺贝尔物理学奖得主；2023 年 5 月从 Google 离职
-   **链接**：X：[https://x.com/geoffreyhinton](https://x.com/geoffreyhinton) ｜ Wikipedia：[https://en.wikipedia.org/wiki/Geoffrey\_Hinton](https://en.wikipedia.org/wiki/Geoffrey_Hinton)
-   **相关篇目**：AlexNet(2)、知识蒸馏(4)、MoE(8)

### Noam Shazeer — 出现 2 篇

-   **机构**：**2026 年 6 月宣布从 Google 加入 OpenAI**；此前为 Google 工程副总裁、Gemini 联合负责人；[Character.AI](http://Character.AI) 联合创始人兼 CEO（2021–2024）
-   **链接**：X：[https://x.com/NoamShazeer](https://x.com/NoamShazeer)
-   **相关篇目**：Transformer(6)、MoE(8)
-   **备注**：Transformer 论文与 MoE 论文的共同作者，"稀疏化 + 注意力"两条主线都有他

### Karen (Karén) Simonyan — 出现 3 篇

-   **机构**：微软 AI 首席科学家（Microsoft AI Chief Scientist）；此前为 Inflection AI 联合创始人兼首席科学家、DeepMind 首席科学家
-   **链接**：Google Scholar：[https://scholar.google.com/citations?user=L7lMQkQAAAAJ](https://scholar.google.com/citations?user=L7lMQkQAAAAJ)
-   **相关篇目**：AlphaGo Zero(7)、Chinchilla(15)、双流网络(28)
-   **备注**：还是 VGG 网络的作者，节目里说的"Karén 和学术重镇牛津登场"就是他

### Yoshua Bengio（约书亚·本吉奥）— 出现 2 篇

-   **机构**：蒙特利尔大学正教授；LawZero 联合主席兼科学总监（2025 年 6 月创立）；Mila 创始人兼科学顾问；2018 年图灵奖得主
-   **链接**：
    -   个人主页：[https://yoshuabengio.org/](https://yoshuabengio.org/)
    -   LawZero 页面：[https://lawzero.org/en/team/yoshua-bengio](https://lawzero.org/en/team/yoshua-bengio)
    -   LinkedIn：[https://ca.linkedin.com/in/yoshuabengio](https://ca.linkedin.com/in/yoshuabengio)
-   **相关篇目**：Attention / Bahdanau(3-b)、GAN(29)

### Dario Amodei — 出现 3 篇

-   **机构**：Anthropic 联合创始人兼 CEO；前 OpenAI 研究副总裁
-   **链接**：Wikipedia：[https://en.wikipedia.org/wiki/Dario\_Amodei](https://en.wikipedia.org/wiki/Dario_Amodei)
-   **相关篇目**：Scaling Law(14)、GPT-2(23)、GPT-3(24)

### Jared Kaplan — 出现 2 篇

-   **机构**：Anthropic 联合创始人兼首席科学官；约翰霍普金斯大学（理论物理出身）
-   **链接**：
    -   Wikipedia：[https://en.wikipedia.org/wiki/Jared\_Kaplan](https://en.wikipedia.org/wiki/Jared_Kaplan)
    -   LinkedIn：[https://www.linkedin.com/in/jared-kaplan-645843213/](https://www.linkedin.com/in/jared-kaplan-645843213/)
-   **相关篇目**：Scaling Law(14)、GPT-3(24)

### 何恺明 Kaiming He

-   **机构**：MIT EECS 副教授；同时兼任 Google DeepMind 杰出科学家
-   **链接**：
    -   MIT 主页：[https://people.csail.mit.edu/kaiming/](https://people.csail.mit.edu/kaiming/)
    -   Google Scholar：[https://scholar.google.com/citations?user=DhtAFkwAAAAJ](https://scholar.google.com/citations?user=DhtAFkwAAAAJ)
    -   GitHub：[https://github.com/KaimingHe](https://github.com/KaimingHe)
    -   X：**无公开活跃账号**（搜索结果中出现一个 @x7Nf0O62g37pjSh，未经本人公开确认，不建议引用）
-   **相关篇目**：ResNet(5)

### Andrej Karpathy（安德烈·卡帕西）

-   **机构**：Eureka Labs 创始人；前特斯拉 AI 总监、前 OpenAI 创始成员
-   **链接**：
    -   个人主页：[https://karpathy.ai/](https://karpathy.ai/)
    -   X：[https://x.com/karpathy](https://x.com/karpathy)
    -   GitHub：[https://github.com/karpathy](https://github.com/karpathy)
-   **相关篇目**：DeepVideo(27)
-   **备注**：节目中多位听众推荐其 YouTube “Zero to Hero” 系列作为入门材料

### 李飞飞 Fei-Fei Li

-   **机构**：World Labs 联合创始人兼 CEO；斯坦福大学教授、以人为本 AI 研究院（HAI）联合院长
-   **链接**：
    -   X：[https://x.com/drfeifei](https://x.com/drfeifei)
    -   斯坦福主页：[https://profiles.stanford.edu/fei-fei-li](https://profiles.stanford.edu/fei-fei-li)
    -   LinkedIn：[https://www.linkedin.com/in/fei-fei-li-4541247/](https://www.linkedin.com/in/fei-fei-li-4541247/)
-   **相关篇目**：DeepVideo(27)
-   **备注**：ImageNet 的创造者 —— 也就是 AlexNet 得以成名的那个基准

### Richard S. Sutton（理查德·萨顿）

-   **机构**：阿尔伯塔大学计算科学教授；Amii 首席科学顾问；Keen Technologies（John Carmack）研究科学家；Oak Lab 创始人。**2024 年 ACM 图灵奖得主**（与 Andrew Barto 共同获奖，2025 年 3 月公布）
-   **链接**：
    -   个人主页：[http://incompleteideas.net/](http://incompleteideas.net/)
    -   简历：[http://incompleteideas.net/BriefBio.html](http://incompleteideas.net/BriefBio.html)
    -   Amii 页面：[https://www.amii.ca/people/richard-s-sutton](https://www.amii.ca/people/richard-s-sutton)
    -   X：**未查到本人认证账号**
-   **相关篇目**：The Bitter Lesson(12)

### David Silver

-   **机构**：AI 创业公司 Ineffable Intelligence CEO（据 2026 年报道从 DeepMind 离职创业）；伦敦大学学院（UCL）教授；2013–2026 在 DeepMind 领导强化学习研究
-   **链接**：
    -   Google Scholar：[https://scholar.google.com/citations?user=-8DNE4UAAAAJ](https://scholar.google.com/citations?user=-8DNE4UAAAAJ)
    -   Royal Society 页面：[https://royalsociety.org/people/david-silver-35033/](https://royalsociety.org/people/david-silver-35033/)
    -   X：**未查到本人认证账号**
-   **相关篇目**：AlphaGo Zero(7)

### Ian Goodfellow

-   **机构**：Google DeepMind 研究科学家（2022 年 7 月加入 Oriol Vinyals 的深度学习团队）；X 个人简介同时显示为一家 stealth 创业公司联合创始人。《Deep Learning》教科书第一作者
-   **链接**：
    -   X：[https://x.com/goodfellow\_ian](https://x.com/goodfellow_ian)
    -   教科书：[https://www.deeplearningbook.org/](https://www.deeplearningbook.org/)
-   **相关篇目**：GAN(29)

### Ian Buck

-   **机构**：NVIDIA 超大规模与 HPC 业务副总裁兼总经理；**CUDA 的创造者**（2004 年加入 NVIDIA）
-   **链接**：
    -   NVIDIA 博客作者页：[https://blogs.nvidia.com/blog/author/ian-buck](https://blogs.nvidia.com/blog/author/ian-buck)
    -   LinkedIn：[https://www.linkedin.com/in/ian-buck-19201315](https://www.linkedin.com/in/ian-buck-19201315)
-   **相关篇目**：Brook(1)
-   **备注**：Brook 是他在斯坦福的博士工作，直接演化成了 CUDA —— 整条 GPU 计算故事线的起点人物

### Ashish Vaswani

-   **机构**：Essential AI 联合创始人兼 CEO；此前 Adept AI 联合创始人、Google Brain 研究员
-   **链接**：Wikipedia：[https://en.wikipedia.org/wiki/Ashish\_Vaswani](https://en.wikipedia.org/wiki/Ashish_Vaswani)
-   **相关篇目**：Transformer(6)

### Jason Wei

-   **机构**：Meta Superintelligence Labs；此前 OpenAI（2023–2025，参与 o3、Deep Research）、Google Brain
-   **链接**：
    -   个人主页：[https://www.jasonwei.net/](https://www.jasonwei.net/)
    -   X：[https://x.com/\_jasonwei](https://x.com/_jasonwei)
    -   LinkedIn：[https://www.linkedin.com/in/jason-wei-5a7323b0/](https://www.linkedin.com/in/jason-wei-5a7323b0/)
-   **相关篇目**：CoT(9)

### 姚顺雨 Shunyu Yao

-   **机构**：曾任 OpenAI（2024 年 8 月加入，参与 Operator、Deep Research）；普林斯顿大学计算机博士、清华姚班本科
-   **链接**：
    -   个人主页：[https://ysymyth.github.io/](https://ysymyth.github.io/)
    -   GitHub：[https://github.com/ysymyth](https://github.com/ysymyth)
    -   ReAct 代码库：[https://github.com/ysymyth/ReAct](https://github.com/ysymyth/ReAct)
-   **相关篇目**：ReAct(11)
-   **备注**：还做了 WebShop、SWE-bench、tau-bench 等 Agent 评测环境

### Edward J. Hu

-   **机构**：OpenAI（2023 年起）；博士导师为 Yoshua Bengio（Mila），论文题为 *Building a Reasoning Machine*；LoRA 在微软期间完成
-   **链接**：
    -   个人主页：[https://edwardjhu.com/](https://edwardjhu.com/)
    -   X：[https://x.com/edwardjhu](https://x.com/edwardjhu)
    -   GitHub：[https://github.com/edwardjhu](https://github.com/edwardjhu)
-   **相关篇目**：LoRA(10)

### Nathan Lambert

-   **机构**：此前 Ai2（艾伦人工智能研究院）资深研究科学家、后训练负责人；现已离开 Ai2 创办 stealth AI lab；技术通讯 *Interconnects* 作者
-   **链接**：
    -   个人主页：[https://natolambert.com/](https://natolambert.com/)
    -   通讯：[https://www.interconnects.ai/](https://www.interconnects.ai/)
    -   X：[https://x.com/natolambert](https://x.com/natolambert)
    -   LinkedIn：[https://www.linkedin.com/in/natolambert/](https://www.linkedin.com/in/natolambert/)
-   **相关篇目**：Tulu 3(26)

### Jascha Sohl-Dickstein

-   **机构**：Anthropic 技术员（2024 年加入）；此前 Google Brain / Google DeepMind 首席科学家
-   **链接**：
    -   个人主页：[https://sohldickstein.com/](https://sohldickstein.com/)
    -   X：[https://x.com/jaschasd](https://x.com/jaschasd)
    -   Bluesky：[https://bsky.app/profile/jascha.sohldickstein.com](https://bsky.app/profile/jascha.sohldickstein.com)
    -   Google Scholar：[https://scholar.google.com/citations?user=-3zYIjQAAAAJ](https://scholar.google.com/citations?user=-3zYIjQAAAAJ)
-   **相关篇目**：Diffusion 原始论文(30)
-   **备注**：常被称为"Diffusion 模型的发明者"

### Jonathan Ho

-   **机构**：Ideogram 联合创始人（2022 年创立）；此前 Google Brain 研究科学家、UC Berkeley 博士（导师 Pieter Abbeel）
-   **链接**：Google Scholar：[https://scholar.google.com/citations?user=iVLAQysAAAAJ](https://scholar.google.com/citations?user=iVLAQysAAAAJ)
-   **相关篇目**：DDPM(31)

### Pieter Abbeel

-   **机构**：UC Berkeley 教授；Amazon Scholar，共同领导 Amazon Frontier AI & Robotics；Covariant、Gradescope 联合创始人
-   **链接**：Berkeley 教师页：[https://vcresearch.berkeley.edu/faculty/pieter-abbeel](https://vcresearch.berkeley.edu/faculty/pieter-abbeel)
-   **相关篇目**：DDPM(31)

### Robin Rombach

-   **机构**：Black Forest Labs（FLUX 系列）联合创始人兼 CEO；Stable Diffusion 第一作者，博士就读于慕尼黑大学 CompVis 组
-   **链接**：
    -   X：[https://x.com/robrombach](https://x.com/robrombach)
    -   GitHub：[https://github.com/rromb](https://github.com/rromb)
    -   Google Scholar：[https://scholar.google.com/citations?user=ygdQhrIAAAAJ](https://scholar.google.com/citations?user=ygdQhrIAAAAJ)
-   **相关篇目**：Stable Diffusion / LDM(34)

### Björn Ommer

-   **机构**：慕尼黑大学（LMU）计算机视觉与学习组（CompVis）负责人 —— Stable Diffusion 的诞生地
-   **链接**：实验室主页：[https://ommer-lab.com/](https://ommer-lab.com/) ｜ LDM 项目页：[https://ommer-lab.com/research/latent-diffusion-models/](https://ommer-lab.com/research/latent-diffusion-models/)
-   **相关篇目**：Stable Diffusion / LDM(34)

### 谢赛宁 Saining Xie

-   **机构**：纽约大学 Courant 研究所计算机科学助理教授；AMI Labs 联合创始人兼首席科学官；Google DeepMind 访问学者；此前 Meta FAIR 研究科学家
-   **链接**：
    -   个人主页：[https://www.sainingxie.com/](https://www.sainingxie.com/)
    -   X：[https://x.com/sainingxie](https://x.com/sainingxie)
    -   GitHub：[https://github.com/s9xie](https://github.com/s9xie)
    -   LinkedIn：[https://www.linkedin.com/in/sainxie/](https://www.linkedin.com/in/sainxie/)
-   **相关篇目**：DiT(35)

### William (Bill) Peebles

-   **机构**：DiT 一作，UC Berkeley 博士；后加入 OpenAI 领导 **Sora**；据 2026 年报道已从 OpenAI 离职
-   **链接**：
    -   个人主页：[https://www.wpeebles.com/](https://www.wpeebles.com/)
    -   X：[https://x.com/billpeeb](https://x.com/billpeeb)
    -   GitHub：[https://github.com/wpeebles](https://github.com/wpeebles)
    -   LinkedIn：[https://www.linkedin.com/in/bill-peebles-a980a212a/](https://www.linkedin.com/in/bill-peebles-a980a212a/)
-   **相关篇目**：DiT(35)

### Christoph Schuhmann

-   **机构**：LAION 组织负责人 / 创始人（无偿运营）；物理与计算机科学硕士，本职是中学教师
-   **链接**：LAION 团队页：[https://laion.ai/team/](https://laion.ai/team/)
-   **相关篇目**：LAION-5B(16)
-   **备注**：节目里"开源社区的英雄主义"讲的就是他 —— 一位老师牵头做出了 Stable Diffusion 的训练数据

### Tomáš Mikolov

-   **机构**：捷克信息学、机器人学与控制论研究所（CIIRC，布拉格）基础 AI 研究团队负责人；此前 Google Brain、Facebook AI Research
-   **链接**：
    -   CIIRC 报道页：[https://www.ciirc.cvut.cz/oceneni-neurips-test-of-time-award-pro-tomase-mikolova-a-jeho-tym-za-revolucni-vyzkum-jazykovych-modelu/](https://www.ciirc.cvut.cz/oceneni-neurips-test-of-time-award-pro-tomase-mikolova-a-jeho-tym-za-revolucni-vyzkum-jazykovych-modelu/)
    -   Wikipedia：[https://en.wikipedia.org/wiki/Tomáš\_Mikolov](https://en.wikipedia.org/wiki/Tom%C3%A1%C5%A1_Mikolov)
-   **相关篇目**：Word2Vec(19)

### Alexey Dosovitskiy

-   **机构**：Inceptive 技术员（2024 年起，做 RNA 的机器学习）；ELLIS Fellow；此前 Google Research
-   **链接**：ELLIS / EML Munich 页面：[https://www.eml-munich.de/people/alexey-dosovitskiy](https://www.eml-munich.de/people/alexey-dosovitskiy)
-   **相关篇目**：ViT(32)

### Jacob Devlin

-   **机构**：BERT 一作，长期在 Google AI Language；2023 年 1 月曾短暂加入 OpenAI 后回到 Google。**当前确切任职未查到权威来源**
-   **链接**：
    -   ACL Anthology：[https://aclanthology.org/people/jacob-devlin/](https://aclanthology.org/people/jacob-devlin/)
    -   DBLP：[https://dblp.org/pid/116/0575.html](https://dblp.org/pid/116/0575.html)
    -   X / 个人主页：**未查到**
-   **相关篇目**：BERT(22)

### Samyam Rajbhandari & Yuxiong He

-   **机构**：两人现均在 **Snowflake AI Research**（He 任 AI 研究负责人，Rajbhandari 负责推理优化）；此前在微软共同创建 DeepSpeed
-   **链接**：
    -   Rajbhandari（Snowflake 作者页）：[https://www.snowflake.com/en/blog/authors/samyam-rajbhandari/](https://www.snowflake.com/en/blog/authors/samyam-rajbhandari/)
    -   Yuxiong He（LinkedIn）：[https://www.linkedin.com/in/yuxiong-he-75432112/](https://www.linkedin.com/in/yuxiong-he-75432112/)
    -   DeepSpeed 项目：[https://www.deepspeed.ai/](https://www.deepspeed.ai/)
-   **相关篇目**：ZeRO(13)

### Andrew Zisserman

-   **机构**：牛津大学 VGG（Visual Geometry Group）教授；计算机视觉领域被引用最多的学者之一
-   **链接**：**未查到本人 X / 个人社交账号**（VGG 组主页：[https://www.robots.ox.ac.uk/~vgg/）](https://www.robots.ox.ac.uk/~vgg/%EF%BC%89)
-   **相关篇目**：双流网络(28)

---

### 其他被提及人物

下表补齐节目叙事、推荐和论文脉络中点名、但上文没有独立资料卡的人。为保证“提及即登记”，也保留少数不是 AI 研究者、但承担历史背景或类比作用的人物。

| 人物 | 节目中的身份或关联 |
| --- | --- |
| 扬·盖尔（Jan Gehl） | 丹麦城市设计与公共空间研究者；谢青池回忆互联网时代的阅读对象 |
| 吴恩达（Andrew Ng） | 机器学习与 AI 课程推荐 |
| 李宏毅（Hung-yi Lee） | 2025 生成式 AI 机器学习课程推荐 |
| 李沐（Mu Li） | 《动手学深度学习》作者、B 站论文精读；参数服务器研究者 |
| Grant Sanderson | 3Blue1Brown 创建者、Manim 作者；节目只说频道名，本索引补出人名 |
| 王木头 | “王木头学科学”创作者 |
| ZOMI酱 | GPU / AI Infra 课程创作者、昇腾工程背景；节目没有给真实姓名 |
| Pat Hanrahan | Brook 共同作者，斯坦福图形学教授；Ian Buck 的导师 |
| Alex Krizhevsky | AlexNet 一作，DNNresearch 创始团队成员 |
| 余凯 | ImageNet 竞赛、DNNresearch 拍卖和《深度学习革命》中文版序言的亲历者 |
| Yann LeCun（杨立昆） | 用于说明早期神经网络论文曾遭主流质疑 |
| Dzmitry Bahdanau | Bahdanau Attention 一作 |
| Kyunghyun Cho | Bahdanau Attention 共同作者 |
| 张祥雨 | ResNet 二作；阶跃星辰联合创始人、首席科学家；EP102 嘉宾 |
| 任少卿 | ResNet 三作；节目称其负责蔚来自动驾驶 |
| 孙剑 | ResNet 四作；旷视前首席科学家 |
| 苏剑林 | RoPE 相关工作作者；节目在 Transformer 位置编码处点名 |
| Noam Brown | o1 / test-time scaling 公开演讲者；扑克 AI 研究者 |
| 何俊贤 | 节目认为“DeepSeek 成本优先”的说法更可能来自他的论文解读 |
| Denny Zhou | Jason Wei 的研究导师；Gemini reasoning 负责人；Stanford CS25 演讲者 |
| Hyung Won Chung | *Don’t Teach. Incentivize.* 演讲者 |
| Stuart Russell | 1995 年经典 Agent 定义的共同提出者之一 |
| Peter Norvig | PPT 与 Russell 并列，1995 年经典 Agent 定义及 AIMA 教材共同作者 |
| Karthik Narasimhan | GPT-1 作者、姚顺雨博士导师 |
| Tim Salimans | GPT-1 作者 |
| 吴永辉（Yonghui Wu） | GNMT 一作；节目称其后负责 Gemini 后训练、字节 Seed 预训练 |
| 杨植麟 | The Bitter Lesson 段落中被引用，用于说明模型长期会学会人工搭建的路径与方法 |
| Long Ouyang（欧阳龙） | InstructGPT 一作 |
| John Schulman | InstructGPT / PPO 作者，OpenAI 强化学习研究者 |
| Jan Leike | InstructGPT 作者、对齐研究者 |
| Paul Christiano | InstructGPT 作者、对齐研究者 |
| Paul Allen | 微软联合创始人、Ai2 资助者 |
| Sam Altman | OpenAI LP 与 GPT 路线资源组织的相关人物；结尾还提到其发布会 |
| Elon Musk | 邀请 Karpathy 加入特斯拉的背景人物 |
| 吴新宙 | 中国纯视觉自动驾驶路线的相关人物 |
| Aaron Courville | *Deep Learning*（花书）共同作者 |
| Jakob Uszkoreit | Transformer 原始作者、ViT 顾问 |
| 潘佳怡 | 张小珺此前关于 DeepSeek-R1 与 Kimi k1.5 节目的嘉宾 |
| 黄仁勋 | NVIDIA 长期坚持 CUDA 路线的核心人物 |
| 约瑟夫·傅里叶（Joseph Fourier） | 用热传导方程与傅里叶变换解释“简单函数逼近复杂函数”的数学直觉 |
| 李世石 | AlphaGo 击败的人类棋手，用来对照 AlphaGo Zero |
| 理查德·费曼（Richard Feynman） | “费曼学习法”类比中出现 |
| 戈登·摩尔（Gordon Moore） | The Bitter Lesson 论证中的摩尔定律 |

---

# 提及的资料

本节收录节目音频、Shownotes、PPT 正文和阅读稿里哪怕只出现一次的教程、演讲、访谈、书、文章、延伸论文、技术报告、数据集、工具与项目。链接状态含义如下：

-   **已核实**：标题、人物或发布方能与节目描述对应；
-   **候选**：高度相关，但节目没有提供足够信息确认就是这一项；
-   **待确认**：目前不能唯一定位，不用相似结果强行填空。

## 视频教程

| 节目中的提及 | 整理结果 | 状态 |
| --- | --- | --- |
| 本期 PPT 投屏视频 | [B 站 BV1pkyqBxEdB](https://www.bilibili.com/video/BV1pkyqBxEdB/) | 已核实 |
| 吴恩达的机器学习课程、AI 课程 | [Andrew Ng 官方课程入口](https://www.andrewng.org/courses) | 已核实 |
| 李宏毅《生成式 AI 时代下的机器学习》2025 版 | [台大课程主页](https://speech.ee.ntu.edu.tw/~hylee/ml/2025-spring.php)；[李宏毅 YouTube](https://www.youtube.com/@HungyiLeeNTU) | 已核实 |
| Andrej Karpathy 的教学视频 | [YouTube 官方频道](https://www.youtube.com/@AndrejKarpathy) | 已核实 |
| 李沐论文精读系列 | [论文精读项目](https://github.com/mli/paper-reading)；[B 站个人空间](https://space.bilibili.com/1567748478) | 已核实 |
| 3Blue1Brown 的数学、神经网络与 Transformer 视频 | [YouTube 官方频道](https://www.youtube.com/@3blue1brown)；[神经网络第一讲](https://www.youtube.com/watch?v=aircAruvnKk)；[傅里叶变换可视化](https://www.youtube.com/watch?v=spUNpyF58BY)；[Transformer 注意力可视化](https://www.youtube.com/watch?v=eMlx5fFNoYc)；[B 站个人空间](https://space.bilibili.com/88461692)；[Manim](https://github.com/3b1b/manim) | 已核实 |
| 王木头学科学 | [B站个人空间](https://space.bilibili.com/504715181) | 已核实 |
| ZOMI酱的 GPU / GPU 网络教程 | [《【AI芯片】GPU原理》](https://www.bilibili.com/video/BV1bm4y1m7Ki/) | 已核实 |
| Stanford CS25 | [课程主页](https://web.stanford.edu/class/cs25/) | 已核实 |

## 演讲

| 人物 / 内容 | 原始材料 |
| --- | --- |
| Ilya 对 seq2seq 的十周年回顾，中文常称《预训练时代的终结》 | [*Sequence to Sequence Learning with Neural Networks: What a Decade*](https://www.youtube.com/watch?v=1yvBqasHLZs) |
| Noam Brown 讲 o1 与 test-time scaling | [Simons Institute：*Learning to Reason with LLMs*](https://simons.berkeley.edu/news/learning-reason-llms)；[视频](https://www.youtube.com/watch?v=Gr_eYXdHFis)；[讲义](https://live-simons-institute.pantheon.berkeley.edu/sites/default/files/2024-11/LLM24-1%20Slides%20-%20Noam%20Brown.pdf) |
| Hyung Won Chung：*Don’t Teach. Incentivize.* | [YouTube 视频](https://www.youtube.com/watch?v=kYWUEV_e2ss) |
| Denny Zhou 在 Stanford CS25 讲“大模型为什么有认知能力” | [*Large Language Model Reasoning*](https://www.youtube.com/watch?v=ebnX5Ur1hBk) |
| Edward Hu 亲自讲 LoRA | [What is Low-Rank Adaptation (LoRA)](https://www.youtube.com/watch?v=DhRoTONcyZE)；[作者主页的视频入口](https://edwardjhu.com/about/) |
| Ian Buck 2009 GTC 分享 | 节目与 PPT 使用其中一页 GPU/CPU FLOPS 图；NVIDIA 旧资料索引仍可从 [GTC 2010 讲义中的 GTC09 引用](https://www.nvidia.com/content/gtc-2010/pdfs/2011_gtc2010.pdf) 追溯 |
| Kimi k1.5 团队复盘 Noam Brown 与 Hyung Won Chung 两场分享 | [Kimi k1.5 官方论文仓库](https://github.com/MoonshotAI/Kimi-k1.5)；中文复盘可参见[智源整理](https://hub.baai.ac.cn/view/42869) |
| Jason Wei 的博客与公开视频 | [个人主页的 Papers / Talks & Media 索引](https://www.jasonwei.net/) |

## 访谈

| 节目 / 访谈 | 人物 | 备注 |
| --- | --- | --- |
| 《商业访谈录》EP102 | 张祥雨 | 节目口述推荐 |
| 《商业访谈录》EP108 | 余凯 | 节目口述推荐 |
| 《商业访谈录》EP115 | 姚顺雨 | 节目口述推荐 |
| 《商业访谈录》EP133 | 谢赛宁 | 节目口述推荐 |
| 《商业访谈录》EP89 | 潘佳怡 | 张小珺与潘佳怡关于 DeepSeek-R1 / Kimi k1.5 / OpenAI o1 的节目 |

## 书 / 文章

| 题名 / 描述 | 作者或来源 | 链接 / 状态 |
| --- | --- | --- |
| 《一站式 LLM 底层技术原理入门指南》 | 飞书社区发布者显示为“杨杨”，2024-11-11；公开页题名缩写为《一站式 LLM 底层技术原理》 | [飞书社区公开页](https://www.feishu.cn/community/article?id=7435855728784441348) |
| 《动手学深度学习》 | Aston Zhang、Zachary C. Lipton、李沐、Alex J. Smola | [中文官网](https://zh.d2l.ai/) / [英文官网](https://d2l.ai/) |
| 《深度学习的数学》 | 涌井良幸、涌井贞美著，杨瑞龙译；人民邮电出版社，2019；ISBN 978-7-115-50934-5 | [图书馆书目页](https://opac.sicau.edu.cn/opac/book/d6be057bc4f187b3a07112781b13e38c) |
| 《深度学习革命：从历史到未来》 | Cade Metz 著，桂曙光译；中信出版集团，2023；节目特别提到余凯为中文版作序 | [书目页](https://book.douban.com/subject/36171345/)；原作 *Genius Makers* |
| *Deep Learning*（“花书”） | Ian Goodfellow、Yoshua Bengio、Aaron Courville | [作者开放版官网](https://www.deeplearningbook.org/) |
| 扬·盖尔的城市规划论文和著作 | Jan Gehl | 节目只作总称，没有点出某一本，故不擅自缩成《交往与空间》或《人性化的城市》 |
| *Artificial Intelligence: A Modern Approach* 中的 Agent 定义 | Stuart Russell、Peter Norvig | [官方站点](https://aima.cs.berkeley.edu/)；节目只点名 Russell 与 1995 年定义 |
| *Interconnects* | Nathan Lambert | [通讯主页](https://www.interconnects.ai/) |
| Hugging Face 数据清洗与训练 Infra 长文系列 | Hugging Face 团队 | [FineWeb 数据构建长文](https://huggingface.co/spaces/HuggingFaceFW/blogpost-fineweb-v1)； [Ultra-Scale Playbook](https://huggingface.co/spaces/nanotron/ultrascale-playbook) |
| *The Bitter Lesson* | Richard S. Sutton | [原文](http://www.incompleteideas.net/IncIdeas/BitterLesson.html) |

## 延伸的论文

### 明确点名

| 材料 | 节目中的作用 | 原始入口 |
| --- | --- | --- |
| *The Hardware Lottery* | “没有选进 36 篇，但很值得读” | [arXiv:2009.06489](https://arxiv.org/abs/2009.06489) |
| *Bigtable: A Distributed Storage System for Structured Data* | 互联网时代 Google 的代表性基础设施论文 | [Google Research 存档](https://research.google.com/archive/bigtable.html) |
| *MapReduce: Simplified Data Processing on Large Clusters* | 与 Jeff Dean 和 Google Infra 脉络一起提到 | [Google Research](https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/) |
| *Scaling Distributed Machine Learning with the Parameter Server* | ZeRO 之前一代分布式训练系统，节目提到李沐参与参数服务器 | [USENIX OSDI 2014](https://www.usenix.org/conference/osdi14/technical-sessions/presentation/li_mu) |
| *ImageNet Large Scale Visual Recognition Challenge* | 补充 ImageNet / ILSVRC 的数据集和竞赛背景 | [arXiv:1409.0575](https://arxiv.org/abs/1409.0575) |
| *Proximal Policy Optimization Algorithms*（PPO） | “这次没讲到、公式和推导很难”的强化学习论文 | [arXiv:1707.06347](https://arxiv.org/abs/1707.06347) |
| *Direct Preference Optimization: Your Language Model is Secretly a Reward Model*（DPO） | Tulu 3 后训练流程中点名的方法 | [arXiv:2305.18290](https://arxiv.org/abs/2305.18290) |
| *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* | PPT 在姚顺雨人物介绍中明确写“SWE-bench 的作者” | [arXiv:2310.06770](https://arxiv.org/abs/2310.06770) |
| *GLIDE: Towards Photorealistic Image Generation and Editing with Text-Guided Diffusion Models* | CLIP 与 Latent Diffusion 之间的文生图路线 | [arXiv:2112.10741](https://arxiv.org/abs/2112.10741) |

### 技术报告和官方发布

| 材料 | 原始入口 | 说明 |
| --- | --- | --- |
| Llama 4 技术报告 | [Meta 官方发布](https://ai.meta.com/blog/llama-4-multimodal-intelligence/) / [arXiv:2504.21789](https://arxiv.org/abs/2504.21789) | 节目以训练中断记录说明大规模训练的工程难度 |
| DeepSeek-V3 Technical Report | [arXiv:2412.19437](https://arxiv.org/abs/2412.19437) | 用 H800、通信计算重叠与平滑 loss 曲线说明 algorithm-system co-design |
| DeepSeek-R1 | [arXiv:2501.12948](https://arxiv.org/abs/2501.12948) | 节目同时提到 R1-Zero |
| Kimi k1.5 | [arXiv:2501.12599](https://arxiv.org/abs/2501.12599) / [官方仓库](https://github.com/MoonshotAI/Kimi-k1.5) | 节目用于解释对 o1 公开线索的逆向研究 |
| DeepSeek Sparse Attention / DeepSeek-V3.2-Exp | [DeepSeek 官方说明](https://api-docs.deepseek.com/news/news250929) / [Hugging Face 模型页](https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Exp) | 节目在结尾用于说明长上下文与推理成本的未来变化 |
| OpenAI o1：*Learning to Reason with LLMs* | [OpenAI 官方说明](https://openai.com/index/learning-to-reason-with-llms/) | 与 Noam Brown、Hyung Won Chung 两场公开分享一起出现 |
| Sora / Sora 2 | [Sora 2 官方发布](https://openai.com/index/sora-2/) | 节目讨论 DiT 影响和新的视频产品形态；不是 36 篇主线论文 |
| DALL·E | [OpenAI 官方发布](https://openai.com/index/dall-e/) | 节目以第一代 DALL·E 说明自回归图像生成路线 |

### 数据集、工具与项目入口

这些不是独立论文，但在节目论证中承担了资料角色，因此一并保留：

-   [ImageNet](https://www.image-net.org/) / [WordNet](https://wordnet.princeton.edu/)
-   [Sports-1M 数据集说明（DeepVideo 论文）](https://cs.stanford.edu/people/karpathy/deepvideo/)
-   [Common Crawl](https://commoncrawl.org/)；GPT-3 的重要训练数据来源
-   BooksCorpus、WebText：节目说明 GPT-1 / GPT-2 的数据规模变化；原始数据的公开可用性和  
    授权状态复杂，这里只记录名称，不提供来路不明的下载镜像
-   [LAION](https://laion.ai/)；LAION-5B 的组织与项目入口
-   [DeepSpeed](https://www.deepspeed.ai/)；ZeRO 的工程实现
-   [LangChain](https://github.com/langchain-ai/langchain) / [LangGraph](https://github.com/langchain-ai/langgraph)；PPT 在 ReAct 页点名的 Agent 工程抽象
-   [沉浸式翻译](https://immersivetranslate.com/)；节目推荐的论文与视频字幕翻译工具
-   [Claude Artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) 原理可视化工具

---

*本索引所有论文日期与链接均通过 arXiv API、官方论文页、期刊页面实际查证；人物信息通过公开搜索结果核对。*