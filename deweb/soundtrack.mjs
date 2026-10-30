// Procedural score + sound design for the TapeOut DeWEB explainer (no voice-over).
// node soundtrack.mjs out.wav — writes a 48 kHz stereo 16-bit WAV, synced to the film's timeline.
import { createMix } from '../tools/synth.mjs';

const DUR = 93;
const { chord, sub, boom, noiseSwell, riser, blip, click, bell, crackle, rnd, writeWav } = createMix(DUR);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// ================= score =================
// A minor world; tension (Bb) on the tampered node, resolves to C major on the brand reveal.
const A = 45, C = 48, D = 50, F = 41, G = 43, Bb = 46;
const PADS = [
  [0.2, 8.2, [A, A + 7, A + 12, A + 14, A + 15], 0.045, 3.0],   // Am(add9, b3 cluster): uneasy
  [7.9, 12.8, [F + 12, F + 19, F + 23, F + 28, F + 31], 0.05, 1.2], // Fmaj7: the idea
  [12.6, 19.2, [A, A + 7, A + 10, A + 14, A + 19], 0.042, 2.0],  // Am9
  [19.0, 25.6, [F + 12, F + 19, F + 23, F + 26, F + 31], 0.042, 2.0],
  [25.4, 29.9, [C, C + 7, C + 11, C + 14, C + 19], 0.045, 1.8],  // Cmaj9: ownership
  [29.7, 34.2, [G, G + 7, G + 14, G + 16, G + 19], 0.045, 1.6],  // G6/9: sold
  [34.0, 38.5, [A, A + 7, A + 10, A + 14, A + 19], 0.042, 1.8],
  [38.3, 42.8, [F + 12, F + 19, F + 23, F + 26, F + 31], 0.042, 1.8],
  [42.6, 51.2, [D, D + 7, D + 10, D + 14, D + 17], 0.042, 2.0],  // Dm9: verification
  [51.0, 55.6, [Bb, Bb + 6, Bb + 11, Bb + 16, Bb + 18], 0.04, 0.6], // Bbmaj7#11: mismatch
  [55.4, 60.2, [F + 12, F + 19, F + 24, F + 28, F + 31], 0.045, 1.2],
  [60.0, 64.6, [G, G + 7, G + 12, G + 14, G + 19], 0.045, 1.6],
  [64.4, 69.1, [A, A + 7, A + 12, A + 15, A + 19], 0.042, 1.8],
  [68.9, 73.3, [F + 12, F + 19, F + 23, F + 26, F + 31], 0.042, 1.8],
  [73.1, 77.6, [G, G + 7, G + 11, G + 14, G + 19], 0.048, 1.2],  // Gmaj: one root of trust
  [77.4, 83.2, [C, C + 7, C + 11, C + 14, C + 19], 0.048, 1.6],
  [83.0, 90.5, [C, C + 7, C + 12, C + 16, C + 19, C + 26], 0.055, 1.5], // Cadd9 resolve
];
for (const [t0, t1, notes, amp, atk] of PADS) chord(t0, t1, notes, amp, { atk, rel: t1 > 89 ? 3.5 : 2.5 });
const SUBS = [[8.0, 12.6, F], [12.6, 19.0, A], [19.0, 25.4, F], [25.4, 29.7, C], [29.7, 34, G], [34, 38.3, A], [38.3, 42.6, F],
  [42.6, 51.0, D], [51.0, 55.4, Bb], [55.4, 60, F], [60, 64.4, G], [64.4, 68.9, A], [68.9, 73.1, F], [73.1, 77.4, G],
  [77.4, 83, C], [83, 90.5, C]];
for (const [t0, t1, n] of SUBS) sub(t0, t1, n - 12 < 33 ? n : n - 12, 0.1);

// pulse arpeggios
function arp(t0, t1, notesAt, step, amp) {
  for (let t = t0, k = 0; t < t1; t += step, k++) {
    const ns = notesAt(t);
    blip(t, ns[k % ns.length], amp * (0.8 + 0.2 * ((k % 4) === 0)), 0.13, k % 2 ? 0.35 : -0.35);
  }
}
const chordAt = t => {
  for (let i = PADS.length - 1; i >= 0; i--) if (t >= PADS[i][0]) return PADS[i][2];
  return PADS[0][2];
};
const up = ns => [ns[0] + 24, ns[1] + 24, ns[3] + 12, ns[4] + 12];
arp(12.75, 34.0, t => up(chordAt(t)), 0.25, 0.05);
arp(42.75, 51.0, t => up(chordAt(t)), 0.25, 0.055);
arp(55.5, 64.4, t => up(chordAt(t)), 0.5, 0.045);
arp(64.5, 83.0, t => up(chordAt(t)), 0.25, 0.045);

// ================= sound design =================
const TRANSITIONS = [12.6, 25.4, 34, 42.6, 55.4, 60, 64.4, 77.4];
for (const b of TRANSITIONS) { noiseSwell(b - 0.6, b, 0.2, { c0: 300, c1: 7000 }); boom(b, 0.55, 85, 30, 1.4); }

// 1 — blind trust
noiseSwell(0.0, 1.0, 0.2, { c0: 200, c1: 3000 });
blip(1.4, 76, 0.06, 0.3); blip(1.6, 81, 0.05, 0.3);         // contract verified
for (let k = 0; k < 26; k++) click(2.7 + k * 0.035 + (rnd() + 1) * 0.01, 0.22, 2000 + (rnd() + 1) * 4000); // glitch
noiseSwell(2.7, 2.75, 0.4, { c0: 3000, c1: 9000, tail: 0.5 });
boom(3.2, 0.6, 70, 30, 1.2);
blip(3.4, 58, 0.09, 0.4); blip(3.55, 57, 0.09, 0.5);         // warning, two-tone
for (let k = 0; k < 10; k++) click(5.6 + k * 0.03, 0.15, 5000);
noiseSwell(6.8, 8.05, 0.45, { c0: 200, c1: 10000, curve: 3, tail: 0.05 }); // collapse
// 2 — title
boom(8.05, 0.85, 110, 30, 2.0);
bell(8.4, 81, 0.1, 3.5);
for (let k = 0; k < 20; k++) blip(8.5 + k * 0.17, 88 + Math.floor((rnd() + 1) * 6), 0.018, 0.05, rnd() * 0.8, 0.6);
riser(10.6, 11.8, 0.08);
boom(11.8, 0.5, 90, 34, 1.0); bell(11.8, 76, 0.07, 2.5);
// 3 — files to chunks
const FILE_N = [2, 3, 1, 4], FILE_NOTE = [72, 74, 76, 79];
let slot = 0;
FILE_N.forEach((n, fi) => {
  const t0 = 14.8 + fi * 1.5;
  click(t0, 0.12, 4000);
  for (let k = 0; k < n; k++, slot++) {
    const ct = t0 + 0.35 + k * 0.18;
    noiseSwell(ct, ct + 0.5, 0.05, { c0: 1500, c1: 8000, curve: 1.5, tail: 0.05 });
    click(ct + 0.7, 0.2, 3000);
    blip(ct + 0.7, FILE_NOTE[fi] + 12, 0.04, 0.06);
  }
  const done = t0 + 0.35 + (n - 1) * 0.18 + 0.8;
  blip(done, FILE_NOTE[fi], 0.07, 0.18);
});
for (let i = 0; i < 4; i++) blip(21.4 + i * 0.6, 84 + i * 2, 0.035, 0.1);
// 4 — ownership
bell(25.7, 76, 0.08, 2.5);
noiseSwell(26.0, 26.9, 0.08, { c0: 800, c1: 6000 });
blip(27.2, 79, 0.05, 0.2); blip(27.7, 83, 0.04, 0.2);
riser(29.0, 30.8, 0.07);
click(30.8, 0.35, 3000); boom(30.85, 0.45, 100, 40, 0.6); blip(30.9, 79, 0.08, 0.3);
// 5 — access: keystrokes
const keys = (t0, t1, n) => { for (let k = 0; k < n; k++) click(t0 + (t1 - t0) * (k / n) + (rnd() + 1) * 0.008, 0.12, 6000); };
keys(34.5, 35.7, 13); keys(38.3, 38.8, 13); keys(38.9, 39.6, 10);
bell(35.95, 84, 0.07, 2.2); blip(36.6, 79, 0.05, 0.2);
for (let k = 0; k < 3; k++) blip(39.4 + k * 0.3, 74 + k * 5, 0.06, 0.18);
// 6 — TapeKit verification
for (let i = 0; i < 4; i++) blip(43.2 + i * 0.15, 69 + i * 3, 0.05, 0.12);
for (let t = 44.3; t < 51.0; t += 0.125) click(t + (rnd() + 1) * 0.02, 0.05, 7000);  // packets
for (let i = 0; i < 4; i++) { blip(47.1 + i * 0.7 + 0.3, 81 + [0, 2, 4, 7][i], 0.07, 0.15); }
// mismatch alarm
for (let k = 0; k < 4; k++) { blip(51.1 + k * 0.32, k % 2 ? 61 : 64, 0.1, 0.18, 0, 0.3); }
crackle(51.1, 51.8, 0.2);
boom(51.75, 0.7, 70, 28, 1.6);
noiseSwell(51.7, 51.72, 0.35, { c0: 2000, c1: 4000, tail: 0.8 });
// 7 — gateway
keys(55.6, 56.5, 18);
bell(56.6, 81, 0.06, 2);
for (let i = 0; i < 3; i++) { click(57.0 + i * 0.3, 0.2, 3500); blip(57.05 + i * 0.3, 76 + i * 3, 0.05, 0.12); }
// 8 — cost
noiseSwell(60.5, 62.6, 0.06, { c0: 600, c1: 5000, curve: 1 });
for (let m = 0; m < 24; m++) click(60.5 + (m / 24) * 2.1, 0.06, 5000);  // monthly bills
for (let i = 0; i < 3; i++) blip(62.4 + i * 0.25, 79 + i * 2, 0.05, 0.12);
// 9 — difference + root of trust
[64.7, 65.0, 69.0, 69.3].forEach((t, i) => { click(t, 0.15, 3000); blip(t + 0.4, i % 2 ? 57 : 60, 0.06, 0.15); });
riser(72.4, 74.2, 0.09);
boom(74.2, 0.75, 100, 30, 2.0); bell(74.25, 79, 0.11, 3.5); bell(74.27, 86, 0.05, 3);
// 10 — ecosystem
for (let i = 0; i < 6; i++) blip(78.0 + i * 0.22, [72, 76, 79, 83, 86, 88][i], 0.06, 0.25);
// 11 — finale
riser(81.6, 83.0, 0.08);
noiseSwell(82.4, 83.4, 0.3, { c0: 300, c1: 9000 });
boom(83.4, 0.8, 90, 30, 2.4);
bell(84.95, 76, 0.13, 4.5); bell(84.98, 83, 0.07, 4);
bell(86.3, 79, 0.06, 4);
click(87.8, 0.2, 5000); blip(87.8, 88, 0.06, 0.4);

const out = process.argv[2] || 'soundtrack.wav';
const peak = writeWav(out);
console.log('wrote', out, 'peak', peak.toFixed(3));
