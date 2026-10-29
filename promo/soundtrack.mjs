// Procedural score + sound design for the TapeOut promo (no voice-over).
// node soundtrack.mjs out.wav — writes a 48 kHz stereo 16-bit WAV, synced to the film's timeline.
import { writeFileSync } from 'node:fs';

const SR = 48000, DUR = 76, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N);
const sendL = new Float32Array(N), sendR = new Float32Array(N); // reverb bus

let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

function add(i, l, r, send = 0) {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r;
  sendL[i] += l * send; sendR[i] += r * send;
}

// ---- pad: detuned band-limited saws, slow envelopes ----
function padNote(t0, t1, note, amp, o = {}) {
  const atk = o.atk ?? 2.2, rel = o.rel ?? 2.5, harm = o.harm ?? 7, pan = o.pan ?? 0;
  const f = midi(note);
  const det = [-0.11, 0, 0.13];
  const s0 = Math.floor(t0 * SR), s1 = Math.min(N, Math.floor((t1 + rel) * SR));
  const ph = det.map((_, d) => d * 2.1); // fixed phase offsets keep renders identical
  for (let i = s0; i < s1; i++) {
    const t = i / SR;
    const e = clamp((t - t0) / atk) * (t > t1 ? Math.max(0, 1 - (t - t1) / rel) : 1);
    if (e <= 0) continue;
    let v = 0;
    for (let d = 0; d < det.length; d++) {
      const fd = f * Math.pow(2, det[d] / 12);
      for (let h = 1; h <= harm; h++) v += Math.sin(2 * Math.PI * fd * h * t + ph[d] + h) / (h * h * 0.7 + 0.3);
    }
    const lfo = 1 + 0.08 * Math.sin(2 * Math.PI * 0.13 * t + note);
    v *= amp * e * e * lfo / det.length;
    add(i, v * (1 - pan) * 0.9, v * (1 + pan) * 0.9, 0.55);
  }
}
function chord(t0, t1, notes, amp, o = {}) {
  notes.forEach((n, k) => padNote(t0, t1, n, amp * (k === 0 ? 1.1 : 0.75), { ...o, pan: ((k % 3) - 1) * 0.35 }));
}
function sub(t0, t1, note, amp) {
  const f = midi(note), s0 = Math.floor(t0 * SR), s1 = Math.min(N, Math.floor((t1 + 1.5) * SR));
  for (let i = s0; i < s1; i++) {
    const t = i / SR;
    const e = clamp((t - t0) / 1.2) * (t > t1 ? Math.max(0, 1 - (t - t1) / 1.5) : 1);
    const v = Math.sin(2 * Math.PI * f * t) * amp * 0.55 * e;
    add(i, v, v, 0);
  }
}

// ---- percussive / fx voices ----
function boom(t0, amp = 0.9, f0 = 90, f1 = 32, dec = 1.6) {
  f1 = Math.max(f1, 44); dec *= 0.6;
  let ph = 0;
  for (let i = Math.floor(t0 * SR), k = 0; k < dec * 2 * SR && i < N; i++, k++) {
    const tt = k / SR;
    const f = f1 + (f0 - f1) * Math.exp(-tt * 9);
    ph += 2 * Math.PI * f / SR;
    const v = Math.sin(ph) * amp * Math.exp(-tt / dec * 2.2) * clamp(tt / 0.004);
    add(i, v, v, 0.15);
  }
}
function noiseSwell(t0, t1, amp, o = {}) {
  // filtered noise rising into t1 (whoosh), cutoff sweeps up
  let lpL = 0, lpR = 0;
  const s0 = Math.floor(t0 * SR), s1 = Math.min(N, Math.floor((t1 + (o.tail ?? 0.35)) * SR));
  for (let i = s0; i < s1; i++) {
    const t = i / SR, u = clamp((t - t0) / (t1 - t0));
    const e = t <= t1 ? Math.pow(u, o.curve ?? 2.2) : Math.exp(-(t - t1) / 0.12);
    const cut = (o.c0 ?? 300) + ((o.c1 ?? 6000) - (o.c0 ?? 300)) * u;
    const a = 1 - Math.exp(-2 * Math.PI * cut / SR);
    lpL += a * (rnd() - lpL); lpR += a * (rnd() - lpR);
    add(i, lpL * amp * e, lpR * amp * e, 0.4);
  }
}
function riser(t0, t1, amp) {
  let ph = 0;
  for (let i = Math.floor(t0 * SR); i < Math.floor(t1 * SR) && i < N; i++) {
    const u = (i / SR - t0) / (t1 - t0);
    const f = 110 * Math.pow(2, u * 3.2);
    ph += 2 * Math.PI * f / SR;
    const v = (Math.sin(ph) + 0.3 * Math.sin(ph * 2.01)) * amp * u * u;
    add(i, v, v, 0.5);
  }
  noiseSwell(t0, t1, amp * 1.4, { c0: 200, c1: 9000, curve: 3, tail: 0.05 });
}
function blip(t0, note, amp = 0.18, dec = 0.18, pan = 0, send = 0.45) {
  const f = midi(note);
  for (let i = Math.floor(t0 * SR), k = 0; k < dec * 5 * SR && i < N; i++, k++) {
    const tt = k / SR;
    const e = Math.exp(-tt / dec) * clamp(tt / 0.002);
    const v = (Math.sin(2 * Math.PI * f * tt) + 0.25 * Math.sin(2 * Math.PI * f * 2 * tt) * Math.exp(-tt / (dec * 0.3))) * amp * e;
    add(i, v * (1 - pan), v * (1 + pan), send);
  }
}
function click(t0, amp = 0.25, bright = 5000) {
  let lp = 0;
  const a = 1 - Math.exp(-2 * Math.PI * bright / SR);
  for (let i = Math.floor(t0 * SR), k = 0; k < 0.03 * SR && i < N; i++, k++) {
    lp += a * (rnd() - lp);
    const v = lp * amp * Math.exp(-k / SR / 0.006);
    add(i, v, v, 0.2);
  }
}
function bell(t0, note, amp = 0.2, dec = 3) {
  const f = midi(note);
  const parts = [[1, 1], [2.0, 0.5], [2.76, 0.35], [5.4, 0.18], [8.93, 0.08]];
  for (let i = Math.floor(t0 * SR), k = 0; k < dec * 3 * SR && i < N; i++, k++) {
    const tt = k / SR;
    let v = 0;
    for (const [m, a] of parts) v += Math.sin(2 * Math.PI * f * m * tt) * a * Math.exp(-tt / (dec / m ** 0.5));
    v *= amp * clamp(tt / 0.003);
    add(i, v, v, 0.7);
  }
}
function crackle(t0, t1, amp) {
  // burning embers
  for (let i = Math.floor(t0 * SR); i < Math.floor(t1 * SR) && i < N; i++) {
    const t = i / SR, u = (t - t0) / (t1 - t0);
    if ((rnd() + 1) / 2 < 0.0009 * (1 - u)) click(t, amp * (0.4 + (rnd() + 1) / 2), 3000 + (rnd() + 1) * 3000);
  }
}

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

// ================= reverb (Schroeder) =================
function reverb(inp, out, offs) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d: d + offs, buf: new Float32Array(d + offs), i: 0, lp: 0 }));
  const aps = [225, 556, 441].map(d => ({ d, buf: new Float32Array(d), i: 0 }));
  const fb = 0.86, damp = 0.35;
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.12;
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * (1 - damp) + c.lp * damp;
      c.buf[c.i] = x + c.lp * fb;
      c.i = (c.i + 1) % c.d;
      y += o;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      const v = -y + b;
      a.buf[a.i] = y + b * 0.5;
      a.i = (a.i + 1) % a.d;
      y = v;
    }
    out[n] += y * 0.9;
  }
}
reverb(sendL, L, 0);
reverb(sendR, R, 23);

// master: high-pass (rumble), fade, soft clip, normalise
for (const ch of [L, R]) {
  const a = Math.exp(-2 * Math.PI * 38 / SR);
  let x1 = 0, y1 = 0;
  for (let k = 0; k < 2; k++) {
    x1 = 0; y1 = 0;
    for (let i = 0; i < N; i++) { const y = a * (y1 + ch[i] - x1); x1 = ch[i]; ch[i] = y; y1 = y; }
  }
}
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = clamp(t / 0.3) * clamp((DUR - t) / 2.5);
  L[i] = Math.tanh(L[i] * 1.2 * g);
  R[i] = Math.tanh(R[i] * 1.2 * g);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(clamp(R[i] * norm, -1, 1) * 32767), 46 + i * 4);
}
writeFileSync(process.argv[2] || 'soundtrack.wav', buf);
console.log('wrote', process.argv[2] || 'soundtrack.wav', 'peak', peak.toFixed(3));
