// 小红书封面（4:3，横版视频的封面框就是这个比例）：成片里的一帧 + 底部大标题（盖住字幕区）
// 用法：node cover.mjs <frame.jpg> <out.png> <主标题> <副标题> [右下角标签]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [frame, out, title, sub, tag = "4 分钟动画"] = process.argv.slice(2);
const img = 'data:image/jpeg;base64,' + fs.readFileSync(frame).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:1440px;height:1080px;position:relative;overflow:hidden;font-family:-apple-system,"PingFang SC",sans-serif;background:#FBFAF8}
img{position:absolute;left:0;top:-10px;width:1440px}
.band{position:absolute;left:0;right:0;bottom:0;height:430px;background:linear-gradient(180deg,rgba(251,250,248,0) 0,#FBFAF8 30px)}
.t{position:absolute;left:72px;bottom:112px;font-size:112px;font-weight:800;color:#14161A;letter-spacing:-2px;line-height:1}
.s{position:absolute;left:76px;bottom:48px;font-size:42px;font-weight:600;color:#0F766E}
.tag{position:absolute;right:72px;bottom:56px;font-size:32px;color:#868D98}
</style><img src="${img}"><div class="band"></div><div class="t">${title}</div><div class="s">${sub}</div><div class="tag">${tag}</div>`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 1080 });
await p.setContent(html); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out }); await b.close();
