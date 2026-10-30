// Procedural score + sound design for the TapeOut promo (no voice-over).
// node soundtrack.mjs out.wav — writes a 48 kHz stereo 16-bit WAV, synced to the film's timeline.
import { createMix } from '../tools/synth.mjs';

const DUR = 76;
const { chord, sub, boom, noiseSwell, riser, blip, click, bell, crackle, rnd, writeWav } = createMix(DUR);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// ================= score =================
// D minor world; resolves to F major on the brand reveal.
const D = 50, F = 53, Bb = 46, C = 48, G = 43, A = 45;
chord(0.2, 7.0, [D, D + 7, D + 12, D + 15, D + 19], 0.05, { atk: 3.5 });          // Dm(add9) shimmer
chord(6.6, 12.8, [Bb, Bb + 7, Bb + 11, Bb + 16, Bb + 19], 0.05);                    // Bbmaj7
sub(7.0, 12.6, Bb - 12, 0.12);
chord(12.4, 21.2, [D, D + 7, D + 10, D + 14, D + 17], 0.045);                       // Dm7
sub(12.6, 21.0, D - 12, 0.11);
chord(20.8, 27.4, [G, G + 7, G + 10, G + 14, G + 17], 0.045);                       // Gm9
sub(21.0, 27.0, G - 12 + 12, 0.1);
chord(27.0, 33.0, [Bb, Bb + 7, Bb + 11, Bb + 14, Bb + 19], 0.042);
chord(32.8, 39.3, [C, C + 7, C + 14, C + 16, C + 19], 0.042);                       // Cadd9 (lift)
sub(27.0, 33.0, Bb - 12, 0.1);
sub(33.0, 39.4, C - 12, 0.1);
chord(40.2, 47.2, [F, F + 7, F + 11, F + 16, F + 19], 0.05, { atk: 1.2 });         // Fmaj7 — circuit born
sub(40.0, 47.0, F - 12, 0.12);
chord(47.0, 53.8, [D, D + 7, D + 10, D + 14, D + 19], 0.045);
sub(47.0, 53.6, D - 12, 0.11);
chord(53.5, 59.5, [Bb, Bb + 7, Bb + 11, Bb + 14, Bb + 19], 0.045);
chord(59.4, 66.2, [C, C + 7, C + 12, C + 16, C + 21], 0.045);
sub(53.5, 59.5, Bb - 12, 0.11);
sub(59.5, 66.0, C - 12, 0.11);
chord(66.2, 73.5, [F, F + 7, F + 12, F + 16, F + 19, F + 26], 0.055, { atk: 1.5, rel: 3.5 }); // Fmaj9 resolve
sub(66.2, 73.5, F - 12, 0.12);

// pulse arpeggio through the build (editor → tape out)
const BEAT = 0.25;
const arpA = [D + 24, D + 31, D + 27, D + 34];
for (let t = 27.25, k = 0; t < 39.3; t += BEAT, k++) {
  const base = t < 33 ? [Bb + 24, Bb + 31, Bb + 26, Bb + 35] : [C + 24, C + 31, C + 26, C + 33];
  const rise = clamp((t - 27) / 12);
  blip(t, base[k % 4], 0.05 + 0.05 * rise, 0.12, k % 2 ? 0.3 : -0.3);
}
for (let t = 47.4, k = 0; t < 53.5; t += BEAT * 2, k++) blip(t, arpA[k % 4], 0.05, 0.16, k % 2 ? 0.4 : -0.4);
for (let t = 53.75, k = 0; t < 65.8; t += BEAT * 2, k++) {
  const base = t < 59.5 ? [Bb + 24, Bb + 31, Bb + 26, Bb + 35] : [C + 24, C + 31, C + 28, C + 36];
  blip(t, base[k % 4], 0.05, 0.16, k % 2 ? 0.35 : -0.35);
}

// ================= sound design =================
noiseSwell(0.0, 1.0, 0.25, { c0: 200, c1: 4000 });
boom(1.0, 0.55, 70, 30, 2.4);
// coins tumbling: soft high blips
for (let k = 0; k < 26; k++) blip(1.0 + k * 0.14 + ((rnd() + 1) * 0.06), 86 + ((k * 7) % 12), 0.025, 0.08, rnd() * 0.8, 0.6);
noiseSwell(4.6, 6.9, 0.22, { c0: 300, c1: 5000 });
for (let k = 0; k < 18; k++) click(5.2 + k * 0.09, 0.12, 6000); // tiles locking into the grid
boom(7.0, 0.7);
for (let k = 0; k < 12; k++) blip(7.6 + k * 0.18, 74 + [0, 3, 7, 10][k % 4], 0.03, 0.1, (k % 3 - 1) * 0.5);
noiseSwell(11.4, 12.6, 0.35, { c0: 400, c1: 10000, curve: 3 });
boom(12.6, 0.75, 110, 30, 1.8);
// gate draw + truth table steps
noiseSwell(12.8, 14.4, 0.06, { c0: 2000, c1: 7000, curve: 1 });
for (let k = 0; k < 5; k++) { const t = 14.6 + k * 1.25; if (t < 21) { blip(t, k % 4 === 3 ? 62 : 74, 0.1, 0.14); click(t, 0.1); } }
for (let k = 0; k < 7; k++) blip(17.2 + k * 0.09, 81 + k, 0.04, 0.06, 0, 0.3); // byte cells
boom(21.0, 0.5, 80, 34, 1.2);
for (let k = 0; k < 6; k++) { click(21.0 + k, 0.2, 7000); blip(21.0 + k, k % 2 ? 69 : 74, 0.08, 0.1); } // latch clock ticks
noiseSwell(26.0, 27.0, 0.25, { c0: 300, c1: 7000 });
boom(27.0, 0.55, 80, 32, 1.4);
// editor: gates drop, wires snap, toggles
[27.9, 28.25, 28.6, 28.95, 29.3].forEach((t, k) => { click(t, 0.18, 3500); blip(t, 79 + k * 2, 0.04, 0.05); });
for (let k = 0; k < 12; k++) noiseSwell(29.9 + k * 0.22, 30.25 + k * 0.22, 0.04, { c0: 1500, c1: 8000, curve: 1.5, tail: 0.05 });
[33.6, 35.2].forEach(t => { click(t, 0.3, 4500); blip(t + 0.02, 86, 0.06, 0.08); });
riser(36.4, 39.55, 0.18);
click(39.5, 0.35, 4000);
// TAPE OUT impact
boom(39.6, 1.0, 120, 28, 2.6);
noiseSwell(39.6, 39.62, 0.6, { c0: 6000, c1: 9000, tail: 1.2 });
crackle(39.8, 41.8, 0.25);
noiseSwell(41.0, 42.6, 0.18, { c0: 800, c1: 9000, curve: 2 }); // particles gather
bell(42.6, 77, 0.12, 3.5);
bell(42.62, 84, 0.06, 3);
noiseSwell(42.9, 44.2, 0.05, { c0: 5000, c1: 9000, curve: 1 }); // gloss sweep
[43.8, 44.15, 44.5].forEach((t, k) => blip(t, 72 + k * 5, 0.07, 0.2));
// compose
noiseSwell(46.4, 47.1, 0.2, { c0: 300, c1: 6000 });
boom(47.1, 0.6);
for (let k = 0; k < 7; k++) { click(48.3 + k * 0.12, 0.14, 3000); blip(48.3 + k * 0.12, 67 + k * 2, 0.04, 0.07); }
riser(50.8, 53.4, 0.08);
// pillars
boom(53.6, 0.55, 80, 30, 1.6);
[54.0, 58.0, 62.0].forEach((t, k) => { noiseSwell(t - 0.5, t, 0.12, { c0: 500, c1: 6000 }); blip(t, 74 + k * 3, 0.08, 0.25); });
for (let k = 0; k < 8; k++) blip(62.4 + k * 0.4, 88 + (k % 3) * 2, 0.025, 0.1, (k % 2) * 0.6 - 0.3); // BEM coins
// finale
riser(64.6, 66.0, 0.09);
noiseSwell(65.4, 66.6, 0.3, { c0: 300, c1: 9000 });
boom(66.6, 0.8, 90, 30, 2.4);
bell(68.0, 77, 0.14, 4.5);
bell(68.03, 84, 0.07, 4);
bell(69.0, 81, 0.06, 4);
click(71.0, 0.2, 5000);
blip(71.0, 89, 0.06, 0.4);

const out = process.argv[2] || 'soundtrack.wav';
const peak = writeWav(out);
console.log('wrote', out, 'peak', peak.toFixed(3));
