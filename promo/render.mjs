// Offline renderer: node render.mjs --lang tr|en [--fps 60] [--from 0] [--to 76] [--stills 3,14,40] [--out dir]
// Drives index.html?render in headless Chromium, paints each frame deterministically and pipes PNGs into ffmpeg.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// CommonJS resolution honours NODE_PATH, so a globally installed Playwright works too.
const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const lang = args.lang || 'en';
const fps = Number(args.fps || 60);
const outDir = resolve(args.out || join(here, 'out'));
const subs = args.subs !== '0';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, 'index.html')).href + `?render=1&lang=${lang}`);
await page.evaluate(() => window.fontsReady);
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.TapeOutFilm.DURATION);

const grab = (t) => page.evaluate(([t, l, s]) => {
  window.renderAt(t, l, s);
  return document.getElementById('c').toDataURL('image/png');
}, [t, lang, subs]).then(u => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));

if (args.stills) {
  for (const s of String(args.stills).split(',')) {
    const t = Number(s);
    writeFileSync(join(outDir, `still_${lang}_${t.toFixed(2)}.png`), await grab(t));
  }
  await browser.close();
  process.exit(0);
}

const from = Number(args.from || 0), to = Math.min(duration, Number(args.to || duration));
const frames = Math.round((to - from) * fps);
const file = join(outDir, args.name || `tapeout_promo_${lang}_video.mp4`);
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-tune', 'film',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', file,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const buf = await grab(from + i / fps);
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 300 === 0) console.log(`[${lang}] frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await done;
await browser.close();
console.log('wrote', file);
