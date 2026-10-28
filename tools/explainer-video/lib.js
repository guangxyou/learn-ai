// 纯函数，node 和浏览器两边都能 import。
// 画幅：默认横版 1920×1080；竖版视频在 meta.size 里给 [宽, 高]，boot 时调 setSize。
export let W = 1920, H = 1080;
export function setSize(w, h) { W = w; H = h; }

// 配色沿用 svg-figure 那套 token：青 = 这一步变了 / 是重点，琥珀 = 值得留意，灰 = 没变化。
export const C = {
  ink: '#14161A', ink2: '#4E5560', ink3: '#868D98',
  teal: '#0F766E', tealD: '#0B5750', tealL: '#E6F4F1', tealM: '#B8DED8',
  amber: '#B45309', amberD: '#8A4008', amberL: '#FEF6E7',
  line: '#C8C3BA', line2: '#E4E1DA', mid: '#F3F1ED', bg: '#FBFAF8', lead: '#B9B3A8',
  white: '#FFFFFF', grid: '#EFECE6', subBg: 'rgba(20,22,26,0.86)', subFg: '#FFFFFF',
};

// 深色主题（3Blue1Brown 那类黑底讲解片）。键和 C 一一对应；white 在深色里是卡片底色。
export const DARK = {
  ink: '#ECEAE5', ink2: '#AEB4BD', ink3: '#79818C',
  teal: '#2BB3A3', tealD: '#7FE0D2', tealL: '#12302D', tealM: '#1E5A53',
  amber: '#E0913A', amberD: '#F2B872', amberL: '#33240F',
  line: '#3A4049', line2: '#262B32', mid: '#191D23', bg: '#0D1014', lead: '#555D68',
  white: '#151920', grid: '#12161B', subBg: 'rgba(255,255,255,0.10)', subFg: '#F4F2EE',
};

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeBack = (t) => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2); t = clamp(t);
  return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
}

// 固定种子，每一帧画出来都一样。
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function softmax(xs) {
  const m = Math.max(...xs), e = xs.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / z);
}

// 没有 TTS 时长时按语速估，只给设计阶段用。
export const estimate = (s) => 0.35 + [...s].length / 4.6;
