// 用法：node build.mjs <视频目录> [--tts-only] [--serve] [--workers 4] [--fps 30]
// 视频目录里放 video.mjs；产物写进 <视频目录>/build/，成片写进 <视频目录>/<meta.name>.mp4
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildTimeline } from './engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EDGE_TTS = process.env.EDGE_TTS || 'edge-tts';

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const dir = path.resolve(args[0]);
const FPS = +opt('--fps', 30), WORKERS = +opt('--workers', 4);
const OUT = path.join(dir, 'build');
fs.mkdirSync(path.join(OUT, 'tts'), { recursive: true });

const video = (await import(pathToFileURL(path.join(dir, 'video.mjs')).href + '?' + Date.now())).default;
const { voice = 'zh-CN-YunxiNeural', rate = '+0%' } = video.meta;
const QWEN = video.meta.tts && video.meta.tts.engine === 'qwen' ? video.meta.tts : null;
const PY = path.join(HERE, '.venv/bin/python');

// ---------- 1. TTS ----------
const probe = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
const jobs = [];
const vkey = QWEN ? JSON.stringify(QWEN) : voice + rate;
// 读音词典：只改送进 TTS 的文字，字幕不动。例如 { ReLU: 'Re-LU', tanh: 'tanch' }
const LEX = Object.entries(video.meta.lexicon || {});
const lex = (s) => LEX.reduce((acc, [w, r]) => acc.replace(new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'g'), r), s);
video.scenes.forEach((sc, k) => sc.lines.forEach((ln, i) => {
  const say = lex(ln.say || ln.sub);
  const key = crypto.createHash('sha1').update(vkey + say).digest('hex').slice(0, 12);
  jobs.push({ k, i, say, sub: ln.sub, file: path.join(OUT, 'tts', key + (QWEN ? '.raw.wav' : '.mp3')) });
}));
const ready = (f) => fs.existsSync(f) && fs.statSync(f).size > 1000;
if (QWEN) {
  const todo = jobs.filter((j) => !ready(j.file));
  if (todo.length) {
    const jf = path.join(OUT, 'qwen-jobs.json');
    fs.writeFileSync(jf, JSON.stringify({ ...QWEN, jobs: todo.map((j) => ({ text: j.say, out: j.file })) }));
    execFileSync(PY, [path.join(HERE, 'tts_qwen.py'), jf], { stdio: 'inherit' });
  }
  console.log(`tts(qwen): ${todo.length} new / ${jobs.length} lines`);
} else {
  async function tts(j) {
    if (ready(j.file)) return;
    for (let a = 0; a < 3; a++) {
      try { execFileSync(EDGE_TTS, ['--voice', voice, `--rate=${rate}`, '--text', j.say, '--write-media', j.file], { stdio: 'pipe' }); return; }
      catch (e) { if (a === 2) throw e; }
    }
  }
  let n = 0; const queue = [...jobs];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) { const j = queue.shift(); await new Promise((r) => setImmediate(r)); await tts(j); n++; }
  }));
  console.log(`tts: ${n} lines`);
}
// edge-tts 的 mp3 头尾各带一小段静音，按实际有声区间裁掉，时长以裁后为准。
for (const j of jobs) {
  j.wav = j.file.replace(/(\.raw)?\.(mp3|wav)$/, '.wav');
  if (!fs.existsSync(j.wav)) {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', j.file, '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08',
      '-ar', '48000', '-ac', '1', j.wav]);
  }
  j.dur = probe(j.wav);
}
if (flag('--check') || video.meta.asrCheck) {
  const cf = path.join(OUT, 'asr-jobs.json');
  fs.writeFileSync(cf, JSON.stringify(jobs.map((j) => ({ say: j.say, sub: j.sub, wav: j.wav, scene: j.k, line: j.i }))));
  execFileSync(PY, [path.join(HERE, 'asr_check.py'), cf, path.join(OUT, 'asr.json')], { stdio: 'inherit' });
}
const timing = { voice: QWEN ? QWEN.voice : voice, rate, scenes: video.scenes.map((sc, k) => ({ lines: jobs.filter((j) => j.k === k).map((j) => ({ dur: +j.dur.toFixed(3) })) })) };
fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify(timing, null, 1));

// 时间轴在浏览器里算，这里用同一份函数算一遍拿到每句的绝对起点
const tl = buildTimeline(video, timing);
console.log(`total ${tl.total.toFixed(1)}s, ${tl.scenes.length} scenes`);
fs.writeFileSync(path.join(OUT, 'subs.srt'), tl.scenes.flatMap((s) => s.lines.map((l) => [s.start + l.start, s.start + l.end, l.sub]))
  .map(([a, b, s], i) => `${i + 1}\n${srt(a)} --> ${srt(b)}\n${s}\n`).join('\n'));
function srt(t) { const ms = Math.round(t * 1000); const p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; }

// ---------- 2. 音轨 ----------
{
  const starts = tl.scenes.flatMap((s) => s.lines.map((l) => s.start + l.start));
  const listFile = path.join(OUT, 'audio-inputs.txt');
  const inputs = jobs.flatMap((j) => ['-i', j.wav]);
  let filt = jobs.map((j, n) => `[${n}]adelay=${Math.round(starts[n] * 1000)}:all=1[a${n}]`).join(';') +
    ';' + jobs.map((_, n) => `[a${n}]`).join('') + `amix=inputs=${jobs.length}:normalize=0:dropout_transition=0,apad,atrim=0:${tl.total.toFixed(3)}`;
  if (video.meta.bgm) {
    // 背景音乐：本地合成，旁白响起时自动压低（sidechain）
    const bgm = path.join(OUT, 'bgm.wav');
    execFileSync(PY, [path.join(HERE, 'bgm.py'), tl.total.toFixed(2), bgm, String(video.meta.bgm.seed || 1)], { stdio: 'inherit' });
    inputs.push('-i', bgm);
    const b = jobs.length;
    filt += `,asplit=2[voice][key];[${b}]volume=${video.meta.bgm.gain ?? 0.16}[bg];[bg][key]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=600[duck];[voice][duck]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5[out]`;
  } else filt += ',loudnorm=I=-16:TP=-1.5[out]';
  fs.writeFileSync(listFile, filt);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-/filter_complex', listFile, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', path.join(OUT, 'audio.m4a')]);
  const chapters = [];
  tl.scenes.forEach((s) => { if (!chapters.length || chapters.at(-1).name !== s.chapter) chapters.push({ name: s.chapter, start: +s.start.toFixed(2) }); });
  fs.writeFileSync(path.join(OUT, 'chapters.json'), JSON.stringify({ total: +tl.total.toFixed(2), chapters }, null, 1));
  console.log('audio ok');
}
if (flag('--tts-only')) process.exit(0);

// ---------- 3. 逐帧渲染 ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
// 视频目录在仓库外（比如 WeMedia 的笔记文件夹）时，把它的上一级挂到 /__ext/ 下；
// 这种 video.mjs 不能 import 仓库里的 lib.js，颜色和工具函数从 draw 的 g 上拿。
const EXT = path.relative(ROOT, dir).startsWith('..') ? path.dirname(dir) : null;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = EXT && u.startsWith('/__ext/') ? EXT : ROOT;
  const p = path.join(base, base === EXT ? u.slice(6) : u);
  if (!p.startsWith(base) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(+opt('--port', 0), '127.0.0.1', r));
const port = server.address().port;
const rel = (EXT ? '/__ext/' + path.basename(dir) + '/video.mjs' : '/' + path.relative(ROOT, path.join(dir, 'video.mjs'))).split(path.sep).map(encodeURIComponent).join('/');
const url = (extra = '') => `http://127.0.0.1:${port}/tools/explainer-video/player.html?v=${encodeURIComponent(rel)}${extra}`;
if (flag('--serve')) { console.log(url('&play=0')); await new Promise(() => {}); }

const puppeteer = (await import('puppeteer-core')).default;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-device-scale-factor=1', '--disable-gpu-vsync'] });
const total = Math.ceil(tl.total * FPS);
const from = Math.floor(+opt('--from', 0) * FPS), to = Math.min(total, Math.ceil(+opt('--to', tl.total) * FPS));
const chunk = Math.ceil((to - from) / WORKERS);
const warnings = new Set();
const t0 = Date.now();
let done = 0;
const segs = await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
  const a = from + w * chunk, b = Math.min(to, a + chunk);
  if (a >= b) return null;
  const seg = path.join(OUT, `seg${w}.mp4`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(url('&render=1'));
  await page.waitForFunction('window.ready || window.bootError', { timeout: 180000 });
  const err = await page.evaluate('window.bootError'); if (err) throw new Error(err);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((r) => ff.on('close', r));
  for (let f = a; f < b; f++) {
    const b64 = await page.evaluate((T) => window.frame(T, 0.93), f / FPS);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    if (++done % 300 === 0) console.log(`frames ${done}/${to - from}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  for (const m of await page.evaluate('window.takeWarnings()')) warnings.add(m);
  ff.stdin.end(); await closed; await page.close();
  return seg;
}));
await browser.close(); server.close();
for (const m of warnings) console.warn('WARN', m);

const list = path.join(OUT, 'segs.txt');
fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
const final = path.join(dir, (flag('--from') || flag('--to') ? 'preview-' : '') + video.meta.name + '.mp4');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from / FPS), '-i', path.join(OUT, 'audio.m4a'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', final]);
console.log('done', final, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
