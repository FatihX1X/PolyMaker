// Exports a film's captions as .srt and .vtt for each language:
//   node tools/subtitles.mjs <filmDir> [outDir] [filePrefix]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const filmDir = resolve(process.argv[2] || join(here, '..', 'promo'));
const outDir = resolve(process.argv[3] || join(filmDir, 'out'));
const prefix = process.argv[4] || 'tapeout_promo';
mkdirSync(outDir, { recursive: true });
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(filmDir, 'i18n.js'), 'utf8'), sandbox);
const I18N = sandbox.window.TAPEOUT_I18N;

const stamp = (s, sep) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`;
};
for (const [lang, L] of Object.entries(I18N)) {
  const srt = L.subs.map(([a, b, text], i) => `${i + 1}\n${stamp(a, ',')} --> ${stamp(b, ',')}\n${text}\n`).join('\n');
  const vtt = 'WEBVTT\n\n' + L.subs.map(([a, b, text]) => `${stamp(a, '.')} --> ${stamp(b, '.')}\n${text}\n`).join('\n');
  writeFileSync(join(outDir, `${prefix}_${lang}.srt`), srt);
  writeFileSync(join(outDir, `${prefix}_${lang}.vtt`), vtt);
}
console.log('wrote subtitles to', outDir);
