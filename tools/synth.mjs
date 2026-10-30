// Procedural synth + mixer shared by the TapeOut film soundtracks.
// createMix(duration) returns voices that write into a stereo bus, and writeWav(path) which
// runs the reverb send, master high-pass, fades, soft clip and normalisation, then saves a 48 kHz 16-bit WAV.
import { writeFileSync } from 'node:fs';

export function createMix(DUR, SR = 48000) {
  const N = Math.round(SR * DUR);
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

  function writeWav(path) {
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
    writeFileSync(path, buf);
    return peak;
  }

  return { SR, N, padNote, chord, sub, boom, noiseSwell, riser, blip, click, bell, crackle, writeWav, rnd };
}
