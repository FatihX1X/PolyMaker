// Shared motion-design toolkit for the TapeOut films (Canvas 2D, deterministic).
// Exposes window.Motion: palette, easing, text reveals, schematic wires, logo, backgrounds, HUD and subtitles.
(function () {
  'use strict';

  const W = 1920, H = 1080;
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
    const prev = ctx.globalAlpha; // respect any fade the caller already applied
    ctx.globalAlpha = prev * (o.alpha ?? 1) * clamp(p * 4);
    ctx.fillStyle = o.color || C.teal;
    ctx.fillText(s, x, y);
    ctx.globalAlpha = prev;
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
  // sceneStarts: start time of each scene, used for the HUD scene label and progress ticks.
  function hud(ctx, t, L, alpha, SCENE_STARTS) {
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

  window.Motion = {
    W, H, C, SANS, TEXT, MONO, GLYPHS, E, NAND_LEN,
    clamp, lerp, seg, env, rng, hexA, mixHex,
    rr, font, revealText, decodeText, headline,
    nandBodyPath, drawNand, nandPins, wirePoints, strokePts, ptAt, signalDots,
    logoPath, drawLogo, drawGrain, darkBackground, vignette, flare,
    hud, balance, subtitles, drawCursor, clickRipple,
  };
})();
