// Renders a showcase cut frame by frame (deterministic) and encodes it with the synthesised soundtrack.
//   node render.mjs a            -> out/kaunter-a.mp4 (60 s, 1920x1080, 30 fps)
//   STILLS=3,12.5 node render.mjs a   -> only writes out/still-a-<sec>.jpg for those seconds (fast check)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cut = process.argv[2] || 'a';
const FPS = 30;
const SECS = Number(process.env.SECS || 60);
const stills = (process.env.STILLS || '').split(',').filter(Boolean).map(Number);
const port = 8766 + (cut === 'b' ? 1 : 0);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(port);

const frames = path.join(here, 'frames', cut);
const out = path.join(here, 'out');
fs.mkdirSync(out, { recursive: true });
if (!stills.length) { fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true }); }

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'en-MY', timezoneId: 'Asia/Kuala_Lumpur' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });
page.on('pageerror', (e) => console.log('[page exception]', e.message));
await page.clock.install({ time: new Date('2026-10-10T10:24:00+08:00') });
await page.goto(`http://localhost:${port}/slides/film.html?cut=${cut}`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
const now = await page.evaluate(() => Date.now());
await page.clock.pauseAt(new Date(now + 500));

const total = SECS * FPS;
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  if (f > 0) await page.clock.runFor(1000 / FPS);
  const t = f / FPS;
  await page.evaluate((x) => window.seek(x), t);
  if (stills.length) {
    if (stills.some((s) => Math.abs(s - t) < 0.5 / FPS)) {
      if (process.env.PROBE) console.log(t.toFixed(1), JSON.stringify(await page.evaluate(process.env.PROBE)));
      await page.screenshot({ path: path.join(out, `still-${cut}-${t.toFixed(1)}.jpg`), type: 'jpeg', quality: 88 });
    }
  } else {
    await page.screenshot({ path: path.join(frames, String(f).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    if (f % 90 === 0) console.log(`frame ${f}/${total}  ${(((Date.now() - t0) / 1000) | 0)}s elapsed`);
  }
}
const sfx = await page.evaluate(() => window.SFX);
fs.writeFileSync(path.join(out, `sfx-${cut}.json`), JSON.stringify(sfx));
await browser.close();
server.close();
if (stills.length) process.exit(0);

const py = spawnSync('python', [path.join(here, 'music.py'), cut], { stdio: 'inherit' });
if (py.status) process.exit(py.status);
const ff = spawnSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-i', path.join(out, `music-${cut}.wav`), '-t', String(SECS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', path.join(out, `kaunter-${cut}.mp4`)], { stdio: 'inherit' });
process.exit(ff.status || 0);
