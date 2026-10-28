// 抽帧检查：node snap.mjs <视频目录> <输出目录> [时间点,...]
// 不给时间点就取每句话说完前 0.2 秒（动画基本落定），四张拼一张 2×2。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const [dirArg, outArg, timesArg] = process.argv.slice(2);
const dir = path.resolve(dirArg), out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (/\.(jpg|png)$/.test(f)) fs.unlinkSync(path.join(out, f));
// 仓库外的视频目录由 build.mjs --serve 挂在 /__ext/ 下
const rel = path.relative(ROOT, dir).startsWith('..') ? '/__ext/' + path.basename(dir) + '/video.mjs' : '/' + path.relative(ROOT, path.join(dir, 'video.mjs'));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://127.0.0.1:${process.env.PORT || 8194}/tools/explainer-video/player.html?v=${encodeURIComponent(rel)}`);
await page.waitForFunction('window.ready || window.bootError');
const err = await page.evaluate('window.bootError'); if (err) { console.error(err); process.exit(1); }
const times = timesArg ? timesArg.split(',').map(Number)
  : await page.evaluate(() => TL.scenes.flatMap((s) => s.lines.map((l) => +(s.start + Math.max(l.start + 0.3, l.end - 0.2)).toFixed(2))));
const files = [];
for (const [i, T] of times.entries()) {
  const b64 = await page.evaluate((T) => window.frame(T, 0.85), T);
  const f = path.join(out, `f${String(i).padStart(3, '0')}_${T}.jpg`);
  fs.writeFileSync(f, Buffer.from(b64, 'base64')); files.push(f);
}
console.log((await page.evaluate('window.takeWarnings()')).join('\n'));
await browser.close();
if (!timesArg) {
  for (let k = 0; k < files.length; k += 4) {
    const group = files.slice(k, k + 4);
    while (group.length < 4) group.push(group[group.length - 1]);
    execFileSync('ffmpeg', ['-y', '-v', 'error', ...group.flatMap((f) => ['-i', f]), '-filter_complex',
      '[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[a][b]hstack[t];[c][d]hstack[u];[t][u]vstack', path.join(out, `sheet${String(k / 4).padStart(2, '0')}.jpg`)]);
  }
}
console.log(files.length, 'frames ->', out);
