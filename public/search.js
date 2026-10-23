/* learn-ai · 全站搜索
 *
 * 一个文件管三件事：
 *   1. 搜索页（/search/）：取索引、匹配、按「条目 › tab」分组列结果
 *   2. 详情页：从结果点进来（?q=…&at=…）时切到对应 tab、展开讲次 / 批注 / 参考文献、
 *      高亮关键词，底部给一条「上一处 / 下一处」
 *   3. 任何页面按 / 或 ⌘K 去搜索
 * 详情页是不同工具生成的，这里只认它们共有的几样东西：.tb[data-v] ↔ #view-*、
 * .tab[data-tab] ↔ #pane-*、<details>、批注卡片 .nt 和它在正文里的 mark[data-n]。 */
(function () {
  'use strict';

  var SCRIPT = document.currentScript;
  var BASE = SCRIPT ? SCRIPT.src.replace(/^https?:\/\/[^/]+/, '').replace(/\/assets\/search\.js.*$/, '') : '/learn-ai';
  var NAV_KEY = 'la-sx-nav';
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  /* ---------- 中英对照：论文原文是英文，笔记和批注是中文 ----------
     查询词和其中一项完全一样（带 * 的是词干，前缀对上就算），整组一起搜。
     只收两边写法都常见的术语，宁缺毋滥 —— 搜「层归一化」不会顺带搜出 batch normalization */
  var SYN = [
    ['正则化', '正则', 'regulariz*'], ['过拟合', 'overfit*'], ['欠拟合', 'underfit*'], ['泛化', 'generaliz*'],
    ['注意力', 'attention'], ['自注意力', 'self-attention'], ['多头注意力', 'multi-head attention'],
    ['位置编码', 'positional encoding', 'position embedding'], ['残差', 'residual'], ['捷径', 'shortcut'],
    ['归一化', 'normaliz*'], ['批归一化', 'batch normalization', 'batchnorm', 'batch norm'],
    ['层归一化', 'layer normalization', 'layernorm', 'layer norm'],
    ['权重衰减', 'weight decay'], ['学习率', 'learning rate'], ['优化器', 'optimizer'], ['梯度下降', 'gradient descent'],
    ['反向传播', 'backpropagation', 'back-propagation'], ['梯度', 'gradient'], ['动量', 'momentum'],
    ['卷积', 'convolution*'], ['池化', 'pooling'], ['激活函数', 'activation function'], ['嵌入', 'embedding'],
    ['微调', 'fine-tun*', 'finetun*'], ['预训练', 'pre-train*', 'pretrain*'], ['零样本', 'zero-shot'], ['少样本', 'few-shot'],
    ['上下文学习', 'in-context learning'], ['强化学习', 'reinforcement learning'], ['奖励模型', 'reward model'],
    ['人类反馈', 'human feedback'], ['损失函数', 'loss function'], ['交叉熵', 'cross-entropy', 'cross entropy'],
    ['数据增强', 'data augmentation'], ['编码器', 'encoder'], ['解码器', 'decoder'], ['困惑度', 'perplexity'],
    ['标签平滑', 'label smoothing'], ['缩放定律', 'scaling law'], ['集成', 'ensembl*'], ['蒸馏', 'distill*'],
    ['分词', 'tokeniz*'], ['词表', 'vocabulary'], ['采样', 'sampling'], ['温度', 'temperature'],
    ['退化', 'degradation'], ['瓶颈', 'bottleneck'], ['感受野', 'receptive field'],
    ['线性变换', 'linear transformation'], ['特征值', 'eigenvalue'], ['特征向量', 'eigenvector'], ['行列式', 'determinant'],
  ];

  /* 查询 → 词组：每个词一组候选写法，组内任一命中、组间全部命中才算 */
  function plan(q, exact) {
    var seen = {}, groups = [], extra = [];
    q.toLowerCase().split(/\s+/).forEach(function (w) {
      if (!w || seen[w]) return;
      seen[w] = 1;
      var alts = [w];
      if (!exact) SYN.forEach(function (g) {
        var hit = g.some(function (m) {
          return m.slice(-1) === '*' ? w.indexOf(m.slice(0, -1)) === 0 : w === m;
        });
        if (hit) g.forEach(function (m) {
          var a = m.replace(/\*$/, '');
          if (alts.indexOf(a) < 0) { alts.push(a); extra.push(m.replace(/\*$/, '…')); }
        });
      });
      groups.push(alts);
    });
    return { groups: groups, extra: extra };
  }

  /* 英文词要从词首开始对：搜 PPO 不该命中 support，搜 regulariz 照样命中 regularization。
     中文没有词边界，照常按子串对 */
  var WORD = /[a-z0-9]/i;
  function at(t, a, from) {
    var i = t.indexOf(a, from || 0);
    if (!WORD.test(a[0])) return i;
    while (i > 0 && WORD.test(t[i - 1])) i = t.indexOf(a, i + 1);
    return i;
  }
  function has(t, a) { return at(t, a) >= 0; }
  function matches(t, groups) {
    for (var g = 0; g < groups.length; g++) {
      var alts = groups[g], any = false;
      for (var k = 0; k < alts.length; k++) if (has(t, alts[k])) { any = true; break; }
      if (!any) return false;
    }
    return true;
  }
  /* 把命中词包起来；跳过词中间的假命中。wrap 拿到原文片段，返回替换后的串 */
  function hilite(s, re, wrap) {
    return s.replace(new RegExp(re.source, 'gi'), function (m, w, i, all) {
      // 词中间的假命中、HTML 实体（&amp; 里的 amp）都不包
      return WORD.test(m[0]) && i > 0 && (WORD.test(all[i - 1]) || all[i - 1] === '&' || all[i - 1] === '#') ? m : wrap(m);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function reOf(groups) {
    var all = [].concat.apply([], groups).sort(function (a, b) { return b.length - a.length; });
    return new RegExp('(' + all.map(function (a) { return a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'gi');
  }

  /* ================================================================
     1. 搜索页
     ================================================================ */
  function searchPage(app) {
    var input = document.getElementById('sx-q');
    var status = document.getElementById('sx-status');
    var filters = document.getElementById('sx-filters');
    var results = document.getElementById('sx-results');
    var tip = document.getElementById('sx-tip');
    var params = new URLSearchParams(location.search);
    var state = { q: params.get('q') || '', exact: params.get('exact') === '1', e: params.get('e') || '', k: params.get('k') || '' };
    var IX = null, lower = null, loading = null;
    input.value = state.q;

    function load() {
      if (loading) return loading;
      status.textContent = '正在载入索引…';
      loading = fetch(app.dataset.index).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).then(function (ix) {
        IX = ix;
        lower = ix.items.map(function (it) { return (it[5] + (it[6] ? ' ' + it[6] : '')).toLowerCase(); });
        status.textContent = '';
      }).catch(function () {
        loading = null;
        status.textContent = '索引没载入成功，刷新再试一次。';
      });
      return loading;
    }

    function sync() {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.exact) p.set('exact', '1');
      if (state.e) p.set('e', state.e);
      if (state.k) p.set('k', state.k);
      var s = p.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
      document.title = (state.q ? state.q + ' · ' : '') + '搜索 · learn-ai';
    }

    /* 摘一段：从第一处命中往前留一点上下文，命中词全部标出来 */
    function snippet(text, re, groups) {
      var first = -1;
      [].concat.apply([], groups).forEach(function (a) {
        var i = at(text.toLowerCase(), a);
        if (i >= 0 && (first < 0 || i < first)) first = i;
      });
      var at0 = Math.max(0, first);
      var ascii = /^[\x00-\x7f]*$/.test(text.slice(0, 200));
      var span = ascii ? 220 : 120, lead = ascii ? 70 : 34;
      var a = Math.max(0, at0 - lead), b = Math.min(text.length, a + span);
      if (b - a < span) a = Math.max(0, b - span);
      return (a > 0 ? '…' : '') + hilite(esc(text.slice(a, b)), re, function (m) { return '<mark>' + m + '</mark>'; })
        + (b < text.length ? '…' : '');
    }

    function run() {
      sync();
      tip.hidden = !!state.q;
      if (!state.q.trim()) { status.textContent = ''; filters.innerHTML = ''; results.innerHTML = ''; return; }
      if (!IX) { load().then(function () { if (IX) run(); }); return; }

      var P = plan(state.q, state.exact), groups = P.groups, re = reOf(groups);
      var hits = [];
      for (var i = 0; i < lower.length; i++) if (matches(lower[i], groups)) hits.push(i);

      // 筛选条：按条目、按类型计数（计数不受另一个筛选影响，切来切去数字不跳）
      var byE = {}, byK = {};
      hits.forEach(function (i) {
        var it = IX.items[i], kind = IX.strs[it[3]];
        if (!state.k || kind === state.k) byE[it[0]] = (byE[it[0]] || 0) + 1;
        if (!state.e || IX.entries[it[0]].id === state.e) byK[kind] = (byK[kind] || 0) + 1;
      });
      var shown = hits.filter(function (i) {
        var it = IX.items[i];
        return (!state.e || IX.entries[it[0]].id === state.e) && (!state.k || IX.strs[it[3]] === state.k);
      });

      var ext = P.extra.length
        ? '　同时搜了 <span class="sx-alt">' + esc(P.extra.join(' / ')) + '</span>　<button type="button" class="sx-link-btn" data-exact="1">只搜原词</button>'
        : state.exact ? '　<button type="button" class="sx-link-btn" data-exact="0">也搜英文写法</button>' : '';
      status.innerHTML = hits.length
        ? '<b>' + hits.length + '</b> 处，分布在 <b>' + Object.keys(byE).length + '</b> 个条目' + ext
        : '没有找到「' + esc(state.q) + '」。换个说法试试，或者少打几个字。' + ext;

      var chip = function (attr, val, label, n, on) {
        return '<button type="button" class="sx-chip" ' + attr + '="' + esc(val) + '" aria-pressed="' + on + '">'
          + esc(label) + (n != null ? '<span>' + n + '</span>' : '') + '</button>';
      };
      var KORDER = ['批注', '原文', '正文', '标题', '讲次', '截图', '文稿', '思考题', '表格', '图注', '论文', '人物', '参考文献'];
      filters.innerHTML = hits.length ? '<div class="sx-frow">'
        + chip('data-e', '', '全部条目', null, !state.e)
        + IX.entries.map(function (e, ei) { return byE[ei] ? chip('data-e', e.id, e.title, byE[ei], state.e === e.id) : ''; }).join('')
        + '</div><div class="sx-frow">'
        + chip('data-k', '', '全部类型', null, !state.k)
        + Object.keys(byK).sort(function (a, b) { return KORDER.indexOf(a) - KORDER.indexOf(b); })
          .map(function (k) { return chip('data-k', k, k, byK[k], state.k === k); }).join('')
        + '</div>' : '';

      // 标题里就有这个词的：小节标题、讲次、批注题目 —— 最可能是要找的那一处，单独列在最前面
      var top = shown.filter(function (i) {
        var it = IX.items[i], k = IX.strs[it[3]];
        var head = k === '标题' ? it[5] : k === '讲次' || k === '批注' ? it[6] || '' : '';
        if (!head) return false;
        return matches(head.toLowerCase(), groups);
      }).slice(0, 16);

      // 分组：条目（命中多的在前）› tab（页面上的顺序）› 块（页面上的顺序）
      var ents = {};
      shown.forEach(function (i) {
        var it = IX.items[i], e = ents[it[0]] || (ents[it[0]] = { ei: it[0], n: 0, tabs: [], byTab: {} });
        e.n++;
        var tk = it[1];
        if (!e.byTab[tk]) { e.byTab[tk] = []; e.tabs.push(tk); }
        e.byTab[tk].push(i);
      });
      var order = Object.keys(ents).map(function (k) { return ents[k]; }).sort(function (a, b) { return b.n - a.n || a.ei - b.ei; });

      var html = '';
      if (top.length) {
        html += '<section class="sx-top"><h2>标题里出现的</h2><div class="sx-toplist">' + top.map(function (i) {
          var it = IX.items[i], e = IX.entries[it[0]], k = IX.strs[it[3]], tab = IX.strs[it[1]];
          var head = k === '标题' ? it[5] : it[6];
          return '<a class="sx-tl" href="' + hrefOf(it) + '" data-i="' + i + '"><span class="sx-k" data-k="' + esc(k) + '">' + esc(k) + '</span>'
            + '<b>' + hilite(esc(head), re, function (m) { return '<mark>' + m + '</mark>'; }) + '</b>'
            + '<small>' + esc(e.title) + (tab ? ' › ' + esc(tab) : '') + '</small></a>';
        }).join('') + '</div></section>';
      }
      var LIMIT = 4;
      order.forEach(function (g) {
        var e = IX.entries[g.ei];
        html += '<section class="sx-entry"><h2><a href="' + BASE + '/' + e.id + '/">' + esc(e.title) + '</a>'
          + '<em>' + esc(e.subtitle) + '</em><span class="sx-n">' + g.n + ' 处</span></h2>';
        g.tabs.forEach(function (tk) {
          var list = g.byTab[tk], tab = IX.strs[tk];
          html += '<div class="sx-tab">' + (tab ? '<h3>' + esc(tab) + '<span>' + list.length + '</span></h3>' : '');
          list.forEach(function (i, n) {
            var it = IX.items[i], k = IX.strs[it[3]], crumb = IX.strs[it[2]];
            html += '<a class="sx-hit' + (n >= LIMIT && list.length > LIMIT + 1 ? ' sx-more' : '') + '" href="' + hrefOf(it) + '" data-i="' + i + '">'
              + '<div class="sx-path"><span class="sx-k" data-k="' + esc(k) + '">' + esc(k + (it[7] ? ' · ' + it[7] : '')) + '</span>'
              + (crumb ? '<span class="sx-crumb">' + esc(crumb) + '</span>' : '') + '</div>'
              + (it[6] ? '<div class="sx-title">' + snippet(it[6], re, groups) + '</div>' : '')
              + '<div class="sx-snip">' + snippet(it[5], re, groups) + '</div></a>';
          });
          if (list.length > LIMIT + 1) html += '<button type="button" class="sx-expand">再显示 ' + (list.length - LIMIT) + ' 处</button>';
          html += '</div>';
        });
        html += '</section>';
      });
      results.innerHTML = html;
    }

    function hrefOf(it) {
      var p = new URLSearchParams({ q: state.q, at: it[4] });
      if (state.exact) p.set('exact', '1');
      return BASE + '/' + IX.entries[it[0]].id + '/?' + p.toString();
    }

    // 点进结果之前，把同一条目里的全部命中记下来，到了页面上能「下一处」
    results.addEventListener('click', function (ev) {
      var x = ev.target.closest('.sx-expand');
      if (x) { x.parentElement.classList.add('open'); x.remove(); return; }
      var a = ev.target.closest('a[data-i]');
      if (!a || !IX) return;
      var it = IX.items[+a.dataset.i], ei = it[0], P = plan(state.q, state.exact);
      var ids = [];
      for (var i = 0; i < lower.length; i++) {
        if (IX.items[i][0] !== ei) continue;
        if (state.k && IX.strs[IX.items[i][3]] !== state.k) continue;
        if (matches(lower[i], P.groups)) ids.push(IX.items[i][4]);
      }
      store.set(NAV_KEY, { q: state.q, exact: state.exact, e: IX.entries[ei].id, ids: ids, back: location.pathname + location.search });
    });
    filters.addEventListener('click', function (ev) {
      var b = ev.target.closest('.sx-chip');
      if (!b) return;
      if (b.hasAttribute('data-e')) state.e = b.getAttribute('data-e');
      if (b.hasAttribute('data-k')) state.k = b.getAttribute('data-k');
      run();
    });
    status.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-exact]');
      if (b) { state.exact = b.dataset.exact === '1'; run(); }
    });

    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = input.value.trim(); state.e = state.k = ''; run(); }, 140);
    });
    input.form.addEventListener('submit', function (ev) {
      ev.preventDefault(); clearTimeout(timer);
      state.q = input.value.trim(); run(); input.blur();
    });
    input.addEventListener('focus', load, { once: true });
    if (state.q) run(); else load();
  }

  /* ================================================================
     2. 详情页：从搜索结果落地
     ================================================================ */
  function landing() {
    var params = new URLSearchParams(location.search);
    var q = params.get('q'), at = params.get('at');
    if (!q || !at) return;
    var groups = plan(q, params.get('exact') === '1').groups, re = reOf(groups);
    var entry = location.pathname.replace(BASE, '').split('/')[1];
    var nav = store.get(NAV_KEY);
    var ids = nav && nav.e === entry && nav.q === q && nav.ids.indexOf(at) >= 0 ? nav.ids : [at];
    var cur = ids.indexOf(at), userMoved = false, bar = null;

    function show(el) {
      // 手机上上一处批注的抽屉还开着，先关掉
      var sheet = document.querySelector('.sheet.on .sheet-x');
      if (sheet) sheet.click();
      // 切 tab
      var v = el.closest('[id^="view-"]'), tb = null;
      if (v) tb = document.querySelector('.tb[data-v="' + v.id.slice(5) + '"]');
      else if (!el.closest('.view,.paperview,.docview,.mapview,.resview')) tb = document.querySelector('.tb[data-v="paper"]');
      if (tb && !tb.classList.contains('on')) tb.click();
      var pane = el.closest('.pane[id^="pane-"]');
      if (pane) {
        var t = document.querySelector('.tab[data-tab="' + pane.id.slice(5) + '"]');
        if (t && t.getAttribute('aria-selected') !== 'true') t.click();
      }
      // 展开所有包着它的折叠块：讲次、思考题、参考文献、附录
      for (var d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
      if (el.matches('.paper[data-n]')) el.classList.add('open');   // ep117 资料里的论文行
      // 批注：桌面上卡片在侧栏，展开它；手机上卡片是藏着的，滚到正文里的高亮再点开抽屉
      var target = el;
      if (el.matches('.nt')) {
        var mk = document.querySelector('mark[data-n="' + el.dataset.n + '"]');
        if (!el.offsetParent && mk) { target = mk; setTimeout(function () { mk.click(); }, 350); }
        else if (!el.classList.contains('open')) { var qb = el.querySelector('.nt-q'); if (qb) qb.click(); }
      }
      return target;
    }

    function mark(el) {
      if (el.dataset.sxDone) return;
      el.dataset.sxDone = '1';
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          return n.parentElement.closest('svg,math,script,style,.sx-hl') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        },
      });
      var nodes = [];
      for (var n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
      nodes.forEach(function (node) {
        var s = node.nodeValue, r = new RegExp(re.source, 'gi'), m, last = 0, frag = null;
        while ((m = r.exec(s))) {
          if (WORD.test(m[0][0]) && m.index > 0 && WORD.test(s[m.index - 1])) continue;   // 词中间的假命中
          frag = frag || document.createDocumentFragment();
          frag.appendChild(document.createTextNode(s.slice(last, m.index)));
          var span = document.createElement('span');
          span.className = 'sx-hl'; span.textContent = m[0];
          frag.appendChild(span);
          last = m.index + m[0].length;
        }
        if (!frag) return;
        frag.appendChild(document.createTextNode(s.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    }

    function scrollTo(el) {
      var r = el.getBoundingClientRect();
      if (!r.height && !r.width) return;
      window.scrollTo({ top: r.top + window.scrollY - Math.max(120, window.innerHeight * 0.28), behavior: 'instant' });
    }

    function go(i) {
      var el = document.getElementById(ids[i]);
      if (!el) return;
      cur = i;
      document.querySelectorAll('.sx-focus').forEach(function (x) { x.classList.remove('sx-focus'); });
      var target = show(el);
      mark(el);
      if (target !== el) mark(target.closest('p,li,div') || target);
      el.classList.add('sx-focus');
      if (target !== el) target.classList.add('sx-focus');
      userMoved = false;
      requestAnimationFrame(function () { scrollTo(target); });
      // 图片解码、字体换上之后布局还会动，补两次；用户已经自己滚了就不再拉回来
      [450, 1200].forEach(function (ms) { setTimeout(function () { if (!userMoved && cur === i) scrollTo(target); }, ms); });
      var p = new URLSearchParams(location.search);
      p.set('at', ids[i]);
      history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
      if (bar) bar.querySelector('.sx-pos').textContent = ids.length > 1 ? (i + 1) + ' / ' + ids.length : '';
    }

    function makeBar() {
      var back = nav && nav.e === entry && nav.back ? nav.back : BASE + '/search/?q=' + encodeURIComponent(q);
      bar = document.createElement('div');
      bar.className = 'sx-bar' + (document.querySelector('.player') ? ' sx-bar-up' : '');
      bar.setAttribute('role', 'navigation');
      bar.setAttribute('aria-label', '搜索结果');
      bar.innerHTML = '<a class="sx-q" href="' + esc(back) + '" title="回到搜索结果">‹ 「' + esc(q) + '」</a>'
        + (ids.length > 1 ? '<button type="button" class="sx-prev" aria-label="上一处">↑</button><span class="sx-pos"></span>'
          + '<button type="button" class="sx-next" aria-label="下一处">↓</button>' : '<span class="sx-pos"></span>')
        + '<button type="button" class="sx-x" aria-label="关闭，去掉高亮">×</button>';
      document.body.appendChild(bar);
      bar.addEventListener('click', function (ev) {
        if (ev.target.closest('.sx-prev')) go((cur - 1 + ids.length) % ids.length);
        else if (ev.target.closest('.sx-next')) go((cur + 1) % ids.length);
        else if (ev.target.closest('.sx-x')) {
          bar.remove(); bar = null;
          document.querySelectorAll('.sx-hl').forEach(function (s) { s.replaceWith(s.textContent); });
          document.querySelectorAll('.sx-focus').forEach(function (x) { x.classList.remove('sx-focus'); });
          var p = new URLSearchParams(location.search); p.delete('q'); p.delete('at'); p.delete('exact');
          var s = p.toString();
          history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
        }
      });
    }

    ['wheel', 'touchmove', 'keydown'].forEach(function (t) {
      addEventListener(t, function () { userMoved = true; }, { passive: true });
    });
    // 页面自己的脚本（恢复上次的 tab、按 hash 切 tab）在 DOMContentLoaded 前后跑，落点要排在它们后面
    function start() { setTimeout(function () { makeBar(); go(cur); }, 0); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  /* ================================================================
     3. 快捷键：/ 或 ⌘K
     ================================================================ */
  addEventListener('keydown', function (ev) {
    var k = ev.key, typing = ev.target.closest && ev.target.closest('input,textarea,select,[contenteditable]');
    var cmdK = (ev.metaKey || ev.ctrlKey) && k.toLowerCase() === 'k';
    if (!cmdK && (k !== '/' || typing || ev.metaKey || ev.ctrlKey || ev.altKey)) return;
    var box = document.querySelector('#sx-q, .sx-box input');
    ev.preventDefault();
    if (box) { box.focus(); box.select(); }
    else location.href = BASE + '/search/';
  });

  var app = document.getElementById('sx-app');
  if (app) searchPage(app);
  else landing();
})();
