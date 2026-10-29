// TapeOut promo film — deterministic Canvas 2D renderer.
// drawFrame(ctx, t, lang, opts) paints the frame at time t (seconds); nothing depends on wall-clock time,
// so the same call gives the same pixels in the live preview and in the offline MP4 render.
(function () {
  'use strict';

  const W = 1920, H = 1080;
  const DURATION = 76;

  const C = {
    void: '#05070c', bg: '#080b13', bg2: '#0d1424',
    cream: '#f4f3ef', paper: '#f6f5f1', panel: '#ffffff', line: '#e3e1da', chip: '#efede6',
    ink: '#1d1d1b', muted: '#6b6a66', faint: '#a9a7a0',
    teal: '#19b394', tealHi: '#5fe3c4', tealDeep: '#0f6b5c', navy: '#192b53',
    gold: '#f0c75e', ember: '#ff7a3d',
  };
  const SANS = '"Inter Display", "Inter", system-ui, sans-serif';
  const TEXT = '"Inter", system-ui, sans-serif';
  const MONO = '"JetBrains Mono", ui-monospace, monospace';

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const env = (t, a, b, fi = 0.5, fo = 0.5) => Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));
  const E = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
    outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
    outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  };
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const mixHex = (h1, h2, t) => {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
    const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
    const bl = Math.round(lerp(a & 255, b & 255, t));
    return `rgb(${r},${g},${bl})`;
  };

  // ---------- drawing helpers ----------
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function font(ctx, weight, size, family = SANS) { ctx.font = `${weight} ${size}px ${family}`; }

  // Per-character staggered reveal: each glyph rises out of a mask line.
  function revealText(ctx, str, x, y, p, o = {}) {
    const size = o.size || 96, weight = o.weight || 600, fam = o.family || SANS;
    const ls = o.ls || 0, align = o.align || 'center', color = o.color || C.cream;
    const out = o.out || 0; // 0..1 exit progress
    font(ctx, weight, size, fam);
    ctx.letterSpacing = ls + 'px';
    const chars = Array.from(str);
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const n = chars.length, st = o.stagger ?? 0.5;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    if (o.mask !== false) {
      ctx.beginPath();
      ctx.rect(cx - 40, y - size * 1.1, total + 80, size * 1.42);
      ctx.clip();
    }
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0;
      const pi = E.outExpo(clamp((p - k * st) / (1 - st)));
      const po = E.inCubic(clamp((out - k * st * 0.6) / (1 - st * 0.6)));
      const dy = (1 - pi) * size * 1.05 - po * size * 1.05;
      ctx.globalAlpha = (o.alpha ?? 1) * clamp(pi * 1.4) * (1 - po);
      ctx.fillStyle = color;
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 30; }
      ctx.fillText(chars[i], cx, y + dy);
      cx += widths[i];
    }
    ctx.restore();
    ctx.letterSpacing = '0px';
    return total;
  }

  // Monospace "decode" text: characters scramble then settle.
  const GLYPHS = '01#$%&*+<>=/\\|ABCDEF0123456789';
  function decodeText(ctx, str, x, y, p, o = {}) {
    const size = o.size || 22;
    font(ctx, o.weight || 500, size, MONO);
    ctx.letterSpacing = (o.ls ?? 4) + 'px';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    const chars = Array.from(str);
    const shown = Math.floor(chars.length * clamp(p * 1.15));
    const r = rng(o.seed || 7 + Math.floor((o.t || 0) * 24));
    let s = '';
    for (let i = 0; i < chars.length; i++) {
      if (i < shown) s += chars[i];
      else if (i < shown + 4 && p > 0) s += chars[i] === ' ' ? ' ' : GLYPHS[Math.floor(r() * GLYPHS.length)];
    }
    ctx.globalAlpha = (o.alpha ?? 1) * clamp(p * 4);
    ctx.fillStyle = o.color || C.teal;
    ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
    ctx.letterSpacing = '0px';
  }

  // Headline block (kicker + big title), left or centered.
  function headline(ctx, t, a, b, kicker, title, x, y, o = {}) {
    if (t < a || t > b + 1) return;
    const p = seg(t, a, a + 1.4), out = seg(t, b - 0.6, b);
    const align = o.align || 'left';
    const size = o.size || 110;
    ctx.save();
    ctx.globalAlpha = 1 - out;
    decodeText(ctx, (o.index ? o.index + '  —  ' : '') + kicker, x, y - size - 18, seg(t, a, a + 0.9), {
      align, size: 22, color: o.kickerColor || C.teal, t, ls: 6,
    });
    ctx.restore();
    revealText(ctx, title, x, y, p, { size, weight: 700, align, ls: o.ls ?? -2, out, color: o.color || C.cream, stagger: 0.45 });
    // underline sweep
    const lw = E.outExpo(seg(t, a + 0.3, a + 1.6)) * (1 - E.inCubic(out));
    if (lw > 0) {
      ctx.fillStyle = o.kickerColor || C.teal;
      const len = o.lineLen || 120;
      const lx = align === 'center' ? x - (len * lw) / 2 : x;
      ctx.fillRect(lx, y + 34, len * lw, 3);
    }
  }

  // ---------- NAND gate geometry ----------
  // Unit gate: body x∈[-1,1], y∈[-1,1]; bubble at x=1.18; inputs at y=±0.5; output pin at x=2.1.
  function nandBodyPath(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx - s, cy + s);
    ctx.lineTo(cx - s, cy - s);
    ctx.lineTo(cx, cy - s);
    ctx.arc(cx, cy, s, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(cx - s, cy + s);
  }
  const NAND_LEN = 4 + Math.PI;
  function drawNand(ctx, cx, cy, s, o = {}) {
    const p = o.p ?? 1;
    const lw = o.lw || Math.max(2, s * 0.06);
    ctx.save();
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.color || C.cream;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowBlur || 24; }
    if (o.fill && p >= 1) {
      nandBodyPath(ctx, cx, cy, s);
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    const L = NAND_LEN * s;
    ctx.setLineDash([L, L]);
    ctx.lineDashOffset = L * (1 - E.inOutCubic(clamp(p / 0.8)));
    nandBodyPath(ctx, cx, cy, s);
    ctx.stroke();
    ctx.setLineDash([]);
    const pb = clamp((p - 0.7) / 0.3);
    if (pb > 0) {
      ctx.beginPath();
      ctx.arc(cx + s * 1.18, cy, s * 0.18 * E.outBack(pb), 0, Math.PI * 2);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      ctx.stroke();
    }
    ctx.restore();
  }
  const nandPins = (cx, cy, s) => ({
    a: [cx - s, cy - s * 0.5], b: [cx - s, cy + s * 0.5], q: [cx + s * 1.36, cy],
  });

  // Cubic "schematic" wire between two pins; returns sampled points.
  function wirePoints(x1, y1, x2, y2, n = 40) {
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      const cx1 = x1 + dx, cx2 = x2 - dx;
      pts.push([
        v * v * v * x1 + 3 * v * v * u * cx1 + 3 * v * u * u * cx2 + u * u * u * x2,
        v * v * v * y1 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y2,
      ]);
    }
    return pts;
  }
  function strokePts(ctx, pts, p) {
    const m = Math.max(1, Math.floor((pts.length - 1) * p));
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= m; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    const f = (pts.length - 1) * p - m;
    if (m < pts.length - 1 && f > 0) {
      ctx.lineTo(lerp(pts[m][0], pts[m + 1][0], f), lerp(pts[m][1], pts[m + 1][1], f));
    }
    ctx.stroke();
  }
  function ptAt(pts, u) {
    const f = clamp(u) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
  }
  function signalDots(ctx, pts, t, color, speed = 0.7, count = 3, r = 4) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    for (let i = 0; i < count; i++) {
      const u = (t * speed + i / count) % 1;
      const [x, y] = ptAt(pts, u);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // TapeOut mark (from the site icon): two mirrored chevron frames.
  const LOGO_OUTER_L = [[0, 0], [472, 256], [472, 599], [0, 856]];
  const LOGO_INNER_L = [[41, 72], [41, 786], [431, 575], [431, 283]];
  const mirror = pts => pts.map(([x, y]) => [1020 - x, y]);
  function logoPath(ctx, x, y, s) {
    const sh = (pts) => {
      pts.forEach(([px, py], i) => {
        const X = x + (px - 510) * s, Y = y + (py - 428) * s;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      });
      ctx.closePath();
    };
    ctx.beginPath();
    sh(LOGO_OUTER_L); sh(LOGO_INNER_L); sh(mirror(LOGO_OUTER_L)); sh(mirror(LOGO_INNER_L));
  }
  function drawLogo(ctx, x, y, s, color, draw = 1, fill = 1) {
    ctx.save();
    if (draw > 0) {
      logoPath(ctx, x, y, s);
      const L = 3600 * s;
      ctx.setLineDash([L, L]);
      ctx.lineDashOffset = L * (1 - E.inOutCubic(draw));
      ctx.lineWidth = Math.max(1.5, 6 * s);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (fill > 0) {
      ctx.globalAlpha *= fill;
      logoPath(ctx, x, y, s);
      ctx.fillStyle = color;
      ctx.fill('evenodd');
    }
    ctx.restore();
  }

  // ---------- film grain + background ----------
  let grain = null;
  function makeGrain() {
    grain = [];
    for (let k = 0; k < 6; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const img = g.createImageData(256, 256);
      const r = rng(1000 + k);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(r() * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grain.push(c);
    }
  }
  function drawGrain(ctx, t, amt) {
    if (!grain) makeGrain();
    const f = Math.floor(t * 24);
    const c = grain[f % grain.length];
    const r = rng(f * 13 + 5);
    ctx.save();
    ctx.globalAlpha = amt;
    ctx.globalCompositeOperation = 'overlay';
    const ox = -Math.floor(r() * 256), oy = -Math.floor(r() * 256);
    for (let x = ox; x < W; x += 256) for (let y = oy; y < H; y += 256) ctx.drawImage(c, x, y);
    ctx.restore();
  }

  function darkBackground(ctx, t, o = {}) {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, o.center || C.bg2);
    g.addColorStop(0.55, C.bg);
    g.addColorStop(1, C.void);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // engineering grid
    const a = o.grid ?? 1;
    if (a > 0) {
      const sp = 60, off = (t * 6) % sp;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(244,243,239,0.035)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -sp + off; x < W + sp; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = -sp + off * 0.5; y < H + sp; y += sp) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(244,243,239,0.09)';
      for (let x = -sp * 4 + (off % (sp * 4)); x < W + sp; x += sp * 4)
        for (let y = -sp * 4 + ((off * 0.5) % (sp * 4)); y < H + sp; y += sp * 4) ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.restore();
    }
  }
  function vignette(ctx, amt = 0.65) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${amt})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Anamorphic light streak.
  function flare(ctx, x, y, w, a, color = C.tealHi) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, hexA(color, 0));
    g.addColorStop(0.5, hexA(color, 0.9 * a));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y - 1.5, w, 3);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 140);
    rg.addColorStop(0, hexA('#ffffff', 0.9 * a));
    rg.addColorStop(0.2, hexA(color, 0.35 * a));
    rg.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(x - 140, y - 140, 280, 280);
    ctx.restore();
  }

  // ---------- HUD ----------
  const SCENE_STARTS = [0, 7, 12.5, 21, 27, 38, 47, 53.5, 66];
  function hud(ctx, t, L, alpha) {
    if (alpha <= 0) return;
    let si = 0;
    for (let i = 0; i < SCENE_STARTS.length; i++) if (t >= SCENE_STARTS[i]) si = i;
    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 1.5;
    const m = 56, k = 26;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * k); ctx.lineTo(x, y); ctx.lineTo(x + sx * k, y);
      ctx.stroke();
    });
    font(ctx, 500, 15, MONO);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = C.cream;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`TAPEOUT  ▸  ${String(si + 1).padStart(2, '0')} / ${L.scenes[si]}`, m + 40, m + 4);
    ctx.textAlign = 'right';
    const fr = Math.floor((t % 1) * 30);
    const ss = Math.floor(t);
    ctx.fillText(`TC 00:${String(Math.floor(ss / 60)).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, W - m - 40, m + 4);
    ctx.textAlign = 'left';
    ctx.fillText(L.hudLeft, m + 40, H - m - 4);
    ctx.textAlign = 'right';
    ctx.fillText('TAPEOUT.NET', W - m - 40, H - m - 4);
    // progress ticks
    ctx.globalAlpha = alpha * 0.35;
    const px = W / 2 - 120;
    for (let i = 0; i < SCENE_STARTS.length; i++) {
      ctx.fillStyle = i === si ? C.teal : C.cream;
      ctx.globalAlpha = alpha * (i === si ? 0.9 : 0.25);
      ctx.fillRect(px + i * 30, m + 2, 20, 3);
    }
    ctx.restore();
    ctx.letterSpacing = '0px';
  }

  // ---------- subtitles ----------
  function wrapLines(ctx, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    if (lines.length === 2) return lines;
    if (lines.length > 2) return lines;
    // Balance a single long line into two.
    return lines;
  }
  function balance(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return [text];
    const words = text.split(' ');
    let best = null, bestD = 1e9;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
      if (wa > maxW || wb > maxW) continue;
      const d = Math.abs(wa - wb);
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
    return best || wrapLines(ctx, text, maxW);
  }
  function subtitles(ctx, t, L, light) {
    for (const [a, b, text] of L.subs) {
      if (t < a - 0.01 || t > b) continue;
      const p = E.outCubic(seg(t, a, a + 0.35));
      const q = 1 - seg(t, b - 0.3, b);
      const al = p * q;
      font(ctx, 500, 40, TEXT);
      const lines = balance(ctx, text, 1380);
      const lh = 54;
      const baseY = H - 118 - (lines.length - 1) * lh;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = al;
      if (!light) {
        // soft backing plate keeps captions legible over bright UI shots
        const tw = Math.max(...lines.map(ln => ctx.measureText(ln).width));
        rr(ctx, W / 2 - tw / 2 - 30, baseY - 44 + (1 - p) * 14, tw + 60, lines.length * lh + 26, 16);
        ctx.fillStyle = 'rgba(5,7,12,0.62)';
        ctx.fill();
      }
      lines.forEach((ln, i) => {
        const y = baseY + i * lh + (1 - p) * 14;
        if (light) {
          ctx.fillStyle = C.ink;
        } else {
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 18;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = '#f7f6f2';
        }
        ctx.fillText(ln, W / 2, y);
      });
      ctx.restore();
    }
  }

  // =====================================================================
  // SCENE 1+2 — money tokens → transistor tiles → silicon wafer  (0 – 13)
  // =====================================================================
  const COLS = 16, ROWS = 9, TILE = 62, GAP = 24;
  const tokens = (() => {
    const r = rng(42);
    const arr = [];
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const gx = W / 2 + (i - (COLS - 1) / 2) * (TILE + GAP);
      const gy = H / 2 + (j - (ROWS - 1) / 2) * (TILE + GAP);
      arr.push({
        gx, gy, i, j,
        x: (r() - 0.5) * 2600, y: (r() - 0.5) * 1500, z: 300 + r() * 1700,
        rot: r() * Math.PI * 2, spin: (r() - 0.5) * 0.6,
        delay: r() * 1.4, morph: r() * 0.8, glyph: r() < 0.5 ? '$' : r() < 0.5 ? '€' : '¤',
        seed: r(),
      });
    }
    return arr;
  })();

  function sceneOpening(ctx, t, L) {
    darkBackground(ctx, t, { grid: seg(t, 0.6, 2.5) });
    // opening flare line
    const fl = env(t, 0.0, 1.6, 0.5, 0.9);
    flare(ctx, W / 2, H / 2, 1600 * E.outExpo(seg(t, 0.05, 1.2)), fl);

    // camera
    const zoomIn = E.inExpo(seg(t, 11.6, 13.0));
    const camS = lerp(1, 1.14, E.inOutCubic(seg(t, 7, 11.6))) * (1 + zoomIn * 9);
    const fx = W / 2, fy = H / 2; // focus on the centre die
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(camS, camS);
    ctx.translate(-fx, -fy);

    const morphT = (tk) => E.inOutQuint(seg(t, 4.9 + tk.morph * 0.6, 6.9 + tk.morph * 0.5));
    const waferR = 470;
    const waferOn = seg(t, 7.0, 8.4);
    for (const tk of tokens) {
      const appear = E.outCubic(seg(t, 0.8 + tk.delay, 2.2 + tk.delay));
      if (appear <= 0) continue;
      const m = morphT(tk);
      // drifting 3D field
      const drift = t * 18;
      const z = tk.z - drift * 2;
      const persp = 900 / (900 + z);
      const fx3 = W / 2 + (tk.x + Math.sin(t * 0.3 + tk.seed * 6) * 40) * persp;
      const fy3 = H / 2 + (tk.y + Math.cos(t * 0.25 + tk.seed * 6) * 30) * persp;
      const x = lerp(fx3, tk.gx, m), y = lerp(fy3, tk.gy, m);
      const size = lerp(TILE * 1.25 * persp * 1.6, TILE, m);
      const rot = lerp(tk.rot + t * tk.spin, 0, m);
      const dist = Math.hypot(tk.gx - W / 2, tk.gy - H / 2);
      const inWafer = dist < waferR;
      let alpha = appear * lerp(0.25 + persp * 0.9, 1, m);
      if (!inWafer) alpha *= 1 - 0.85 * waferOn;
      const sweep = clamp((t - 7.6 - (tk.gx + tk.gy - 400) / 2600 * 2.2) / 0.6);
      const lit = inWafer ? sweep : 0;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = clamp(alpha);
      const radius = lerp(size / 2, 8, m);
      rr(ctx, -size / 2, -size / 2, size, size, radius);
      ctx.fillStyle = mixHex('#1a2233', '#0f2a2a', lit);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = m < 0.5 ? hexA(C.gold, 0.55 * (1 - m * 2) + 0.15) : hexA(C.teal, 0.3 + 0.7 * lit);
      ctx.stroke();
      if (m < 0.6) {
        // coin face
        ctx.globalAlpha = clamp(alpha) * (1 - m / 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
        ctx.strokeStyle = hexA(C.gold, 0.5);
        ctx.stroke();
        font(ctx, 600, size * 0.34, TEXT);
        ctx.fillStyle = hexA(C.gold, 0.85);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tk.glyph, 0, 1);
      } else {
        // die micro-pattern
        ctx.globalAlpha = clamp(alpha) * seg(m, 0.6, 1) * (0.35 + 0.65 * lit);
        ctx.strokeStyle = lit > 0 ? hexA(C.tealHi, 0.25 + 0.5 * lit) : 'rgba(244,243,239,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const q = size * 0.3;
        for (let k = -2; k <= 2; k++) { ctx.moveTo(-q, k * q * 0.35); ctx.lineTo(q * (0.3 + ((tk.seed * 7 + k) % 1) * 0.7), k * q * 0.35); }
        ctx.stroke();
        if (lit > 0.9) {
          ctx.globalAlpha = (lit - 0.9) * 10 * (0.5 + 0.5 * Math.sin(t * 3 + tk.seed * 20));
          ctx.fillStyle = C.tealHi;
          ctx.fillRect(q * 0.55, -q * 0.75, 4, 4);
        }
      }
      ctx.restore();
    }
    // wafer outline with flat notch
    if (waferOn > 0) {
      const pr = E.inOutCubic(seg(t, 7.0, 9.0));
      ctx.save();
      ctx.strokeStyle = hexA(C.tealHi, 0.55);
      ctx.lineWidth = 2;
      ctx.shadowColor = C.teal;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      const a0 = Math.PI / 2 + 0.16;
      ctx.arc(W / 2, H / 2, waferR + 18, a0, a0 + (Math.PI * 2 - 0.32) * pr);
      ctx.stroke();
      ctx.globalAlpha = 0.35 * pr;
      ctx.setLineDash([2, 10]);
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, waferR + 46, 0, Math.PI * 2 * pr);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // headline over the wafer
    if (t > 8.0 && t < 12.2) {
      ctx.save();
      ctx.globalAlpha = 0.55 * env(t, 8.0, 12.0, 0.8, 0.6);
      ctx.fillStyle = C.void;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      headline(ctx, t, 8.1, 11.9, L.opening.kicker, L.opening.title, W / 2, H / 2 + 40, {
        align: 'center', size: 128, lineLen: 160, ls: -3,
      });
    }
    // white-out into the die
    const wo = seg(t, 12.4, 13.0);
    if (wo > 0) {
      ctx.fillStyle = hexA('#0a1916', wo);
      ctx.fillRect(0, 0, W, H);
    }
  }

  // =====================================================================
  // SCENE 3+4 — NAND gate, truth table, 7 bytes, LATCH  (12.5 – 27.2)
  // =====================================================================
  const TRUTH = [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
  function sceneGate(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0c1a1c' });
    const inA = seg(t, 12.5, 13.3);
    // giant outline word
    ctx.save();
    ctx.globalAlpha = 0.07 * inA * (1 - seg(t, 20.6, 21.4));
    font(ctx, 800, 420, SANS);
    ctx.letterSpacing = '-10px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2;
    ctx.strokeText('NAND', W / 2 + 80 - t * 12, H / 2);
    ctx.restore();
    ctx.letterSpacing = '0px';
    ctx.save();
    ctx.globalAlpha = 0.07 * seg(t, 21, 22);
    font(ctx, 800, 420, SANS);
    ctx.letterSpacing = '-10px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2;
    ctx.strokeText('LATCH', W / 2 + 200 - (t - 21) * 14, H / 2);
    ctx.restore();
    ctx.letterSpacing = '0px';

    // gate transform: centre → left & smaller for latch
    const mv = E.inOutCubic(seg(t, 21.0, 22.2));
    const gx = lerp(840, 520, mv), gy = lerp(520, 470, mv), s = lerp(118, 82, mv);
    const drawP = seg(t, 12.7, 14.6);

    // current truth row
    const rowT = t - 14.6;
    const row = rowT < 0 ? -1 : Math.floor(rowT / 1.25) % 4;
    let A = 0, B = 0, Q = 1;
    if (t >= 21.0) { A = 1; B = Math.floor((t - 21) / 1.0) % 2; Q = A && B ? 0 : 1; }
    else if (row >= 0) [A, B, Q] = TRUTH[row];
    const pins = nandPins(gx, gy, s);
    const wires = [
      { pts: wirePoints(gx - s * 3.1, pins.a[1], pins.a[0], pins.a[1], 12), v: A, lab: 'A' },
      { pts: wirePoints(gx - s * 3.1, pins.b[1], pins.b[0], pins.b[1], 12), v: B, lab: 'B' },
      { pts: wirePoints(pins.q[0], gy, gx + s * 3.0, gy, 12), v: Q, lab: 'Q', out: true },
    ];
    const wireP = E.outCubic(seg(t, 13.6, 14.8));
    ctx.save();
    ctx.lineCap = 'round';
    for (const w of wires) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = w.v && t > 14.6 ? C.teal : 'rgba(244,243,239,0.35)';
      if (w.v && t > 14.6) { ctx.shadowColor = C.teal; ctx.shadowBlur = 18; } else ctx.shadowBlur = 0;
      strokePts(ctx, w.pts, wireP);
      if (w.v && t > 14.8) signalDots(ctx, w.pts, t, C.tealHi, 1.2, 2, 5);
      // terminals
      const end = w.out ? w.pts[w.pts.length - 1] : w.pts[0];
      ctx.shadowBlur = 0;
      ctx.globalAlpha = wireP;
      ctx.beginPath();
      ctx.arc(end[0], end[1], 26, 0, Math.PI * 2);
      ctx.fillStyle = w.v && t > 14.6 ? hexA(C.teal, 0.2) : 'rgba(244,243,239,0.05)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = w.v && t > 14.6 ? C.tealHi : 'rgba(244,243,239,0.4)';
      ctx.stroke();
      font(ctx, 600, 26, MONO);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t > 14.6 ? String(w.v) : '·', end[0], end[1] + 1);
      font(ctx, 500, 18, MONO);
      ctx.fillStyle = hexA(C.cream, 0.5);
      ctx.fillText(w.lab, end[0], end[1] - 50);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    drawNand(ctx, gx, gy, s, {
      p: drawP, lw: 6, color: C.cream, glow: hexA(C.teal, 0.6), glowBlur: 30, fill: hexA('#0d1f22', 0.92),
    });
    if (drawP > 0.95) {
      ctx.save();
      ctx.globalAlpha = seg(t, 14.4, 15.0);
      font(ctx, 700, 34, SANS);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NAND', gx - s * 0.1, gy + 2);
      ctx.restore();
    }

    // truth table
    const tt = env(t, 14.2, 21.3, 0.6, 0.6);
    if (tt > 0) {
      const tx = 1340, ty = 330;
      ctx.save();
      ctx.globalAlpha = tt;
      ctx.translate((1 - E.outCubic(seg(t, 14.2, 15.0))) * 60, 0);
      rr(ctx, tx - 30, ty - 70, 360, 380, 18);
      ctx.fillStyle = 'rgba(13,22,32,0.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,243,239,0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      font(ctx, 500, 18, MONO);
      ctx.letterSpacing = '4px';
      ctx.fillStyle = hexA(C.cream, 0.5);
      ctx.textAlign = 'left';
      ctx.fillText('A   B   →   Q', tx + 22, ty - 22);
      ctx.letterSpacing = '0px';
      for (let i = 0; i < 4; i++) {
        const yy = ty + 20 + i * 70;
        const on = i === row && t < 21;
        const ap = E.outCubic(seg(t, 14.4 + i * 0.12, 15.0 + i * 0.12));
        ctx.globalAlpha = tt * ap;
        if (on) {
          rr(ctx, tx - 8, yy - 6, 316, 58, 10);
          ctx.fillStyle = hexA(C.teal, 0.18);
          ctx.fill();
          ctx.strokeStyle = hexA(C.teal, 0.8);
          ctx.stroke();
        }
        font(ctx, 600, 32, MONO);
        ctx.fillStyle = on ? C.cream : hexA(C.cream, 0.55);
        const [a, b, q] = TRUTH[i];
        ctx.fillText(String(a), tx + 22, yy + 34);
        ctx.fillText(String(b), tx + 86, yy + 34);
        ctx.fillStyle = on ? C.tealHi : hexA(C.cream, 0.4);
        ctx.fillText('→', tx + 150, yy + 34);
        ctx.fillStyle = q ? (on ? C.tealHi : hexA(C.teal, 0.8)) : on ? C.ember : hexA(C.cream, 0.55);
        ctx.fillText(String(q), tx + 236, yy + 34);
      }
      ctx.restore();
    }

    // headline
    headline(ctx, t, 13.0, 20.7, L.nand.kicker, 'NAND', 160, 240, { size: 96, index: '01' });

    // token = transistor tag + 7 bytes
    const tg = env(t, 16.9, 20.9, 0.5, 0.5);
    if (tg > 0) {
      const bx = 380, by = 730;
      ctx.save();
      ctx.globalAlpha = tg;
      decodeText(ctx, L.nand.tokenTag + '   ·   ' + L.nand.erc, bx, by - 34, seg(t, 16.9, 17.8), { size: 20, t, color: C.tealHi });
      const hex = ['4E', '41', '4E', '44', '00', '01', 'FF'];
      for (let i = 0; i < 7; i++) {
        const ap = E.outBack(seg(t, 17.2 + i * 0.09, 17.7 + i * 0.09));
        const x = bx + i * 78;
        ctx.save();
        ctx.translate(x + 33, by + 33);
        ctx.scale(ap, ap);
        rr(ctx, -33, -33, 66, 66, 10);
        ctx.fillStyle = 'rgba(25,179,148,0.10)';
        ctx.fill();
        ctx.strokeStyle = hexA(C.teal, 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const settled = t > 17.9 + i * 0.1;
        const r = rng(Math.floor(t * 20) + i * 31);
        font(ctx, 600, 24, MONO);
        ctx.fillStyle = C.cream;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(settled ? hex[i] : GLYPHS[Math.floor(r() * 16) + 15] + GLYPHS[Math.floor(r() * 16) + 15], 0, 1);
        ctx.restore();
      }
      font(ctx, 700, 26, MONO);
      ctx.letterSpacing = '4px';
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'left';
      ctx.globalAlpha = tg * seg(t, 18.2, 18.7);
      ctx.fillText('= ' + L.nand.bytes, bx + 7 * 78 + 16, by + 42);
      ctx.restore();
      ctx.letterSpacing = '0px';
    }

    // ----- LATCH -----
    const la = seg(t, 21.4, 22.6);
    if (la > 0) {
      const lx = 1260, ly = 470, lw = 300, lh = 260;
      const ap = E.outBack(la, 1.2);
      const tick = Math.floor((t - 21) / 1.0);
      const phase = ((t - 21) % 1.0);
      const Qv = tick % 2; // latched bit toggles on each tick
      // wire NAND → LATCH D
      const wp = wirePoints(gx + s * 3.0, gy, lx - lw / 2, ly - 60, 30);
      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = Q ? C.teal : 'rgba(244,243,239,0.35)';
      if (Q) { ctx.shadowColor = C.teal; ctx.shadowBlur = 16; }
      strokePts(ctx, wp, E.outCubic(seg(t, 21.8, 22.8)));
      ctx.restore();
      if (Q && t > 22.8) signalDots(ctx, wp, t, C.tealHi, 1.1, 2, 4);
      // clock wire
      const cp = wirePoints(lx - lw / 2 - 260, ly + 70, lx - lw / 2, ly + 70, 10);
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = phase < 0.15 ? C.gold : 'rgba(244,243,239,0.3)';
      strokePts(ctx, cp, E.outCubic(seg(t, 22.0, 22.8)));
      ctx.restore();

      ctx.save();
      ctx.translate(lx, ly);
      ctx.scale(ap, ap);
      // memory glow
      const pulse = Math.exp(-phase * 5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 320);
      rg.addColorStop(0, hexA(Qv ? C.teal : C.gold, 0.22 * (0.5 + pulse)));
      rg.addColorStop(1, hexA(C.teal, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(-320, -320, 640, 640);
      ctx.restore();
      rr(ctx, -lw / 2, -lh / 2, lw, lh, 22);
      ctx.fillStyle = 'rgba(13,31,34,0.95)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.cream;
      ctx.shadowColor = hexA(C.teal, 0.6);
      ctx.shadowBlur = 26;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // clock triangle
      ctx.beginPath();
      ctx.moveTo(-lw / 2, 70 - 18); ctx.lineTo(-lw / 2 + 24, 70); ctx.lineTo(-lw / 2, 70 + 18);
      ctx.lineWidth = 3;
      ctx.stroke();
      font(ctx, 600, 20, MONO);
      ctx.fillStyle = hexA(C.cream, 0.6);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('D', -lw / 2 + 18, -60);
      ctx.textAlign = 'right';
      ctx.fillText('Q', lw / 2 - 18, 0);
      font(ctx, 700, 40, SANS);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.cream;
      ctx.fillText('LATCH', 0, -10);
      // bit display flips like a split-flap
      const flip = clamp(phase / 0.18);
      ctx.save();
      ctx.translate(0, 62);
      ctx.scale(1, Math.abs(Math.cos(flip * Math.PI)) * 0.9 + 0.1);
      font(ctx, 700, 58, MONO);
      ctx.fillStyle = Qv ? C.tealHi : C.gold;
      ctx.fillText(String(flip < 0.5 ? 1 - Qv : Qv), 0, 4);
      ctx.restore();
      ctx.restore();
      // Q output wire
      const qp = wirePoints(lx + lw / 2, ly, lx + lw / 2 + 200, ly, 8);
      ctx.save();
      ctx.lineWidth = 5;
      ctx.strokeStyle = Qv ? C.teal : 'rgba(244,243,239,0.35)';
      strokePts(ctx, qp, E.outCubic(seg(t, 22.2, 23.0)));
      ctx.restore();

      // waveforms
      const wfA = env(t, 22.4, 27.0, 0.6, 0.4);
      if (wfA > 0) {
        const wx = 980, wy = 690, ww = 760;
        ctx.save();
        ctx.globalAlpha = wfA;
        font(ctx, 500, 16, MONO);
        ctx.letterSpacing = '3px';
        ctx.fillStyle = hexA(C.cream, 0.5);
        ctx.textAlign = 'right';
        ctx.fillText(L.latch.clock, wx - 20, wy + 6);
        ctx.fillText(L.latch.state, wx - 20, wy + 86);
        ctx.letterSpacing = '0px';
        ctx.beginPath();
        ctx.rect(wx, wy - 40, ww, 160);
        ctx.clip();
        const pxPerSec = 190;
        const now = t - 21;
        ctx.lineWidth = 3;
        // clock (pulse at each tick)
        ctx.strokeStyle = C.gold;
        ctx.beginPath();
        for (let x = 0; x <= ww; x += 2) {
          const tt2 = now - (ww - x) / pxPerSec;
          const ph = ((tt2 % 1) + 1) % 1;
          const y = wy + (ph < 0.15 && tt2 > 0 ? -22 : 18);
          x ? ctx.lineTo(wx + x, y) : ctx.moveTo(wx + x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = C.tealHi;
        ctx.beginPath();
        for (let x = 0; x <= ww; x += 2) {
          const tt2 = now - (ww - x) / pxPerSec;
          const q = tt2 > 0 ? Math.floor(tt2) % 2 : 0;
          const y = wy + 80 + (q ? -22 : 18);
          x ? ctx.lineTo(wx + x, y) : ctx.moveTo(wx + x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
      headline(ctx, t, 21.6, 26.8, L.latch.kicker, L.latch.title, 160, 240, { size: 96, index: '02' });
    }
    // fade toward editor
    const fo = seg(t, 26.6, 27.3);
    if (fo > 0) { ctx.fillStyle = hexA(C.void, fo * 0.7); ctx.fillRect(0, 0, W, H); }
  }

  // =====================================================================
  // SCENE 5+6 — the editor, the TAPE OUT moment  (27 – 47)
  // =====================================================================
  const WIN = { x: 210, y: 96, w: 1500, h: 750 };
  const TOP = 64, SIDE = 230, STATUS = 46;
  const CA = { x: WIN.x + SIDE, y: WIN.y + TOP }; // canvas area origin
  const GS = 30; // gate scale in editor
  const G = [
    { id: 'N1', x: 330, y: 330, t: 27.9 },
    { id: 'N2', x: 560, y: 210, t: 28.25 },
    { id: 'N3', x: 560, y: 450, t: 28.6 },
    { id: 'N4', x: 800, y: 330, t: 28.95 },
    { id: 'N5', x: 800, y: 560, t: 29.3 },
  ].map(g => ({ ...g, x: CA.x + g.x, y: CA.y + g.y }));
  const IN = { A: { x: CA.x + 90, y: CA.y + 190 }, B: { x: CA.x + 90, y: CA.y + 470 } };
  const OUT = { S: { x: CA.x + 1090, y: CA.y + 330 }, C: { x: CA.x + 1090, y: CA.y + 560 } };
  const CLICK_A = 33.6, CLICK_B = 35.2, CLICK_TAPE = 39.5;
  const TAPE_BTN = { x: WIN.x + WIN.w - 210, y: WIN.y + 13, w: 186, h: 40 };

  function logic(t) {
    const A = t >= CLICK_A ? 1 : 0, B = t >= CLICK_B ? 1 : 0;
    const n1 = A && B ? 0 : 1;
    const n2 = A && n1 ? 0 : 1;
    const n3 = n1 && B ? 0 : 1;
    const n4 = n2 && n3 ? 0 : 1;
    const n5 = n1 ? 0 : 1;
    return { A, B, N1: n1, N2: n2, N3: n3, N4: n4, N5: n5, S: n4, C: n5 };
  }
  const gp = id => G.find(g => g.id === id);
  const pinOf = (id, which) => {
    if (id === 'A' || id === 'B') return [IN[id].x + 34, IN[id].y];
    if (id === 'S' || id === 'C') return [OUT[id].x - 34, OUT[id].y];
    const g = gp(id);
    return nandPins(g.x, g.y, GS)[which];
  };
  const WIRES = [
    ['A', 'q', 'N1', 'a'], ['B', 'q', 'N1', 'b'],
    ['A', 'q', 'N2', 'a'], ['N1', 'q', 'N2', 'b'],
    ['N1', 'q', 'N3', 'a'], ['B', 'q', 'N3', 'b'],
    ['N2', 'q', 'N4', 'a'], ['N3', 'q', 'N4', 'b'],
    ['N1', 'q', 'N5', 'a'], ['N1', 'q', 'N5', 'b'],
    ['N4', 'q', 'S', 'in'], ['N5', 'q', 'C', 'in'],
  ].map(([f, fp, to, tp], i) => {
    const [x1, y1] = pinOf(f, fp), [x2, y2] = pinOf(to, tp);
    return { from: f, pts: wirePoints(x1, y1, x2, y2, 36), t0: 29.9 + i * 0.22 };
  });

  // cursor path
  const CURSOR_KEYS = [
    [32.6, W + 60, 900], [33.45, IN.A.x + 8, IN.A.y + 6], [34.2, IN.A.x + 30, IN.A.y + 90],
    [35.05, IN.B.x + 8, IN.B.y + 6], [36.2, CA.x + 620, CA.y + 640],
    [37.7, CA.x + 700, CA.y + 600], [39.3, TAPE_BTN.x + 120, TAPE_BTN.y + 24], [42, TAPE_BTN.x + 140, TAPE_BTN.y + 60],
  ];
  function cursorPos(t) {
    if (t <= CURSOR_KEYS[0][0]) return [CURSOR_KEYS[0][1], CURSOR_KEYS[0][2]];
    for (let i = 0; i < CURSOR_KEYS.length - 1; i++) {
      const [a, x1, y1] = CURSOR_KEYS[i], [b, x2, y2] = CURSOR_KEYS[i + 1];
      if (t <= b) {
        const u = E.inOutCubic(seg(t, a, b));
        // slight arc
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.12;
        const v = 1 - u;
        return [v * v * x1 + 2 * v * u * mx + u * u * x2, v * v * y1 + 2 * v * u * my + u * u * y2];
      }
    }
    const k = CURSOR_KEYS[CURSOR_KEYS.length - 1];
    return [k[1], k[2]];
  }
  function drawCursor(ctx, x, y, press) {
    ctx.save();
    ctx.translate(x, y);
    const s = 1 - press * 0.15;
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36);
    ctx.lineTo(19, 34); ctx.lineTo(13, 21); ctx.lineTo(23, 21); ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }
  function clickRipple(ctx, t, tc, x, y, color = C.teal) {
    const p = seg(t, tc, tc + 0.6);
    if (p <= 0 || p >= 1) return;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 8 + E.outCubic(p) * 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function editorWindow(ctx, t, L, o) {
    const lg = logic(t);
    const { alpha, burn } = o;
    ctx.save();
    ctx.globalAlpha = alpha;
    // window shadow + body
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 80;
    ctx.shadowOffsetY = 30;
    rr(ctx, WIN.x, WIN.y, WIN.w, WIN.h, 22);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, WIN.x, WIN.y, WIN.w, WIN.h, 22);
    ctx.clip();
    // top bar
    ctx.fillStyle = C.panel;
    ctx.fillRect(WIN.x, WIN.y, WIN.w, TOP);
    ctx.fillStyle = C.line;
    ctx.fillRect(WIN.x, WIN.y + TOP - 1, WIN.w, 1);
    drawLogo(ctx, WIN.x + 40, WIN.y + TOP / 2, 0.03, C.navy, 0, 1);
    font(ctx, 700, 21, SANS);
    ctx.fillStyle = C.ink;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('TapeOut', WIN.x + 66, WIN.y + TOP / 2 + 1);
    font(ctx, 500, 17, TEXT);
    let tx = WIN.x + 230;
    L.editor.tabs.forEach((tab, i) => {
      const w = ctx.measureText(tab).width;
      if (i === 0) {
        rr(ctx, tx - 14, WIN.y + 16, w + 28, 32, 8);
        ctx.fillStyle = C.chip;
        ctx.fill();
      }
      ctx.fillStyle = i === 0 ? C.ink : C.muted;
      ctx.fillText(tab, tx, WIN.y + TOP / 2 + 1);
      tx += w + 44;
    });
    // TAPE OUT button
    const hover = seg(t, 38.9, 39.3);
    const press = env(t, CLICK_TAPE - 0.05, CLICK_TAPE + 0.25, 0.05, 0.2);
    ctx.save();
    const b = TAPE_BTN;
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(1 - press * 0.06, 1 - press * 0.06);
    if (hover > 0) { ctx.shadowColor = hexA(C.teal, 0.7); ctx.shadowBlur = 30 * hover; }
    rr(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 10);
    ctx.fillStyle = mixHex(C.tealDeep, '#11846f', hover);
    ctx.fill();
    ctx.shadowBlur = 0;
    font(ctx, 700, 17, MONO);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('TAPE OUT  ▸', 0, 1);
    ctx.letterSpacing = '0px';
    ctx.restore();
    // sidebar
    ctx.fillStyle = C.panel;
    ctx.fillRect(WIN.x, WIN.y + TOP, SIDE, WIN.h - TOP);
    ctx.fillStyle = C.line;
    ctx.fillRect(WIN.x + SIDE - 1, WIN.y + TOP, 1, WIN.h - TOP);
    font(ctx, 600, 13, MONO);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = C.faint;
    ctx.textAlign = 'left';
    ctx.fillText(L.editor.parts, WIN.x + 26, WIN.y + TOP + 38);
    ctx.letterSpacing = '0px';
    L.editor.items.forEach((it, i) => {
      const iy = WIN.y + TOP + 64 + i * 66;
      const pulse = i === 0 ? env(t, 27.8, 29.6, 0.2, 0.4) : 0;
      rr(ctx, WIN.x + 18, iy, SIDE - 36, 54, 10);
      ctx.fillStyle = pulse > 0 ? mixHex(C.paper, '#dcebe6', pulse) : C.paper;
      ctx.fill();
      ctx.strokeStyle = pulse > 0 ? hexA(C.tealDeep, 0.5 * pulse + 0.1) : C.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (i < 2) {
        if (i === 0) drawNand(ctx, WIN.x + 50, iy + 27, 11, { color: C.ink, lw: 2 });
        else { rr(ctx, WIN.x + 38, iy + 15, 26, 24, 4); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke(); }
      } else {
        ctx.beginPath();
        ctx.arc(WIN.x + 51, iy + 27, 9, 0, Math.PI * 2);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      font(ctx, 600, 17, TEXT);
      ctx.fillStyle = C.ink;
      ctx.textBaseline = 'middle';
      ctx.fillText(it, WIN.x + 86, iy + 28);
    });
    // canvas dot grid
    ctx.fillStyle = 'rgba(29,29,27,0.12)';
    for (let x = CA.x + 20; x < WIN.x + WIN.w; x += 28)
      for (let y = CA.y + 20; y < WIN.y + WIN.h - STATUS; y += 28) ctx.fillRect(x, y, 2, 2);
    // file chip
    font(ctx, 500, 14, MONO);
    ctx.fillStyle = C.muted;
    ctx.fillText('● ' + L.editor.file + '.tape', CA.x + 24, CA.y + 30);

    // wires
    ctx.lineCap = 'round';
    for (const w of WIRES) {
      const p = E.inOutCubic(seg(t, w.t0, w.t0 + 0.5));
      if (p <= 0) continue;
      const v = lg[w.from];
      const live = t > CLICK_A - 0.2;
      ctx.save();
      ctx.globalAlpha = alpha * (1 - burn);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = v && live ? C.tealDeep : '#9d9b94';
      strokePts(ctx, w.pts, p);
      ctx.restore();
      if (v && live && p >= 1 && burn < 0.2) signalDots(ctx, w.pts, t, '#18a386', 0.9, 2, 3.5);
    }
    // gates
    for (const g of G) {
      const p = seg(t, g.t, g.t + 0.55);
      if (p <= 0) continue;
      const sc = lerp(1.6, 1, E.outBack(p, 2.2));
      const v = lg[g.id];
      ctx.save();
      ctx.globalAlpha = alpha * clamp(p * 3) * (1 - burn);
      ctx.translate(g.x, g.y);
      ctx.scale(sc, sc);
      ctx.translate(-g.x, -g.y);
      rr(ctx, g.x - GS * 1.6, g.y - GS * 1.45, GS * 3.4, GS * 2.9, 12);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = v && t > CLICK_A - 0.2 ? hexA(C.tealDeep, 0.55) : C.line;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawNand(ctx, g.x, g.y, GS, { color: C.ink, lw: 3, fill: '#fff' });
      font(ctx, 600, 11, MONO);
      ctx.fillStyle = C.faint;
      ctx.textAlign = 'center';
      ctx.fillText(g.id, g.x - 2, g.y + GS * 1.2 + 4);
      ctx.restore();
    }
    // input toggles
    ['A', 'B'].forEach((k, i) => {
      const n = IN[k];
      const p = E.outBack(seg(t, 27.7 + i * 0.15, 28.3 + i * 0.15));
      const on = lg[k];
      const flip = E.outCubic(seg(t, k === 'A' ? CLICK_A : CLICK_B, (k === 'A' ? CLICK_A : CLICK_B) + 0.25));
      ctx.save();
      ctx.globalAlpha = alpha * clamp(p) * (1 - burn);
      ctx.translate(n.x, n.y);
      ctx.scale(p, p);
      rr(ctx, -34, -22, 68, 44, 22);
      ctx.fillStyle = on ? mixHex('#d8d6cf', C.tealDeep, flip) : '#d8d6cf';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lerp(-12, 12, on ? flip : 0), 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      font(ctx, 700, 18, MONO);
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.fillText(k, -62, 1);
      ctx.restore();
    });
    // outputs
    [['S', L.editor.sum], ['C', L.editor.carry]].forEach(([k, lab], i) => {
      const n = OUT[k];
      const p = E.outBack(seg(t, 29.5 + i * 0.15, 30.1 + i * 0.15));
      const on = lg[k] && t > CLICK_A;
      ctx.save();
      ctx.globalAlpha = alpha * clamp(p) * (1 - burn);
      ctx.translate(n.x, n.y);
      ctx.scale(p, p);
      if (on) { ctx.shadowColor = hexA(C.teal, 0.9); ctx.shadowBlur = 30; }
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fillStyle = on ? C.teal : '#e7e5de';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = on ? C.tealDeep : '#c9c7c0';
      ctx.stroke();
      font(ctx, 700, 20, MONO);
      ctx.fillStyle = on ? '#fff' : C.muted;
      ctx.textAlign = 'center';
      ctx.fillText(on ? '1' : '0', 0, 1);
      font(ctx, 600, 14, MONO);
      ctx.letterSpacing = '2px';
      ctx.fillStyle = C.muted;
      ctx.fillText(lab, 0, 50);
      ctx.letterSpacing = '0px';
      ctx.restore();
    });
    // status bar
    ctx.fillStyle = C.panel;
    ctx.fillRect(WIN.x + SIDE, WIN.y + WIN.h - STATUS, WIN.w - SIDE, STATUS);
    ctx.fillStyle = C.line;
    ctx.fillRect(WIN.x + SIDE, WIN.y + WIN.h - STATUS, WIN.w - SIDE, 1);
    const gc = G.filter(g => t >= g.t).length;
    font(ctx, 500, 15, MONO);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.fillText(`${L.editor.gates}: ${gc}`, WIN.x + SIDE + 24, WIN.y + WIN.h - STATUS / 2 + 1);
    ctx.fillStyle = C.muted;
    ctx.fillText(L.editor.status, WIN.x + SIDE + 160, WIN.y + WIN.h - STATUS / 2 + 1);
    ctx.beginPath();
    ctx.arc(WIN.x + WIN.w - 40, WIN.y + WIN.h - STATUS / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = 0.5 + 0.5 * Math.sin(t * 6) > 0.3 ? '#1a7f37' : '#8fd3a5';
    ctx.fill();
    ctx.restore(); // clip
    ctx.restore();
  }

  // particles for the burn
  const BURN = (() => {
    const r = rng(77);
    const arr = [];
    for (const g of G) for (let k = 0; k < 90; k++) {
      arr.push({
        ox: g.x + (r() - 0.5) * GS * 3.2, oy: g.y + (r() - 0.5) * GS * 2.8,
        vx: (r() - 0.5) * 260, vy: -80 - r() * 260, life: 0.6 + r() * 1.2, k: r(), seed: r(),
      });
    }
    for (const w of WIRES) for (let k = 0; k < 14; k++) {
      const [x, y] = ptAt(w.pts, r());
      arr.push({ ox: x, oy: y, vx: (r() - 0.5) * 160, vy: -60 - r() * 200, life: 0.5 + r() * 1.0, k: r(), seed: r() });
    }
    return arr;
  })();
  const T_BURN = 39.75, T_GATHER = 41.2, T_CARD = 42.6;
  const CARD = { x: W / 2, y: H / 2 - 20, w: 500, h: 640 };
  function cardTarget(i, n) {
    // distribute targets along the card perimeter and its schematic
    const u = (i / n) * 2 * (CARD.w + CARD.h);
    const hw = CARD.w / 2, hh = CARD.h / 2;
    let x, y;
    if (u < CARD.w) { x = -hw + u; y = -hh; }
    else if (u < CARD.w + CARD.h) { x = hw; y = -hh + (u - CARD.w); }
    else if (u < 2 * CARD.w + CARD.h) { x = hw - (u - CARD.w - CARD.h); y = hh; }
    else { x = -hw; y = hh - (u - 2 * CARD.w - CARD.h); }
    return [CARD.x + x, CARD.y + y];
  }
  function burnParticles(ctx, t) {
    if (t < T_BURN || t > T_CARD + 0.8) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = BURN.length;
    BURN.forEach((p, i) => {
      const tb = Math.max(0, Math.min(t, T_GATHER) - T_BURN - p.k * 0.25);
      if (t < T_BURN + p.k * 0.25) return;
      const bx = p.ox + p.vx * tb * 0.6 + Math.sin(tb * 4 + p.seed * 10) * 12;
      const by = p.oy + p.vy * tb * 0.6 - tb * tb * 40;
      let x = bx, y = by;
      const gth = E.inOutCubic(seg(t, T_GATHER + p.seed * 0.3, T_CARD + p.seed * 0.2));
      if (gth > 0) {
        const [tx, ty] = cardTarget(i, n);
        x = lerp(bx, tx, gth);
        y = lerp(by, ty, gth);
      }
      const heat = clamp(tb / 1.4);
      const col = gth > 0 ? mixHex(C.ember, C.tealHi, gth) : mixHex('#ffffff', heat < 0.5 ? C.gold : C.ember, heat);
      const a = (gth > 0 ? 0.9 : 1 - heat * 0.4) * (1 - seg(t, T_CARD + 0.1, T_CARD + 0.7));
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      const sz = 2.2 + (1 - heat) * 2;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    });
    ctx.restore();
  }

  function circuitCard(ctx, t, L, o) {
    const { cx, cy, w, h, alpha, tilt, content } = o;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.transform(1, tilt * 0.08, 0, 1, 0, 0);
    ctx.scale(1 - Math.abs(tilt) * 0.12, 1);
    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.1);
    rg.addColorStop(0, hexA(C.teal, 0.25));
    rg.addColorStop(1, hexA(C.teal, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(-w * 1.2, -h, w * 2.4, h * 2);
    ctx.restore();
    rr(ctx, -w / 2, -h / 2, w, h, 28);
    const bg = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    bg.addColorStop(0, '#11202a');
    bg.addColorStop(1, '#0a1018');
    ctx.fillStyle = bg;
    ctx.fill();
    const bd = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    bd.addColorStop(0, C.tealHi);
    bd.addColorStop(0.5, hexA(C.teal, 0.3));
    bd.addColorStop(1, '#3b5ba8');
    ctx.strokeStyle = bd;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (content > 0) {
      ctx.save();
      ctx.globalAlpha = alpha * content;
      rr(ctx, -w / 2, -h / 2, w, h, 28);
      ctx.clip();
      // schematic thumbnail
      const sx = -w / 2 + 36, sy = -h / 2 + 36, sw = w - 72, sh = 250;
      rr(ctx, sx, sy, sw, sh, 16);
      ctx.fillStyle = 'rgba(25,179,148,0.07)';
      ctx.fill();
      ctx.strokeStyle = hexA(C.teal, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      const sc = 0.33;
      ctx.translate(sx + sw / 2, sy + sh / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(CA.x + 600), -(CA.y + 380));
      ctx.lineWidth = 6;
      ctx.strokeStyle = hexA(C.tealHi, 0.7);
      WIRES.forEach(wi => strokePts(ctx, wi.pts, 1));
      G.forEach(g => drawNand(ctx, g.x, g.y, GS, { color: C.cream, lw: 6 }));
      ['A', 'B'].forEach(k => { ctx.beginPath(); ctx.arc(IN[k].x, IN[k].y, 20, 0, 7); ctx.fillStyle = C.tealHi; ctx.fill(); });
      ['S', 'C'].forEach(k => { ctx.beginPath(); ctx.arc(OUT[k].x, OUT[k].y, 22, 0, 7); ctx.strokeStyle = C.cream; ctx.stroke(); });
      ctx.restore();
      // texts
      font(ctx, 600, 15, MONO);
      ctx.letterSpacing = '4px';
      ctx.fillStyle = C.tealHi;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(L.card.type, sx, sy + sh + 50);
      ctx.letterSpacing = '0px';
      font(ctx, 700, 64, MONO);
      ctx.fillStyle = C.cream;
      ctx.fillText('42.1', sx - 2, sy + sh + 118);
      font(ctx, 500, 15, MONO);
      ctx.fillStyle = hexA(C.cream, 0.45);
      ctx.fillText('TapeID', sx + 200, sy + sh + 116);
      const rows = [[L.card.gates, '5'], [L.card.burned, '5 × NAND'], [L.card.status, L.card.permanent]];
      rows.forEach(([k, v], i) => {
        const yy = sy + sh + 160 + i * 34;
        ctx.fillStyle = 'rgba(244,243,239,0.08)';
        ctx.fillRect(sx, yy - 24, sw, 1);
        font(ctx, 500, 16, TEXT);
        ctx.fillStyle = hexA(C.cream, 0.55);
        ctx.textAlign = 'left';
        ctx.fillText(k, sx, yy);
        font(ctx, 600, 16, MONO);
        ctx.fillStyle = i === 2 ? C.tealHi : C.cream;
        ctx.textAlign = 'right';
        ctx.fillText(v, sx + sw, yy);
      });
      ctx.textAlign = 'left';
      // gloss sweep
      const gs = seg(t, 43.0, 44.4);
      if (gs > 0 && gs < 1) {
        const gx = lerp(-w, w, E.inOutCubic(gs));
        const gg = ctx.createLinearGradient(gx - 120, 0, gx + 120, 0);
        gg.addColorStop(0, 'rgba(255,255,255,0)');
        gg.addColorStop(0.5, 'rgba(255,255,255,0.14)');
        gg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gg;
        ctx.save();
        ctx.transform(1, 0, -0.4, 1, 0, 0);
        ctx.fillRect(-w, -h / 2, w * 2.5, h);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function sceneEditor(ctx, t, L) {
    darkBackground(ctx, t, { center: '#101a2b' });
    const winIn = E.outQuart(seg(t, 27.0, 28.1));
    const burn = seg(t, T_BURN, T_BURN + 0.9);
    const winOut = seg(t, 40.2, 41.6);
    // window pose
    ctx.save();
    const sc = lerp(0.9, 1, winIn) * lerp(1, 1.02, seg(t, 28, 38)) * (1 - winOut * 0.08);
    ctx.translate(W / 2, H / 2 + (1 - winIn) * 140);
    ctx.scale(sc, sc);
    ctx.translate(-W / 2, -H / 2);
    if (t < 41.8) editorWindow(ctx, t, L, { alpha: winIn * (1 - winOut), burn });
    // cursor
    if (t > 32.6 && t < 40.4) {
      const [x, y] = cursorPos(t);
      const press = Math.max(env(t, CLICK_A - 0.05, CLICK_A + 0.2, 0.05, 0.15), env(t, CLICK_B - 0.05, CLICK_B + 0.2, 0.05, 0.15), env(t, CLICK_TAPE - 0.05, CLICK_TAPE + 0.2, 0.05, 0.15));
      clickRipple(ctx, t, CLICK_A, IN.A.x + 8, IN.A.y + 6);
      clickRipple(ctx, t, CLICK_B, IN.B.x + 8, IN.B.y + 6);
      clickRipple(ctx, t, CLICK_TAPE, TAPE_BTN.x + 120, TAPE_BTN.y + 24, '#ffffff');
      ctx.globalAlpha = 1 - seg(t, 39.9, 40.4);
      drawCursor(ctx, x, y, press);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // TAPE OUT impact
    const flash = env(t, CLICK_TAPE + 0.1, CLICK_TAPE + 1.0, 0.05, 0.85);
    if (flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA('#bff7ea', flash * 0.55);
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (t > CLICK_TAPE + 0.1 && t < 41.8) {
      const p = seg(t, CLICK_TAPE + 0.1, CLICK_TAPE + 0.6);
      const out = seg(t, 41.0, 41.6);
      const s = lerp(1.35, 1, E.outExpo(p));
      ctx.save();
      ctx.globalAlpha = clamp(p * 3) * (1 - out);
      ctx.translate(W / 2, H / 2);
      ctx.scale(s, s);
      font(ctx, 800, 210, SANS);
      ctx.letterSpacing = lerp(60, -4, E.outExpo(p)) + 'px';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = hexA(C.teal, 0.9);
      ctx.shadowBlur = 60;
      ctx.fillStyle = C.cream;
      ctx.fillText('TAPE OUT', 0, 0);
      ctx.restore();
      ctx.letterSpacing = '0px';
      // shock ring
      const rp = seg(t, CLICK_TAPE + 0.1, CLICK_TAPE + 1.3);
      ctx.save();
      ctx.globalAlpha = (1 - rp) * 0.8;
      ctx.strokeStyle = C.tealHi;
      ctx.lineWidth = 3 + (1 - rp) * 10;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, E.outCubic(rp) * 1100, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      flare(ctx, W / 2, H / 2, 2200, (1 - rp) * 0.9);
    }
    burnParticles(ctx, t);

    // the circuit NFT is born
    if (t > T_CARD - 0.2) {
      const ap = E.outCubic(seg(t, T_CARD - 0.2, T_CARD + 0.5));
      const tilt = Math.sin((t - T_CARD) * 0.9) * 0.25 * (1 - seg(t, 46, 47));
      const m = E.inOutQuint(seg(t, 47.0, 48.2)); // morph into chip (scene 7)
      const w = lerp(CARD.w, 230, m), h = lerp(CARD.h, 230, m);
      if (t < 48.3) {
        circuitCard(ctx, t, L, { cx: CARD.x, cy: lerp(CARD.y, H / 2, m), w, h, alpha: ap, tilt: tilt * (1 - m), content: ap * (1 - seg(t, 46.9, 47.4)) });
      }
      // keyword chips
      L.card.chips.forEach((c, i) => {
        const a = env(t, 43.8 + i * 0.35, 46.9, 0.5, 0.5);
        if (a <= 0) return;
        const left = i === 1;
        const x = left ? CARD.x - CARD.w / 2 - 70 : CARD.x + CARD.w / 2 + 70;
        const y = CARD.y - 170 + i * 170;
        const d = (1 - E.outCubic(seg(t, 43.8 + i * 0.35, 44.4 + i * 0.35))) * 40;
        ctx.save();
        ctx.globalAlpha = a;
        font(ctx, 600, 22, MONO);
        ctx.letterSpacing = '5px';
        const tw = ctx.measureText(c).width + 56;
        const bx = left ? x - tw - d : x + d;
        rr(ctx, bx, y - 28, tw, 56, 28);
        ctx.fillStyle = 'rgba(25,179,148,0.12)';
        ctx.fill();
        ctx.strokeStyle = hexA(C.teal, 0.8);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = C.cream;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(c, bx + 28, y + 1);
        // connector line to card
        ctx.strokeStyle = hexA(C.teal, 0.4);
        ctx.beginPath();
        if (left) { ctx.moveTo(bx + tw, y); ctx.lineTo(CARD.x - CARD.w / 2, y); }
        else { ctx.moveTo(bx, y); ctx.lineTo(CARD.x + CARD.w / 2, y); }
        ctx.stroke();
        ctx.restore();
        ctx.letterSpacing = '0px';
      });
    }
  }

  // =====================================================================
  // SCENE 7 — black boxes compose into bigger chips  (47 – 53.8)
  // =====================================================================
  const CHIP_RING = [
    [-330, -190, '17.3'], [0, -250, '88.1'], [330, -190, '5.2'],
    [-380, 60, '120.4'], [380, 60, '9.1'], [-170, 215, '61.7'], [170, 215, '33.2'],
  ];
  function chip(ctx, x, y, s, label, o = {}) {
    const a = o.alpha ?? 1;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    const pins = o.pins ?? 4;
    ctx.strokeStyle = o.pinColor || hexA(C.cream, 0.6);
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    for (let i = 0; i < pins; i++) {
      const u = -s / 2 + (s / (pins + 1)) * (i + 1);
      const L2 = s * 0.14 * (o.pinP ?? 1);
      ctx.moveTo(-s / 2, u); ctx.lineTo(-s / 2 - L2, u);
      ctx.moveTo(s / 2, u); ctx.lineTo(s / 2 + L2, u);
      ctx.moveTo(u, -s / 2); ctx.lineTo(u, -s / 2 - L2);
      ctx.moveTo(u, s / 2); ctx.lineTo(u, s / 2 + L2);
    }
    ctx.stroke();
    rr(ctx, -s / 2, -s / 2, s, s, s * 0.1);
    const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    g.addColorStop(0, o.hi ? '#143a36' : '#161d2b');
    g.addColorStop(1, '#0a0e16');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = o.hi ? C.tealHi : hexA(C.cream, 0.35);
    ctx.lineWidth = Math.max(1, s * 0.012);
    if (o.hi) { ctx.shadowColor = C.teal; ctx.shadowBlur = 30; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (label && s > 40) {
      font(ctx, 600, s * 0.16, MONO);
      ctx.fillStyle = o.hi ? C.tealHi : hexA(C.cream, 0.75);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 2);
      // pin-1 dot
      ctx.beginPath();
      ctx.arc(-s / 2 + s * 0.12, -s / 2 + s * 0.12, s * 0.03, 0, Math.PI * 2);
      ctx.fillStyle = hexA(C.cream, 0.5);
      ctx.fill();
    }
    ctx.restore();
  }
  const COMPOSE_WIRES = CHIP_RING.map(([x, y], i) => ({ pts: wirePoints(W / 2 + x, H / 2 + y, W / 2, H / 2, 30), t0: 49.0 + i * 0.12 }));
  function composition(ctx, t, detail) {
    // inner chips + wires + outer frame, in global coords around centre
    for (const w of COMPOSE_WIRES) {
      const p = detail ? E.inOutCubic(seg(t, w.t0, w.t0 + 0.6)) : 1;
      if (p <= 0) continue;
      ctx.save();
      ctx.strokeStyle = hexA(C.teal, 0.55);
      ctx.lineWidth = 3;
      strokePts(ctx, w.pts, p);
      ctx.restore();
      if (p >= 1) signalDots(ctx, w.pts, t, C.tealHi, 0.8, 2, 4);
    }
    CHIP_RING.forEach(([x, y, lab], i) => {
      const p = detail ? E.outBack(seg(t, 48.3 + i * 0.12, 48.9 + i * 0.12)) : 1;
      chip(ctx, W / 2 + x, H / 2 + y, 130 * p, lab, { alpha: clamp(p) });
    });
    chip(ctx, W / 2, H / 2, 230, '42.1', { hi: true, pinP: detail ? E.outCubic(seg(t, 47.8, 48.6)) : 1, pins: 5 });
    const fp = detail ? E.inOutCubic(seg(t, 50.0, 51.0)) : 1;
    if (fp > 0) {
      ctx.save();
      const fw = 1080, fh = 720;
      rr(ctx, W / 2 - fw / 2, H / 2 - fh / 2, fw, fh, 40);
      const L2 = 2 * (fw + fh);
      ctx.setLineDash([L2 * fp, L2]);
      ctx.strokeStyle = hexA(C.cream, 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = fp;
      ctx.strokeStyle = hexA(C.cream, 0.35);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 1; i < 12; i++) {
        const u = W / 2 - fw / 2 + (fw / 12) * i;
        ctx.moveTo(u, H / 2 - fh / 2); ctx.lineTo(u, H / 2 - fh / 2 - 40);
        ctx.moveTo(u, H / 2 + fh / 2); ctx.lineTo(u, H / 2 + fh / 2 + 40);
      }
      for (let i = 1; i < 8; i++) {
        const v = H / 2 - fh / 2 + (fh / 8) * i;
        ctx.moveTo(W / 2 - fw / 2, v); ctx.lineTo(W / 2 - fw / 2 - 40, v);
        ctx.moveTo(W / 2 + fw / 2, v); ctx.lineTo(W / 2 + fw / 2 + 40, v);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  function sceneCompose(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0d1a22' });
    const z = lerp(1, 0.3, E.inOutCubic(seg(t, 50.9, 53.6)));
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    // neighbouring super-chips appear as we zoom out
    const nb = seg(t, 51.3, 52.6);
    if (nb > 0) {
      const sx = 1400, sy = 960;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if (!i && !j) continue;
        const d = Math.hypot(i, j);
        const a = E.outCubic(clamp(nb * 2 - d * 0.35));
        if (a <= 0) continue;
        ctx.save();
        ctx.globalAlpha = a * 0.75;
        ctx.translate(i * sx, j * sy);
        composition(ctx, t + i * 0.3 + j * 0.7, false);
        ctx.restore();
      }
      // buses between super-chips
      ctx.save();
      ctx.globalAlpha = nb;
      ctx.strokeStyle = hexA(C.teal, 0.35);
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(W / 2 - 2 * sx, H / 2 + i * sy); ctx.lineTo(W / 2 + 2 * sx, H / 2 + i * sy);
        ctx.moveTo(W / 2 + i * sx, H / 2 - 2 * sy); ctx.lineTo(W / 2 + i * sx, H / 2 + 2 * sy);
      }
      ctx.stroke();
      ctx.restore();
    }
    composition(ctx, t, true);
    ctx.restore();
    headline(ctx, t, 48.4, 53.4, L.compose.kicker, L.compose.title, 160, 230, { size: 92, index: '03' });
    const fo = seg(t, 53.2, 53.8);
    if (fo > 0) { ctx.fillStyle = hexA(C.void, fo * 0.85); ctx.fillRect(0, 0, W, H); }
  }

  // =====================================================================
  // SCENE 8 — protocol pillars  (53.5 – 66.3)
  // =====================================================================
  const PCARD = { y: 240, w: 500, h: 600, gap: 50 };
  const PFOCUS = [[54.0, 58.0], [58.0, 62.0], [62.0, 65.6]];
  function pillarIllustration(ctx, i, t, x, y, w, h, focus, L) {
    const lt = t - PFOCUS[i][0];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (i === 0) {
      // processor chip + mint ring + tokens flowing to creator
      const cx = x + w / 2 - 70, cy = y + h / 2 + 4;
      chip(ctx, cx, cy, 120, 'CPU', { hi: focus > 0.5, pins: 4 });
      const prog = clamp(0.18 + Math.max(0, lt) * 0.17 * focus + 0.0);
      ctx.save();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(244,243,239,0.1)';
      ctx.beginPath(); ctx.arc(cx, cy, 104, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = C.tealHi;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, 104, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
      ctx.restore();
      font(ctx, 600, 15, MONO);
      ctx.fillStyle = hexA(C.cream, 0.6);
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(prog * 100)}% ${L.pillarUi.minted}`, cx, cy + 140);
      // wallet
      const wx = x + w - 70, wy = cy;
      rr(ctx, wx - 34, wy - 26, 68, 52, 10);
      ctx.strokeStyle = focus > 0.5 ? C.gold : hexA(C.cream, 0.4);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath(); ctx.arc(wx + 18, wy, 5, 0, 7); ctx.fillStyle = C.gold; ctx.fill();
      // flowing mint payments
      for (let k = 0; k < 5; k++) {
        const u = ((t * 0.7 + k / 5) % 1);
        const px = lerp(cx + 110, wx - 40, u), py = cy + Math.sin(u * Math.PI) * -40;
        ctx.globalAlpha = focus * Math.sin(u * Math.PI);
        ctx.fillStyle = C.gold;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      font(ctx, 600, 13, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.gold, 0.8);
      ctx.fillText(L.pillarUi.mint, (cx + wx) / 2 + 20, cy - 56);
      ctx.letterSpacing = '0px';
    } else if (i === 1) {
      // bid depth bars + traded circuit cards
      const bx = x + 40, by = y + h - 40, n = 14, bw = (w - 80) / n;
      for (let k = 0; k < n; k++) {
        const v = 0.25 + 0.6 * Math.abs(Math.sin(k * 1.7 + 1)) * (0.75 + 0.25 * Math.sin(t * 2 + k));
        const hh = v * (h - 120) * (0.4 + 0.6 * focus);
        ctx.fillStyle = k < n / 2 ? hexA(C.teal, 0.25 + 0.4 * focus) : 'rgba(244,243,239,0.08)';
        ctx.fillRect(bx + k * bw + 3, by - hh, bw - 6, hh);
      }
      font(ctx, 600, 13, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.tealHi, 0.8);
      ctx.textAlign = 'left';
      ctx.fillText(L.pillarUi.bids, bx, y + 34);
      ctx.letterSpacing = '0px';
      // a circuit card swapping hands
      const u = E.inOutCubic(((Math.max(0, lt) * 0.45) % 1));
      const cx = lerp(x + 120, x + w - 120, focus > 0 ? u : 0);
      ctx.save();
      ctx.translate(cx, y + h / 2 - 20);
      ctx.rotate(Math.sin(u * Math.PI) * 0.12);
      rr(ctx, -55, -70, 110, 140, 12);
      ctx.fillStyle = '#11202a';
      ctx.fill();
      ctx.strokeStyle = C.tealHi;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawNand(ctx, -6, -20, 20, { color: C.cream, lw: 3 });
      font(ctx, 700, 20, MONO);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'center';
      ctx.fillText('42.1', 0, 42);
      ctx.restore();
    } else {
      // hashrate bars, one optimal glowing gold, BEM coins rising
      const n = 5, bw = 56, gap = 24, total = n * bw + (n - 1) * gap;
      const bx = x + (w - total) / 2, by = y + h - 50;
      const vals = [0.38, 0.46, 0.42, 0.92, 0.5];
      for (let k = 0; k < n; k++) {
        const opt = k === 3;
        const grow = E.outCubic(clamp(0.45 + focus * 0.8 - k * 0.05));
        const hh = vals[k] * (h - 120) * grow * (opt ? 1 : 0.95 + 0.05 * Math.sin(t * 3 + k));
        if (opt) { ctx.shadowColor = C.gold; ctx.shadowBlur = 30 * focus; }
        ctx.fillStyle = opt ? hexA(C.gold, 0.35 + 0.55 * focus) : 'rgba(244,243,239,0.16)';
        rr(ctx, bx + k * (bw + gap), by - hh, bw, hh, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (opt && focus > 0.3) {
          font(ctx, 700, 14, MONO);
          ctx.letterSpacing = '2px';
          ctx.fillStyle = C.gold;
          ctx.textAlign = 'center';
          ctx.globalAlpha = focus;
          ctx.fillText(L.pillarUi.optimal, bx + k * (bw + gap) + bw / 2, by - hh - 18);
          ctx.globalAlpha = 1;
          ctx.letterSpacing = '0px';
          for (let c = 0; c < 6; c++) {
            const uu = ((t * 0.5 + c / 6) % 1);
            const px = bx + k * (bw + gap) + bw / 2 + Math.sin(c * 2.3 + t) * 30;
            const py = by - hh - 40 - uu * 120;
            ctx.globalAlpha = focus * Math.sin(uu * Math.PI);
            ctx.beginPath(); ctx.arc(px, py, 7, 0, 7);
            ctx.fillStyle = C.gold; ctx.fill();
            font(ctx, 700, 8, MONO);
            ctx.fillStyle = '#2a1e00';
            ctx.fillText('B', px, py + 3);
          }
          ctx.globalAlpha = 1;
        }
      }
      font(ctx, 600, 13, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.cream, 0.5);
      ctx.textAlign = 'left';
      ctx.fillText(L.pillarUi.hash, x + 40, y + 34);
      ctx.letterSpacing = '0px';
    }
    ctx.restore();
  }
  function scenePillars(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0f1726' });
    const totalW = 3 * PCARD.w + 2 * PCARD.gap;
    const x0 = (W - totalW) / 2;
    const exit = E.inCubic(seg(t, 65.4, 66.2));
    L.pillars.forEach((pl, i) => {
      const ap = E.outQuart(seg(t, 53.6 + i * 0.18, 54.6 + i * 0.18));
      const [fa, fb] = PFOCUS[i];
      let focus = env(t, fa, fb + 0.3, 0.5, 0.5);
      if (t > 65.3) focus = Math.max(focus, seg(t, 65.0, 65.5));
      const x = x0 + i * (PCARD.w + PCARD.gap);
      const y = PCARD.y + (1 - ap) * 120 - focus * 14 - exit * 60;
      ctx.save();
      ctx.globalAlpha = ap * (0.45 + 0.55 * Math.max(focus, t < 54.2 ? 1 : 0)) * (1 - exit);
      if (focus > 0) { ctx.shadowColor = hexA(i === 2 ? C.gold : C.teal, 0.5 * focus); ctx.shadowBlur = 60 * focus; }
      rr(ctx, x, y, PCARD.w, PCARD.h, 26);
      const g = ctx.createLinearGradient(x, y, x, y + PCARD.h);
      g.addColorStop(0, '#121b2b');
      g.addColorStop(1, '#0a0f19');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = focus > 0 ? hexA(i === 2 ? C.gold : C.teal, 0.25 + 0.6 * focus) : 'rgba(244,243,239,0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      pillarIllustration(ctx, i, t, x + 20, y + 20, PCARD.w - 40, 330, focus, L);
      ctx.fillStyle = 'rgba(244,243,239,0.08)';
      ctx.fillRect(x + 40, y + 372, PCARD.w - 80, 1);
      font(ctx, 600, 16, MONO);
      ctx.letterSpacing = '4px';
      ctx.fillStyle = i === 2 ? C.gold : C.tealHi;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('0' + (i + 1), x + 40, y + 420);
      ctx.letterSpacing = '0px';
      font(ctx, 700, 44, SANS);
      ctx.letterSpacing = '-1px';
      ctx.fillStyle = C.cream;
      ctx.fillText(pl.title, x + 40, y + 476);
      ctx.letterSpacing = '0px';
      font(ctx, 400, 20, TEXT);
      ctx.fillStyle = hexA(C.cream, 0.66);
      pl.body.forEach((ln, k) => {
        // shrink long lines to fit the card
        let size = 20;
        font(ctx, 400, size, TEXT);
        while (ctx.measureText(ln).width > PCARD.w - 80 && size > 14) { size--; font(ctx, 400, size, TEXT); }
        ctx.fillText(ln, x + 40, y + 520 + k * 30);
      });
      ctx.restore();
    });
    // section kicker
    ctx.save();
    ctx.globalAlpha = 1 - exit;
    decodeText(ctx, '04  —  TAPEOUT PROTOCOL', W / 2, 170, seg(t, 53.8, 54.8), { align: 'center', size: 20, ls: 6, t, color: C.teal });
    ctx.restore();
  }

  // =====================================================================
  // SCENE 9 — brand finale on cream  (66 – 76)
  // =====================================================================
  function sceneFinale(ctx, t, L) {
    // dark underneath, cream circle wipe
    darkBackground(ctx, t, { center: '#0f1726' });
    const wp = E.inOutCubic(seg(t, 66.0, 67.1));
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, wp * 1200, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    // subtle drafting grid on paper
    ctx.strokeStyle = 'rgba(29,29,27,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // concentric circuit traces
    ctx.strokeStyle = hexA(C.tealDeep, 0.12);
    for (let k = 0; k < 4; k++) {
      const pr = E.inOutCubic(seg(t, 66.6 + k * 0.15, 68.2 + k * 0.15));
      ctx.beginPath();
      ctx.arc(W / 2, H / 2 - 30, 300 + k * 90, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pr);
      ctx.stroke();
    }
    ctx.restore();
    // ring edge of the wipe
    if (wp > 0 && wp < 1) {
      ctx.save();
      ctx.strokeStyle = C.tealHi;
      ctx.lineWidth = 6;
      ctx.shadowColor = C.teal;
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, wp * 1200, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // logo
    const draw = seg(t, 66.9, 68.3);
    const fill = E.outCubic(seg(t, 68.0, 68.7));
    const slide = E.inOutCubic(seg(t, 68.7, 69.7));
    const ls = 0.19;
    font(ctx, 700, 150, SANS);
    ctx.letterSpacing = '-5px';
    const wordW = ctx.measureText('TapeOut').width;
    ctx.letterSpacing = '0px';
    const gap = 44;
    const logoW = 1020 * ls;
    const groupW = logoW + gap + wordW;
    const lx = lerp(W / 2, W / 2 - groupW / 2 + logoW / 2, slide);
    const ly = H / 2 - 60;
    const popS = 1 + 0.06 * Math.sin(seg(t, 68.0, 68.6) * Math.PI);
    if (draw > 0) drawLogo(ctx, lx, ly, ls * popS, C.navy, draw, fill);
    // wordmark wipes out from behind the logo
    if (slide > 0) {
      const wx = W / 2 - groupW / 2 + logoW + gap;
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx - 10, ly - 140, (wordW + 40) * E.outCubic(seg(t, 69.0, 70.0)), 280);
      ctx.clip();
      font(ctx, 700, 150, SANS);
      ctx.letterSpacing = '-5px';
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('TapeOut', wx + (1 - E.outCubic(seg(t, 69.0, 70.0))) * -60, ly + 6);
      ctx.restore();
      ctx.letterSpacing = '0px';
    }
    // tagline + url
    revealText(ctx, L.tagline, W / 2, ly + 170, seg(t, 69.9, 71.2), { size: 52, weight: 500, color: C.ink, ls: -1, stagger: 0.4 });
    const up = E.outBack(seg(t, 71.0, 71.7));
    if (up > 0) {
      ctx.save();
      ctx.translate(W / 2, ly + 262);
      ctx.scale(up, up);
      font(ctx, 600, 26, MONO);
      ctx.letterSpacing = '3px';
      const tw = ctx.measureText('tapeout.net').width + 72;
      rr(ctx, -tw / 2, -32, tw, 64, 32);
      ctx.fillStyle = C.tealDeep;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tapeout.net', 0, 2);
      ctx.restore();
      ctx.letterSpacing = '0px';
    }
    ctx.save();
    ctx.globalAlpha = seg(t, 71.6, 72.4) * 0.7;
    font(ctx, 500, 16, MONO);
    ctx.letterSpacing = '5px';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.fillText(L.footer, W / 2, H - 200);
    ctx.restore();
    ctx.letterSpacing = '0px';
  }

  // =====================================================================
  function drawFrame(ctx, t, lang, opts = {}) {
    const L = window.TAPEOUT_I18N[lang] || window.TAPEOUT_I18N.en;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    if (t < 13.0) sceneOpening(ctx, t, L);
    else if (t < 27.1) sceneGate(ctx, t, L);
    else if (t < 47.0) sceneEditor(ctx, t, L);
    else if (t < 53.8) {
      sceneCompose(ctx, t, L);
      // the card→chip morph overlaps the start of this scene
      if (t < 48.3) {
        const m = E.inOutQuint(seg(t, 47.0, 48.2));
        ctx.save();
        ctx.globalAlpha = 1 - seg(t, 48.0, 48.3);
        circuitCard(ctx, t, L, { cx: CARD.x, cy: lerp(CARD.y, H / 2, m), w: lerp(CARD.w, 230, m), h: lerp(CARD.h, 230, m), alpha: 1, tilt: 0, content: 1 - seg(t, 46.9, 47.4) });
        ctx.restore();
      }
    } else if (t < 66.0) scenePillars(ctx, t, L);
    else sceneFinale(ctx, t, L);

    const light = t > 66.7;
    if (!light) vignette(ctx, 0.7);
    hud(ctx, t, L, seg(t, 1.2, 2.4) * (1 - seg(t, 65.6, 66.4)));
    if (opts.subtitles !== false) subtitles(ctx, t, L, light);
    drawGrain(ctx, t, light ? 0.05 : 0.09);
    // master fades
    const fin = 1 - seg(t, 0, 0.4);
    const fout = seg(t, DURATION - 0.8, DURATION);
    const k = Math.max(fin, fout);
    if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  window.TapeOutFilm = { W, H, DURATION, FPS: 60, drawFrame };
})();
