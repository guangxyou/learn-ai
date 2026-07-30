# 校订记录

> 记录从 ASR 原稿到阅读稿的所有实质性改动。  
> 目的：改动可追溯、可复核 —— 尤其是人名和技术术语，改错了比不改更糟。

## 原则

1.  **只改错，不改意**。删口语赘词、合并短句成段，但不增删观点、不替作者润色论证
2.  **人名与专名以查证为准**，依据是并行整理的 [`03-资料索引.md`](04-%E8%B5%84%E6%96%99%E7%B4%A2%E5%BC%95.md)
3.  **拿不准的不硬改** —— 宁可标注存疑，也不写一个看起来通顺但可能错的名字
4.  说话人以上下文重新判定（见下方「说话人」一节说明）

---

## 人名（ASR 错误 → 订正）

| 原稿 | 订正 | 依据 |
| --- | --- | --- |
| 吴文达 | **吴恩达**（Andrew Ng） | 机器学习课程作者，音近误识 |
| android passy | **Andrej Karpathy** | 上下文为「YouTube 账号、视频质量很高」，即 Karpathy 的教学频道 |
| 李牧 | **李沐**（Mu Li） | 《动手学深度学习》作者 + B 站论文精读系列，音同字误 |
| three blue one brown | **3Blue1Brown** | 数学可视化频道，manim 开源库作者 |
| 周敏 / 周米 | **ZOMI酱** | 原文描述「华为昇腾工程师、高产、讲 GPU 与 GPU 网络」，已查证吻合 |
| 杨盖尔 | **扬·盖尔**（Jan Gehl） | 丹麦城市规划学者，与「豆瓣阿尔法城/城市规划论文」上下文吻合 |
| 伊利亚 | **Ilya Sutskever** | AlexNet 共同作者；正文按中文语境保留「Ilya」 |
| 杨立昆 | 保留 | Yann LeCun 的通行中文译名，原稿正确 |
| 李宏毅 | 保留 | 原稿正确 |

## 专名与术语

| 原稿 | 订正 | 说明 |
| --- | --- | --- |
| big lesson | **The Bitter Lesson** | Rich Sutton 的著名短文，全稿统一 |
| alice net | **AlexNet** | 热词表已含 AlexNet，此处仍漏识 |
| 鲜艳知识 | **先验知识** | 同音误识 |
| GP 来的时候 | **GPT 来的时候** | 指 2022 年 ChatGPT |
| O to O | **O2O** |  |
| big table，hadoop | **BigTable、Hadoop** | Google 论文 |
| cloud / artifacts | **Claude / Artifacts** |  |
| 拍 touch / 拍 Torch | **PyTorch** |  |
| 升腾 | **昇腾** | 华为 NPU 产品线 |
| 关键内部 | **光年内部** | 指光年之外，公司名 |
| 语言及世界 | **语言即世界** | 张小珺工作室名，已查证 |
| 修 notes | **shownotes** |  |
| 深度文艺神经网络 | **深度神经网络** |  |
| 眼看不妙下去 | **眼看办不下去** |  |
| 不同意的意义 | **不同的意义** |  |
| INFRA | **Infra** | 统一大小写 |
| FOLLOW | **跟进** | 中文语境下改为中文 |

## PPT 交叉验证（2026-07-28）

拿到嘉宾原始 PPT（《AI演义：36篇论文开启你的探索之旅》，51 页）后，用它复核了此前凭上下文做的人名订正，**全部吻合**：

| 我的订正 | PPT 原文 | 结果 |
| --- | --- | --- |
| 吴文达 → 吴恩达 | 「吴恩达的机器学习/AI课程」 | ✅ |
| android passy → Andrej Karpathy | 「Andrej Karpathy的YouTube」 | ✅ |
| 李牧 → 李沐 | 「B站：李沐论文精读系列」 | ✅ |
| three blue one brown → 3Blue1Brown | 「B站：3Blue1Brown的数学与神经网络」 | ✅ |
| 李宏毅（未改） | 「李宏毅：生成式AI时代下的机器学习(2025)」 | ✅ |

**PPT 现已成为后续精校的第一依据** —— 它是嘉宾亲手写的，比 ASR 和我的推断都可靠。存放于 `ppt/`，提取文本见 `work/ppt-clean.txt`（51 页，含各页标题与要点）。

> 提取时的坑：PDF 做了字体子集化，`pdftotext -layout` 会把部分汉字打散成单字行（「36篇论\\n文\\n开启…」）。改用 `-raw` 模式后按「单字独占一行则接回上一行」重组即可。

## 说话人

ASR 的说话人分离在这期**失败了**：4 小时 22 分超出官方对 diarization 的 2 小时建议一倍，结果 S0 占 96.8%、S1 仅 3.2% —— 主播的提问大部分被并进了嘉宾。

阅读稿的说话人由**上下文重新判定**，判据：

-   提问、转场、“你……吗？” 句式 → 张小珺
-   讲解、举例、“我们可以看一下” → 谢青池
-   ASR 正确识别出的 S1 片段（如开场白「我是小珺」）作为锚点校准

这期是嘉宾主讲 36 篇论文的讲座式对话，嘉宾本来就占绝大部分篇幅，但真实比例应在 85:15 左右，而非 ASR 给出的 96.8:3.2。

## 口语处理

统一删除：嗯、啊、呃、这个、那个（语气词用法）、重复词（“你会发现你会发现”）、“就是说”（冗余用法）。保留：确实、其实、本质上 —— 这些承担语义，删了会失真。

长句按语义切分并合并为段落，不再逐句分行。

## 第二批（00:46–01:00）新增订正

| 原稿 | 订正 | 依据 |
| --- | --- | --- |
| Jeff Ding | **Jeff Dean** | Google Fellow、MapReduce/TensorFlow、Google Brain 创始人之一，上下文完全吻合 |
| 翔宇 | **张祥雨** | ResNet 二作；节目里说"上过咱们的节目"，且现任阶跃星辰联合创始人兼首席科学家 |
| 节约形成的口方德和首席科学家 | **阶跃星辰的联合创始人兼首席科学家** | 音近严重错乱，按张祥雨实际任职订正 |
| 孙健 | **孙剑** | ResNet 四作，旷视首席科学家，2022 年去世 |
| 旷世 | **旷视** | 公司名 |
| 未来自动驾驶 | **蔚来自动驾驶** | 任少卿现任蔚来自动驾驶负责人 |
| 微软亚音院 | **微软亚洲研究院**（MSRA） | ResNet 四位作者当时所在机构 |
| restnet / rest net | **ResNet** |  |
| 长差网络 / 产生网络 | **残差网络** |  |
| three bro three blue one bro | **3Blue1Brown** | 讲傅里叶变换的可视化频道 |
| mapreduce | **MapReduce** |  |
| 普通公司 | **不同公司** |  |
| RELU | **ReLU** |  |
| FS | **F(x)** | 残差公式 |
| RN | **RNN** |  |
| CPU GPU 处理 | **GPU 处理** | 上下文是 RNN 不适合 GPU |
| UNet三位 | **（删）** | ASR 把「这篇（ResNet）」误识成 UNet，与上下文无关 |

**新增收录**：The Hardware Lottery（硬件彩票）——嘉宾明确说"这篇我没有选进来，但很值得读"，  
属于主线 36 篇之外的顺带推荐，已交由补遗索引收录。

## Codex 续校（00:46–04:22）

`02-阅读稿.md` 保留 Claude 的原始进度；后续工作全部写入复制得到的  
`02-阅读稿-Codex.md`。Codex 逐段完成 Part 1 余下内容、Part 2–4 与结尾聊天，最后时间戳为 04:22:21。

### 主要人名与术语订正

| 原稿或容易误写的形式 | 阅读稿写法 | 核对依据 |
| --- | --- | --- |
| SAM 后座 / Sama 之类音写 | **Sam Altman** | OpenAI 组织史上下文 |
| 永辉 | **吴永辉（Yonghui Wu）** | GNMT 一作 |
| 江苏曼 | **John Schulman** | PPO、InstructGPT 作者 |
| 欧阳龙 | **Long Ouyang（欧阳龙）** | InstructGPT 一作 |
| 艾伦研究所 | **艾伦人工智能研究所（Ai2）** | Tulu 3 发布机构 |
| 卡伦 / 凯伦 | **Karén Simonyan** | 双流网络、AlphaGo Zero 作者 |
| 手死赛宁 | **谢赛宁（Saining Xie）** | DiT 作者 |
| LAION / RefinedWeb / MegaScale | 统一按论文正式拼写 | PPT 题名与论文原文 |
| 零、zero | **ZeRO** | *Zero Redundancy Optimizer* 的正式大小写 |
| scaling low | **Scaling Law** |  |
| Ginger / chinchilla 音写 | **Chinchilla** | *Training Compute-Optimal Large Language Models* |
| Deep Video | **DeepVideo** | 节目分章称呼 |
| 钢 / 刚 | **GAN** | *Generative Adversarial Nets* |
| latent diffusion / dit | **Latent Diffusion / DiT** |  |
| 《深度学习中的数学》 | **《深度学习的数学》** | 音频听感有“中”，但嘉宾 PPT 第 5 页题名明确写“的” |
| MFU | **Model FLOPs Utilization** | MegaScale 上下文 |
| PPT / RL / 后训练相关缩写 | **SFT、RLHF、PPO、DPO、RLVR、test-time scaling** | 论文与公开演讲 |

### 资料性表述的二次修正

1.  音频在 00:12 左右只能听出“某个 AI 浏览器”，没有足够证据确认是 Dia；Codex 版删去产品名，保留功能描述。
2.  “DNNresearch 成了 Google Brain 的前身”因组织沿革过度简化，改为“被 Google 收购、并入 Google 的深度学习研究体系”。
3.  Ilya 的 seq2seq 十周年公开视频正式标题是 *Sequence to Sequence Learning with Neural Networks: What a Decade*；《预训练时代的终结》是中文互联网上的概括性称呼，不再写成官方片名。
4.  论文文件不能只按 PPT 右上角链接下载：本轮发现 PPT 漏掉 Attention 与 AlphaGo Zero 的论文入口，Tulu 3 的链接还误指 `arXiv:2407.15541`。正确 Tulu 3 为 `arXiv:2411.15124`。