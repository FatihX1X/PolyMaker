// TapeOut DeWEB explainer — deterministic Canvas 2D renderer built on shared/motion.js.
// drawFrame(ctx, t, lang, opts) paints the frame at time t (seconds).
(function () {
  'use strict';

  const M = window.Motion;
  const {
    W, H, C, SANS, TEXT, MONO, E, clamp, lerp, seg, env, rng, hexA, mixHex,
    rr, font, revealText, decodeText, headline, wirePoints, strokePts, ptAt, signalDots,
    drawLogo, drawGrain, darkBackground, vignette, flare, hud, subtitles,
  } = M;

  const DURATION = 93;
  const SCENES = [0, 8, 12.6, 25.4, 34, 42.6, 55.4, 60, 64.4, 77.4, 83];
  const BLUE = '#6f8dff', RED = '#ff5a4f', GREEN = '#33d17a';

  // ---------- small icons ----------
  function check(ctx, x, y, s, color, p = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.18);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = [[-0.45, 0], [-0.12, 0.33], [0.5, -0.38]];
    ctx.beginPath();
    ctx.moveTo(x + pts[0][0] * s, y + pts[0][1] * s);
    const a = clamp(p * 2), b = clamp(p * 2 - 1);
    ctx.lineTo(x + lerp(pts[0][0], pts[1][0], a) * s, y + lerp(pts[0][1], pts[1][1], a) * s);
    if (b > 0) ctx.lineTo(x + lerp(pts[1][0], pts[2][0], b) * s, y + lerp(pts[1][1], pts[2][1], b) * s);
    ctx.stroke();
    ctx.restore();
  }
  function cross(ctx, x, y, s, color, p = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.18);
    ctx.lineCap = 'round';
    const a = clamp(p * 2), b = clamp(p * 2 - 1);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.4); ctx.lineTo(x + lerp(-0.4, 0.4, a) * s, y + lerp(-0.4, 0.4, a) * s);
    if (b > 0) { ctx.moveTo(x + s * 0.4, y - s * 0.4); ctx.lineTo(x + lerp(0.4, -0.4, b) * s, y + lerp(-0.4, 0.4, b) * s); }
    ctx.stroke();
    ctx.restore();
  }
  function lock(ctx, x, y, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.beginPath();
    ctx.arc(x, y - s * 0.15, s * 0.28, Math.PI, 0);
    ctx.stroke();
    rr(ctx, x - s * 0.42, y - s * 0.15, s * 0.84, s * 0.62, s * 0.1);
    ctx.fill();
    ctx.restore();
  }
  function walletIcon(ctx, x, y, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.08);
    rr(ctx, x - s * 0.5, y - s * 0.36, s, s * 0.72, s * 0.12);
    ctx.stroke();
    rr(ctx, x + s * 0.12, y - s * 0.12, s * 0.38, s * 0.24, s * 0.06);
    ctx.stroke();
    ctx.restore();
  }
  function gasIcon(ctx, x, y, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.08);
    rr(ctx, x - s * 0.4, y - s * 0.45, s * 0.5, s * 0.9, s * 0.06);
    ctx.stroke();
    ctx.strokeRect(x - s * 0.3, y - s * 0.33, s * 0.3, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.1, y - s * 0.2); ctx.lineTo(x + s * 0.32, y - s * 0.05);
    ctx.lineTo(x + s * 0.32, y + s * 0.3); ctx.lineTo(x + s * 0.42, y + s * 0.3); ctx.lineTo(x + s * 0.42, y - s * 0.2);
    ctx.stroke();
    ctx.restore();
  }
  function globeIcon(ctx, x, y, s, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.beginPath(); ctx.arc(x, y, s * 0.45, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.2, s * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.45, y); ctx.lineTo(x + s * 0.45, y); ctx.stroke();
    ctx.restore();
  }
  function chipLabel(ctx, x, y, text, o = {}) {
    font(ctx, o.weight || 600, o.size || 20, MONO);
    ctx.letterSpacing = (o.ls ?? 4) + 'px';
    const pad = o.pad ?? 26;
    const icon = o.icon ? 34 : 0;
    const w = ctx.measureText(text).width + pad * 2 + icon;
    const h = o.h || 52;
    const bx = o.align === 'left' ? x : x - w / 2;
    rr(ctx, bx, y - h / 2, w, h, h / 2);
    ctx.fillStyle = o.fill || hexA(C.teal, 0.12);
    ctx.fill();
    ctx.strokeStyle = o.stroke || hexA(C.teal, 0.8);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (o.icon) o.icon(bx + pad + 10, y);
    ctx.fillStyle = o.color || C.cream;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + pad + icon, y + 1);
    ctx.letterSpacing = '0px';
    return w;
  }

  // ---------- browser chrome + page mocks ----------
  function browser(ctx, x, y, w, h, o = {}) {
    const dark = !!o.dark;
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 24;
    rr(ctx, x, y, w, h, 18);
    ctx.fillStyle = dark ? '#0f1521' : C.paper;
    ctx.fill();
    ctx.restore();
    ctx.save();
    rr(ctx, x, y, w, h, 18);
    ctx.clip();
    const bar = 56;
    ctx.fillStyle = dark ? '#141c2b' : '#ffffff';
    ctx.fillRect(x, y, w, bar);
    ctx.fillStyle = dark ? 'rgba(244,243,239,0.08)' : C.line;
    ctx.fillRect(x, y + bar - 1, w, 1);
    ['#ff6159', '#ffbd2e', '#28c941'].forEach((c, i) => {
      ctx.beginPath(); ctx.arc(x + 26 + i * 22, y + bar / 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = dark ? hexA(C.cream, 0.18) : c; ctx.fill();
    });
    const ax = x + 110, aw = w - 220;
    rr(ctx, ax, y + 11, aw, bar - 22, 10);
    ctx.fillStyle = o.urlFill || (dark ? '#0b111b' : C.chip);
    ctx.fill();
    if (o.urlStroke) { ctx.strokeStyle = o.urlStroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    const stc = o.status === 'ok' ? C.tealDeep : o.status === 'bad' ? RED : C.faint;
    lock(ctx, ax + 22, y + bar / 2 + 1, 18, o.status === 'ok' && dark ? C.tealHi : stc);
    font(ctx, 500, o.urlSize || 18, MONO);
    ctx.fillStyle = o.urlColor || (dark ? C.cream : C.ink);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const url = o.url || '';
    ctx.fillText(url, ax + 44, y + bar / 2 + 1);
    if (o.caret) {
      const cw = ctx.measureText(url).width;
      if (Math.floor(o.caret * 2) % 2 === 0) { ctx.fillRect(ax + 46 + cw, y + bar / 2 - 11, 2, 22); }
    }
    if (o.badge) {
      font(ctx, 700, 13, MONO);
      ctx.letterSpacing = '2px';
      const bw = ctx.measureText(o.badge).width + 24;
      rr(ctx, ax + aw - bw - 8, y + 17, bw, bar - 34, 6);
      ctx.fillStyle = o.badgeColor || C.tealDeep;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(o.badge, ax + aw - bw + 4, y + bar / 2 + 1);
      ctx.letterSpacing = '0px';
    }
    if (o.content) o.content(x, y + bar, w, h - bar);
    ctx.restore();
    ctx.restore();
  }

  // A generic on-chain website: nav, hero, three cards. p reveals the blocks top to bottom.
  function siteMock(ctx, x, y, w, h, p = 1, accent = C.tealDeep) {
    ctx.save();
    ctx.fillStyle = '#fbfaf7';
    ctx.fillRect(x, y, w, h);
    const k = w / 1000;
    const step = (i) => E.outCubic(clamp(p * 6 - i));
    ctx.globalAlpha *= step(0);
    drawLogo(ctx, x + 50 * k, y + 40 * k, 0.03 * k, C.navy, 0, 1);
    ctx.fillStyle = C.ink;
    rr(ctx, x + 80 * k, y + 32 * k, 120 * k, 16 * k, 8 * k); ctx.fill();
    ctx.fillStyle = C.faint;
    for (let i = 0; i < 3; i++) { rr(ctx, x + w - (380 - i * 110) * k, y + 34 * k, 80 * k, 12 * k, 6 * k); ctx.fill(); }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= step(1);
    ctx.fillStyle = C.ink;
    rr(ctx, x + 50 * k, y + 120 * k, 520 * k, 46 * k, 10 * k); ctx.fill();
    rr(ctx, x + 50 * k, y + 180 * k, 380 * k, 46 * k, 10 * k); ctx.fill();
    ctx.fillStyle = C.faint;
    rr(ctx, x + 50 * k, y + 250 * k, 460 * k, 14 * k, 7 * k); ctx.fill();
    rr(ctx, x + 50 * k, y + 276 * k, 360 * k, 14 * k, 7 * k); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= step(2);
    ctx.fillStyle = accent;
    rr(ctx, x + 50 * k, y + 318 * k, 170 * k, 50 * k, 25 * k); ctx.fill();
    // hero art: concentric arcs
    ctx.strokeStyle = hexA(accent, 0.5);
    ctx.lineWidth = 3 * k;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 790 * k, y + 220 * k, (50 + i * 34) * k, 0, Math.PI * 2 * step(2)); ctx.stroke(); }
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.globalAlpha *= step(3 + i * 0.6);
      rr(ctx, x + (50 + i * 310) * k, y + 420 * k, 280 * k, 150 * k, 14 * k);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = hexA(accent, 0.8);
      rr(ctx, x + (72 + i * 310) * k, y + 444 * k, 40 * k, 40 * k, 8 * k); ctx.fill();
      ctx.fillStyle = C.faint;
      rr(ctx, x + (72 + i * 310) * k, y + 504 * k, 200 * k, 12 * k, 6 * k); ctx.fill();
      rr(ctx, x + (72 + i * 310) * k, y + 528 * k, 150 * k, 12 * k, 6 * k); ctx.fill();
      ctx.restore();
    }
  }

  function swapMock(ctx, x, y, w, h, L, evil) {
    ctx.fillStyle = '#fbfaf7';
    ctx.fillRect(x, y, w, h);
    const cw = 470, ch = 400, cx = x + w / 2 - cw / 2, cy = y + h / 2 - ch / 2;
    rr(ctx, cx, cy, cw, ch, 22);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
    font(ctx, 700, 28, SANS);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(L.trust.dapp, cx + 30, cy + 54);
    [[L.trust.from, '1.00 BNB'], [L.trust.to, evil ? '0.00' : '≈ 593.1']].forEach(([lab, v], i) => {
      const ry = cy + 80 + i * 104;
      rr(ctx, cx + 24, ry, cw - 48, 88, 14);
      ctx.fillStyle = C.chip; ctx.fill();
      font(ctx, 500, 15, TEXT);
      ctx.fillStyle = C.muted;
      ctx.fillText(lab, cx + 44, ry + 30);
      font(ctx, 600, 30, MONO);
      ctx.fillStyle = C.ink;
      ctx.fillText(v, cx + 44, ry + 70);
    });
    rr(ctx, cx + 24, cy + ch - 90, cw - 48, 62, 14);
    ctx.fillStyle = evil ? RED : C.tealDeep;
    ctx.fill();
    font(ctx, 700, 20, TEXT);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(evil ? L.trust.evilBtn : L.trust.btn, cx + cw / 2, cy + ch - 52);
  }

  // =====================================================================
  // 1 — blind trust (0 – 8)
  // =====================================================================
  const BW = { x: 470, y: 225, w: 980, h: 560 };
  function sceneTrust(ctx, t, L) {
    darkBackground(ctx, t, { center: '#131826', grid: seg(t, 0, 1.5) });
    const collapse = E.inExpo(seg(t, 7.3, 8.05));
    ctx.save();
    ctx.translate(W / 2, H / 2 - 40);
    ctx.scale(1 - collapse * 0.97, 1 - collapse * 0.97);
    ctx.translate(-W / 2, -(H / 2 - 40));
    const evil = t > 3.2;
    const glitch = env(t, 2.7, 3.8, 0.1, 0.4) + env(t, 5.6, 5.9, 0.05, 0.2) * 0.6;
    const appear = E.outQuart(seg(t, 0.3, 1.4));
    // contract (left) — verified
    const ca = E.outCubic(seg(t, 1.0, 1.8));
    if (ca > 0) {
      ctx.save();
      ctx.globalAlpha = ca;
      const cx = 230, cy = 470;
      rr(ctx, cx - 120, cy - 90, 240, 180, 18);
      ctx.fillStyle = 'rgba(15,26,30,0.9)'; ctx.fill();
      ctx.strokeStyle = hexA(GREEN, 0.7); ctx.lineWidth = 2; ctx.stroke();
      font(ctx, 600, 16, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.cream, 0.7);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(L.trust.contract, cx, cy - 40);
      ctx.letterSpacing = '0px';
      check(ctx, cx, cy + 8, 46, GREEN, seg(t, 1.4, 2.0));
      font(ctx, 600, 14, MONO);
      ctx.fillStyle = GREEN;
      ctx.fillText(L.trust.verified, cx, cy + 58);
      ctx.restore();
      // link to the browser
      ctx.save();
      ctx.globalAlpha = ca * 0.8;
      ctx.strokeStyle = hexA(GREEN, 0.5);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.moveTo(cx + 120, cy); ctx.lineTo(BW.x, cy); ctx.stroke();
      ctx.restore();
    }
    // server + DNS (right) — opaque
    const sa = E.outCubic(seg(t, 1.3, 2.1));
    if (sa > 0) {
      ctx.save();
      ctx.globalAlpha = sa;
      const sx = 1690, sy = 400;
      for (let i = 0; i < 3; i++) {
        rr(ctx, sx - 90, sy - 70 + i * 50, 180, 40, 8);
        ctx.fillStyle = '#161d2b'; ctx.fill();
        ctx.strokeStyle = evil ? hexA(RED, 0.8) : hexA(C.cream, 0.3); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(sx + 62, sy - 50 + i * 50, 5, 0, Math.PI * 2);
        ctx.fillStyle = evil ? RED : C.teal; ctx.fill();
      }
      font(ctx, 600, 16, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.cream, 0.7);
      ctx.textAlign = 'center';
      ctx.fillText(L.trust.server, sx, sy + 110);
      rr(ctx, sx - 60, sy + 150, 120, 44, 22);
      ctx.strokeStyle = evil ? hexA(RED, 0.8) : hexA(C.cream, 0.3); ctx.stroke();
      ctx.fillText(L.trust.dns, sx, sy + 173);
      ctx.letterSpacing = '0px';
      ctx.strokeStyle = evil ? hexA(RED, 0.6) : hexA(C.cream, 0.25);
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = t * 30;
      ctx.beginPath(); ctx.moveTo(sx - 90, sy - 25); ctx.lineTo(BW.x + BW.w, sy - 25); ctx.stroke();
      ctx.restore();
    }
    // the browser
    const draw = (dx, dy, tint) => {
      ctx.save();
      ctx.translate(dx, dy);
      browser(ctx, BW.x, BW.y + (1 - appear) * 60, BW.w, BW.h, {
        alpha: appear, url: evil ? 'swap.examp1e.com' : 'swap.example.com', status: evil ? 'bad' : null,
        urlColor: evil ? RED : undefined,
        content: (x, y, w, h) => swapMock(ctx, x, y, w, h, L, evil),
      });
      if (tint) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = tint;
        rr(ctx, BW.x, BW.y, BW.w, BW.h, 18);
        ctx.fill();
      }
      ctx.restore();
    };
    if (glitch > 0.02) {
      const r = rng(Math.floor(t * 30) + 3);
      draw(0, 0);
      for (let k = 0; k < 9; k++) {
        const by = BW.y + r() * BW.h, bh = 8 + r() * 60;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, by, W, bh); ctx.clip();
        draw((r() - 0.5) * 90 * glitch, 0, k % 2 ? 'rgba(255,80,80,1)' : 'rgba(80,220,255,1)');
        ctx.restore();
      }
    } else draw(0, 0);
    // warning tags
    const wa = env(t, 3.4, 7.4, 0.3, 0.3);
    if (wa > 0) {
      ctx.save();
      ctx.globalAlpha = wa;
      const sc = E.outBack(seg(t, 3.4, 3.9));
      ctx.translate(BW.x + BW.w - 40, BW.y + 100);
      ctx.scale(sc, sc);
      chipLabel(ctx, -180, 0, '⚠  ' + L.trust.tampered, { fill: RED, stroke: RED, color: '#ffffff', size: 17 });
      ctx.restore();
    }
    ctx.restore();
    headline(ctx, t, 4.6, 7.3, L.trust.unverified, L.trust.question, W / 2, 176, { align: 'center', size: 60, kickerColor: RED, lineLen: 90 });
    // collapse flash
    flare(ctx, W / 2, H / 2 - 40, 1800 * collapse, env(t, 7.6, 8.4, 0.3, 0.5));
  }

  // =====================================================================
  // 2 — DeWEB title (8 – 12.6)
  // =====================================================================
  const HEXCOLS = (() => { const r = rng(9); return Array.from({ length: 48 }, (_, i) => ({ x: 20 + i * 40, sp: 60 + r() * 120, off: r() * 1000, len: 6 + Math.floor(r() * 14) })); })();
  function sceneTitle(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0c1d22' });
    const lt = t - 8;
    // hex rain
    ctx.save();
    font(ctx, 500, 18, MONO);
    ctx.textAlign = 'center';
    const ra = env(t, 8, 12.6, 0.4, 0.6) * 0.55;
    for (const c of HEXCOLS) {
      const head = (c.off + lt * c.sp) % (H + 400) - 200;
      for (let k = 0; k < c.len; k++) {
        const y = head - k * 24;
        if (y < -20 || y > H + 20) continue;
        const r = rng(Math.floor(y / 24) * 97 + c.x + Math.floor(lt * 8));
        ctx.globalAlpha = ra * (1 - k / c.len) * (k === 0 ? 1 : 0.5);
        ctx.fillStyle = k === 0 ? C.tealHi : C.teal;
        ctx.fillText('0123456789ABCDEF'[Math.floor(r() * 16)], c.x, y);
      }
    }
    ctx.restore();
    // darken centre for legibility
    const g = ctx.createRadialGradient(W / 2, 470, 0, W / 2, 470, 700);
    g.addColorStop(0, 'rgba(5,7,12,0.85)');
    g.addColorStop(1, 'rgba(5,7,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const out = seg(t, 12.1, 12.6);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    decodeText(ctx, L.title.kicker, W / 2, 330, seg(t, 8.3, 9.4), { align: 'center', size: 24, ls: 10, t, color: C.tealHi });
    ctx.restore();
    revealText(ctx, 'DeWEB', W / 2, 540, seg(t, 8.4, 9.8), { size: 250, weight: 800, ls: -8, glow: hexA(C.teal, 0.7), glowBlur: 50, stagger: 0.35, out });
    // two layers merge into one
    const ap = E.outCubic(seg(t, 9.8, 10.5));
    const mg = E.inOutCubic(seg(t, 10.8, 11.8));
    if (ap > 0) {
      ctx.save();
      ctx.globalAlpha = ap * (1 - out);
      const bw = 640, bh = 56;
      const y1 = lerp(650, 690, mg), y2 = lerp(760, 690, mg);
      [[y1, L.title.frontend, BLUE], [y2, L.title.contracts, C.teal]].forEach(([yy, lab, col], i) => {
        ctx.globalAlpha = ap * (1 - out) * (1 - mg * 0.999 * (i === 0 ? 1 : 0));
        rr(ctx, W / 2 - bw / 2 + (1 - ap) * (i ? 80 : -80), yy - bh / 2, bw, bh, 12);
        ctx.fillStyle = hexA(col, 0.14); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
        font(ctx, 600, 20, MONO);
        ctx.letterSpacing = '6px';
        ctx.fillStyle = C.cream;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mg > 0.6 && i === 1 ? L.title.layer : lab, W / 2, yy + 1);
        ctx.letterSpacing = '0px';
      });
      if (mg > 0.95) flare(ctx, W / 2, 690, 900, env(t, 11.75, 12.4, 0.05, 0.5));
      ctx.restore();
    }
  }

  // =====================================================================
  // 3 — files → chunks → read-only contracts + SiteRegistry (12.6 – 25.4)
  // =====================================================================
  const FILES = [
    { path: '/index.html', type: 'text/html', size: '31 KB', n: 2, hash: '9f2c71e0…a41e', color: '#ff9f5a' },
    { path: '/app.js', type: 'text/javascript', size: '68 KB', n: 3, hash: '3b8de94c…07f2', color: '#f0c75e' },
    { path: '/style.css', type: 'text/css', size: '12 KB', n: 1, hash: 'c41a0b9d…5e63', color: BLUE },
    { path: '/logo.png', type: 'image/png', size: '90 KB', n: 4, hash: '7e05f3a2…b9c8', color: '#b98cff' },
  ];
  const CONT = { x: 110, y: 230, w: 470, h: 440 };
  const BLOCK = { x: 650, y: 720, w: 100, h: 92, gap: 16 };
  const CHUNKS = (() => {
    const arr = [];
    let slot = 0;
    FILES.forEach((f, fi) => {
      const t0 = 14.8 + fi * 1.5;
      for (let k = 0; k < f.n; k++) arr.push({ fi, k, slot: slot++, t0: t0 + 0.35 + k * 0.18 });
      f.t0 = t0;
      f.done = t0 + 0.35 + (f.n - 1) * 0.18 + 0.8;
    });
    return arr;
  })();
  const fileCardY = i => CONT.y + 80 + i * 86;
  const blockX = s => BLOCK.x + s * (BLOCK.w + BLOCK.gap);
  function sceneFiles(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0f1a26' });
    headline(ctx, t, 12.8, 25.0, L.files.kicker, L.files.title, CONT.x, 170, { size: 46, index: '01', lineLen: 70 });
    // container
    const ca = E.outQuart(seg(t, 12.8, 13.8));
    ctx.save();
    ctx.globalAlpha = ca;
    rr(ctx, CONT.x, CONT.y + (1 - ca) * 40, CONT.w, CONT.h, 22);
    ctx.fillStyle = 'rgba(13,22,32,0.85)'; ctx.fill();
    ctx.strokeStyle = hexA(C.teal, 0.6); ctx.lineWidth = 2; ctx.stroke();
    font(ctx, 600, 15, MONO);
    ctx.letterSpacing = '4px';
    ctx.fillStyle = C.tealHi;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(L.files.container + '  ·  4246.0', CONT.x + 26, CONT.y + 40);
    ctx.letterSpacing = '0px';
    ctx.restore();
    FILES.forEach((f, i) => {
      const a = E.outBack(seg(t, 13.2 + i * 0.18, 13.8 + i * 0.18));
      if (a <= 0) return;
      const y = fileCardY(i);
      const active = env(t, f.t0, f.done, 0.2, 0.4);
      const done = t > f.done;
      ctx.save();
      ctx.globalAlpha = clamp(a);
      ctx.translate(CONT.x + 24 + (1 - a) * -40, y);
      rr(ctx, 0, 0, CONT.w - 48, 70, 12);
      ctx.fillStyle = mixHex('#141d2c', '#173236', active);
      ctx.fill();
      ctx.strokeStyle = active > 0 ? hexA(f.color, 0.4 + 0.6 * active) : 'rgba(244,243,239,0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      rr(ctx, 16, 15, 40, 40, 8);
      ctx.fillStyle = hexA(f.color, 0.85); ctx.fill();
      font(ctx, 600, 20, MONO);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.path, 74, 27);
      font(ctx, 500, 14, MONO);
      ctx.fillStyle = hexA(C.cream, 0.5);
      ctx.fillText(`${f.type} · ${f.size}`, 74, 50);
      // chunk ticks
      for (let k = 0; k < f.n; k++) {
        const ch = CHUNKS.find(c => c.fi === i && c.k === k);
        const sent = t > ch.t0;
        rr(ctx, CONT.w - 48 - 24 - (f.n - k) * 22, 26, 16, 18, 3);
        ctx.fillStyle = sent ? hexA(f.color, 0.25) : hexA(f.color, 0.9);
        ctx.fill();
      }
      if (done) check(ctx, CONT.w - 48 - 24 - f.n * 22 - 20, 35, 18, C.tealHi, seg(t, f.done, f.done + 0.3));
      ctx.restore();
    });
    // L1 chain of blocks
    const nb = CHUNKS.length;
    const chainA = E.outCubic(seg(t, 13.6, 14.6));
    ctx.save();
    ctx.globalAlpha = chainA;
    ctx.strokeStyle = 'rgba(244,243,239,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BLOCK.x - 40, BLOCK.y + BLOCK.h / 2);
    ctx.lineTo(blockX(nb - 1) + BLOCK.w + 40, BLOCK.y + BLOCK.h / 2);
    ctx.stroke();
    font(ctx, 600, 14, MONO);
    ctx.letterSpacing = '4px';
    ctx.fillStyle = hexA(C.cream, 0.55);
    ctx.textAlign = 'left';
    ctx.fillText('L1  ·  BNB CHAIN / X LAYER', BLOCK.x, BLOCK.y - 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.tealHi;
    ctx.fillText(L.files.chunk + '  /  ' + L.files.readonly, blockX(nb - 1) + BLOCK.w, BLOCK.y - 22);
    ctx.letterSpacing = '0px';
    for (let s = 0; s < nb; s++) {
      const ch = CHUNKS[s];
      const landed = seg(t, ch.t0 + 0.6, ch.t0 + 0.8);
      const bx = blockX(s);
      rr(ctx, bx, BLOCK.y, BLOCK.w, BLOCK.h, 12);
      ctx.fillStyle = landed > 0 ? mixHex('#141d2c', '#10302f', landed) : '#111826';
      ctx.fill();
      ctx.strokeStyle = landed > 0 ? hexA(FILES[ch.fi].color, 0.3 + 0.6 * landed) : 'rgba(244,243,239,0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      font(ctx, 500, 12, MONO);
      ctx.fillStyle = hexA(C.cream, 0.4);
      ctx.textAlign = 'left';
      ctx.fillText('#' + (120768 + s * 3), bx + 10, BLOCK.y + 18);
      if (landed > 0) {
        ctx.globalAlpha = chainA * landed;
        rr(ctx, bx + 20, BLOCK.y + 32, BLOCK.w - 40, 26, 5);
        ctx.fillStyle = hexA(FILES[ch.fi].color, 0.85); ctx.fill();
        lock(ctx, bx + BLOCK.w / 2, BLOCK.y + 76, 16, C.tealHi);
        ctx.globalAlpha = chainA;
      }
    }
    ctx.restore();
    // flying chunks
    for (const ch of CHUNKS) {
      const p = seg(t, ch.t0, ch.t0 + 0.7);
      if (p <= 0 || p >= 1) continue;
      const f = FILES[ch.fi];
      const x1 = CONT.x + CONT.w - 30, y1 = fileCardY(ch.fi) + 35;
      const x2 = blockX(ch.slot) + BLOCK.w / 2, y2 = BLOCK.y + 45;
      const u = E.inOutCubic(p);
      const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 80;
      const x = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2;
      const y = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2;
      ctx.save();
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 20;
      rr(ctx, x - 30, y - 13, 60, 26, 5);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.restore();
    }
    // SiteRegistry
    const ra = E.outQuart(seg(t, 14.2, 15.0));
    if (ra > 0) {
      const rx = 690, ry = 210, rw = 1110, rh = 400;
      ctx.save();
      ctx.globalAlpha = ra;
      rr(ctx, rx, ry + (1 - ra) * 30, rw, rh, 20);
      ctx.fillStyle = 'rgba(12,18,28,0.9)'; ctx.fill();
      ctx.strokeStyle = 'rgba(244,243,239,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
      font(ctx, 700, 26, SANS);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(L.files.registry, rx + 32, ry + 46);
      font(ctx, 500, 14, MONO);
      ctx.fillStyle = hexA(C.cream, 0.45);
      ctx.fillText('container 4246.0', rx + 210, ry + 48);
      const cols = [rx + 32, rx + 300, rx + 560, rx + 960];
      font(ctx, 600, 14, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.cream, 0.45);
      L.files.cols.forEach((c, i) => ctx.fillText(c.toUpperCase(), cols[i], ry + 100));
      ctx.letterSpacing = '0px';
      ctx.fillStyle = 'rgba(244,243,239,0.1)';
      ctx.fillRect(rx + 24, ry + 122, rw - 48, 1);
      FILES.forEach((f, i) => {
        const ap = E.outCubic(seg(t, f.done - 0.2, f.done + 0.3));
        if (ap <= 0) return;
        const yy = ry + 162 + i * 58;
        const hl = env(t, 21.4 + i * 0.6, 22.6 + i * 0.6, 0.2, 0.5);
        ctx.globalAlpha = ra * ap;
        if (hl > 0) {
          rr(ctx, rx + 20, yy - 24, rw - 40, 48, 10);
          ctx.fillStyle = hexA(C.teal, 0.14 * hl); ctx.fill();
          ctx.strokeStyle = hexA(C.teal, 0.6 * hl); ctx.stroke();
        }
        font(ctx, 600, 19, MONO);
        ctx.fillStyle = C.cream;
        ctx.fillText(f.path, cols[0], yy);
        ctx.fillStyle = hexA(C.cream, 0.6);
        ctx.fillText(f.type, cols[1], yy);
        const settled = t > f.done + 0.6;
        let hs = f.hash;
        if (!settled) { const r = rng(Math.floor(t * 24) + i * 7); hs = f.hash.replace(/[0-9a-f]/g, () => '0123456789abcdef'[Math.floor(r() * 16)]); }
        ctx.fillStyle = settled ? C.tealHi : hexA(C.tealHi, 0.6);
        ctx.fillText(hs, cols[2], yy);
        ctx.fillStyle = C.cream;
        ctx.fillText(String(f.n), cols[3], yy);
        check(ctx, rx + rw - 50, yy, 22, C.tealHi, seg(t, f.done + 0.4, f.done + 0.8));
      });
      ctx.restore();
    }
  }

  // =====================================================================
  // 4 — ownership: NFT → ERC-6551 container → site; sell it, the site goes too (25.4 – 34)
  // =====================================================================
  function walletChip(ctx, x, y, label, a, hi) {
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    rr(ctx, x - 120, y - 40, 240, 80, 40);
    ctx.fillStyle = hi ? hexA(C.gold, 0.14) : 'rgba(244,243,239,0.05)'; ctx.fill();
    ctx.strokeStyle = hi ? C.gold : 'rgba(244,243,239,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    walletIcon(ctx, x - 70, y, 40, hi ? C.gold : hexA(C.cream, 0.6));
    font(ctx, 600, 18, MONO);
    ctx.letterSpacing = '3px';
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x - 30, y + 1);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }
  function sceneOwner(ctx, t, L) {
    darkBackground(ctx, t, { center: '#111a2a' });
    headline(ctx, t, 25.6, 33.8, 'ERC-721 + ERC-6551', L.owner.kicker, 140, 190, { size: 64, index: '02', lineLen: 80 });
    const sell = E.inOutCubic(seg(t, 30.0, 31.4));
    const shift = sell * 120;
    const nx = 700 + shift, ny = 600, cx = 1240 + shift, cy = 600;
    // NFT card
    const na = E.outBack(seg(t, 25.6, 26.4));
    ctx.save();
    ctx.globalAlpha = clamp(na);
    ctx.translate(nx, ny);
    ctx.scale(clamp(na, 0, 1.2), clamp(na, 0, 1.2));
    rr(ctx, -130, -170, 260, 340, 22);
    const g = ctx.createLinearGradient(-130, -170, 130, 170);
    g.addColorStop(0, '#11202a'); g.addColorStop(1, '#0a1018');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = C.tealHi; ctx.lineWidth = 2; ctx.stroke();
    font(ctx, 600, 14, MONO);
    ctx.letterSpacing = '4px';
    ctx.fillStyle = C.tealHi;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(L.owner.nft, -104, -126);
    ctx.fillStyle = hexA(C.cream, 0.45);
    ctx.fillText('ERC-721', -104, -100);
    ctx.letterSpacing = '0px';
    M.drawNand(ctx, -10, -10, 46, { color: C.cream, lw: 4 });
    font(ctx, 700, 44, MONO);
    ctx.fillStyle = C.cream;
    ctx.fillText('4246.0', -104, 130);
    ctx.restore();
    // binding line NFT ↔ container
    const la = E.inOutCubic(seg(t, 26.2, 27.0));
    const bind = wirePoints(nx + 130, ny, cx - 230, cy, 20);
    ctx.save();
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 4;
    ctx.shadowColor = C.teal; ctx.shadowBlur = 16;
    strokePts(ctx, bind, la);
    ctx.restore();
    if (la >= 1) signalDots(ctx, bind, t, C.tealHi, 0.8, 3, 5);
    if (la > 0.5) {
      ctx.save();
      ctx.globalAlpha = seg(t, 26.6, 27.0);
      font(ctx, 600, 13, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.cream, 0.6);
      ctx.textAlign = 'center';
      ctx.fillText('ERC-6551 BOUND', (nx + 130 + cx - 230) / 2, cy - 22);
      ctx.restore();
    }
    // container with the site inside
    const ka = E.outQuart(seg(t, 26.4, 27.4));
    if (ka > 0) {
      ctx.save();
      ctx.globalAlpha = ka;
      rr(ctx, cx - 230, cy - 210 + (1 - ka) * 40, 460, 420, 24);
      ctx.fillStyle = 'rgba(12,20,30,0.92)'; ctx.fill();
      ctx.strokeStyle = hexA(C.teal, 0.8); ctx.lineWidth = 2; ctx.stroke();
      font(ctx, 600, 15, MONO);
      ctx.letterSpacing = '4px';
      ctx.fillStyle = C.tealHi;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(L.owner.container + ' · ERC-6551', cx - 200, cy - 172);
      ctx.letterSpacing = '0px';
      font(ctx, 500, 16, TEXT);
      ctx.fillStyle = hexA(C.cream, 0.55);
      ctx.fillText(L.owner.containerSub, cx - 200, cy - 144);
      browser(ctx, cx - 200, cy - 112, 400, 290, {
        url: 'tape://4246.0', status: 'ok', urlSize: 13, alpha: seg(t, 27.2, 27.8),
        content: (x, y, w, h) => siteMock(ctx, x, y, w, h, seg(t, 27.4, 28.6)),
      });
      ctx.restore();
    }
    // owners
    const wa = E.outCubic(seg(t, 27.6, 28.3));
    const ax = 700, ay = 250, bx = 1500, by = 250;
    walletChip(ctx, ax, ay, L.owner.ownerA, wa * (1 - 0.65 * sell), sell < 0.5);
    walletChip(ctx, bx, by, L.owner.ownerB, E.outCubic(seg(t, 29.6, 30.2)), sell >= 0.5);
    const own = (x1, y1, p, col) => {
      const pts = wirePoints(x1, y1 + 40, nx, ny - 170, 24).map(([x, y]) => [x, y]);
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -t * 40;
      strokePts(ctx, pts, p);
      ctx.restore();
      return pts;
    };
    if (sell < 1) own(ax, ay, wa * (1 - sell), hexA(C.gold, 0.7));
    if (sell > 0) { const pts = own(bx, by, sell, hexA(C.gold, 0.9)); if (sell >= 1) signalDots(ctx, pts, t, C.gold, 0.6, 2, 4); }
    const st = E.outBack(seg(t, 30.8, 31.3), 2.5);
    if (st > 0) {
      ctx.save();
      ctx.globalAlpha = env(t, 30.8, 33.8, 0.2, 0.4);
      ctx.translate(1100 + shift * 0.3, 300);
      ctx.rotate(-0.08);
      ctx.scale(st, st);
      chipLabel(ctx, 0, 0, L.owner.sold + '  →  ' + L.owner.ownerB, { fill: hexA(C.gold, 0.15), stroke: C.gold, color: '#fff3d1', size: 18 });
      ctx.restore();
    }
  }

  // =====================================================================
  // 5 — access: tape://4246.0 or a regular domain via HashPort (34 – 42.6)
  // =====================================================================
  function typed(str, t, t0, t1) {
    const chars = Array.from(str);
    return chars.slice(0, Math.round(chars.length * seg(t, t0, t1))).join('');
  }
  function sceneAccess(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0f1828' });
    headline(ctx, t, 34.2, 42.3, 'tape://', L.access.kicker, 140, 190, { size: 64, index: '03', lineLen: 80 });
    const a = E.outQuart(seg(t, 34.0, 34.8));
    let url = typed('tape://4246.0', t, 34.5, 35.7);
    if (t > 38.3) {
      const del = seg(t, 38.3, 38.8);
      const keep = Array.from('tape://4246.0');
      url = del < 1 ? keep.slice(0, Math.round(keep.length * (1 - del))).join('') : typed(L.access.domain, t, 38.9, 39.6);
    }
    const loaded = t > 35.9;
    const domainMode = t > 39.7;
    const bx = 460, by = 300, bw = 1000, bh = 540;
    browser(ctx, bx, by + (1 - a) * 60, bw, bh, {
      alpha: a, dark: true, url, caret: t < 39.9 ? t : 0, status: loaded && (t < 38.3 || domainMode) ? 'ok' : null,
      urlSize: 22, urlStroke: loaded ? hexA(C.teal, 0.6) : undefined,
      badge: loaded && (t < 38.3 || domainMode) ? (domainMode ? 'HASHPORT' : 'ON-CHAIN') : null,
      content: (x, y, w, h) => {
        if (!loaded) {
          ctx.fillStyle = '#0b111b'; ctx.fillRect(x, y, w, h);
          return;
        }
        const reload = domainMode ? seg(t, 39.7, 40.6) : 1;
        siteMock(ctx, x, y, w, h, Math.min(seg(t, 35.9, 37.2), domainMode ? reload : t > 38.3 ? 0.999 : 1));
        // verified ribbon
        ctx.save();
        ctx.globalAlpha = seg(t, 36.6, 37.1);
        rr(ctx, x + w - 330, y + h - 62, 310, 42, 21);
        ctx.fillStyle = C.tealDeep; ctx.fill();
        check(ctx, x + w - 304, y + h - 41, 18, '#fff');
        font(ctx, 600, 14, MONO);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${L.access.loaded} · 4246.0`, x + w - 284, y + h - 40);
        ctx.restore();
      },
    });
    // HashPort binding diagram
    const hp = env(t, 39.2, 42.4, 0.6, 0.4);
    if (hp > 0) {
      ctx.save();
      ctx.globalAlpha = hp;
      const y = 245;
      const xs = [700, 960, 1220];
      const pts1 = wirePoints(xs[0] + 90, y, xs[1] - 90, y, 10), pts2 = wirePoints(xs[1] + 90, y, xs[2] - 90, y, 10);
      ctx.strokeStyle = hexA(C.teal, 0.6); ctx.lineWidth = 2;
      strokePts(ctx, pts1, seg(t, 39.4, 39.9)); strokePts(ctx, pts2, seg(t, 39.7, 40.2));
      signalDots(ctx, pts1, t, C.tealHi, 1, 2, 3); signalDots(ctx, pts2, t, C.tealHi, 1, 2, 3);
      [[L.access.domain, BLUE], ['HashPort', C.teal], ['4246.0', C.tealHi]].forEach(([s, col], i) => {
        chipLabel(ctx, xs[i], y, s, { size: 17, ls: 2, fill: hexA(col, 0.14), stroke: col, h: 46, pad: 20 });
      });
      font(ctx, 500, 15, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = hexA(C.cream, 0.6);
      ctx.textAlign = 'center';
      ctx.fillText(L.access.hashport.toUpperCase(), xs[1], y - 46);
      ctx.letterSpacing = '0px';
      ctx.restore();
    }
  }

  // =====================================================================
  // 6 — TapeKit: hashes + several independent nodes, mismatch blocks the page (42.6 – 55.4)
  // =====================================================================
  const NODES = [[420, 350], [780, 305], [1140, 305], [1500, 350]];
  const KIT = { x: 560, y: 560, w: 800, h: 290 };
  const T_TAMPER = 51.1;
  function sceneKit(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0d1b22' });
    headline(ctx, t, 42.8, 55.0, L.kit.engine, L.kit.title, 140, 196, { size: 54, index: '04', lineLen: 80 });
    const tamper = t > T_TAMPER;
    const kitA = E.outQuart(seg(t, 42.8, 43.6));
    // nodes
    NODES.forEach(([x, y], i) => {
      const a = E.outBack(seg(t, 43.2 + i * 0.15, 43.8 + i * 0.15));
      if (a <= 0) return;
      const bad = tamper && i === 2;
      const pts = wirePoints(x, y + 50, KIT.x + 120 + i * 190, KIT.y, 30).map(([px, py]) => [px, py]);
      // vertical-ish link
      const link = [];
      for (let k = 0; k <= 30; k++) {
        const u = k / 30;
        link.push([lerp(x, KIT.x + 130 + i * 180, u), lerp(y + 52, KIT.y, E.inOutCubic(u))]);
      }
      ctx.save();
      ctx.strokeStyle = bad ? hexA(RED, 0.8) : hexA(C.teal, 0.45);
      ctx.lineWidth = 2;
      strokePts(ctx, link, seg(t, 43.6 + i * 0.1, 44.2 + i * 0.1));
      ctx.restore();
      if (t > 44.2) signalDots(ctx, link, t + i * 0.3, bad ? RED : C.tealHi, bad ? 1.6 : 1.1, 3, 4);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(a, a);
      rr(ctx, -80, -50, 160, 100, 16);
      ctx.fillStyle = bad ? 'rgba(60,16,16,0.9)' : 'rgba(14,22,34,0.95)'; ctx.fill();
      ctx.strokeStyle = bad ? RED : hexA(C.cream, 0.3); ctx.lineWidth = 2; ctx.stroke();
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = bad ? hexA(RED, 0.5) : 'rgba(244,243,239,0.12)';
        rr(ctx, -56, -26 + k * 16, 70, 8, 4); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(46, -18, 6, 0, Math.PI * 2);
      ctx.fillStyle = bad ? RED : GREEN; ctx.fill();
      font(ctx, 600, 15, MONO);
      ctx.letterSpacing = '3px';
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${L.kit.node} ${i + 1}`, 0, 30);
      ctx.letterSpacing = '0px';
      ctx.restore();
    });
    // TapeKit panel
    ctx.save();
    ctx.globalAlpha = kitA;
    const red = tamper ? seg(t, T_TAMPER + 0.3, T_TAMPER + 0.8) : 0;
    rr(ctx, KIT.x, KIT.y + (1 - kitA) * 40, KIT.w, KIT.h, 22);
    ctx.fillStyle = mixHex('#0d1620', '#2a0f12', red); ctx.fill();
    ctx.strokeStyle = red > 0 ? hexA(RED, 0.5 + 0.5 * red) : hexA(C.teal, 0.7);
    ctx.lineWidth = 2; ctx.stroke();
    drawLogo(ctx, KIT.x + 44, KIT.y + 40, 0.03, C.cream, 0, 1);
    font(ctx, 700, 22, SANS);
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('TapeKit', KIT.x + 72, KIT.y + 41);
    font(ctx, 500, 14, MONO);
    ctx.fillStyle = hexA(C.cream, 0.5);
    ctx.fillText('tape://4246.0', KIT.x + 180, KIT.y + 42);
    FILES.forEach((f, i) => {
      const yy = KIT.y + 96 + i * 46;
      const vt = 47.1 + i * 0.7;
      const v = seg(t, vt, vt + 0.4);
      const bad = tamper && i === 1;
      ctx.fillStyle = 'rgba(244,243,239,0.06)';
      ctx.fillRect(KIT.x + 28, yy + 22, KIT.w - 56, 1);
      font(ctx, 600, 17, MONO);
      ctx.fillStyle = C.cream;
      ctx.fillText(f.path, KIT.x + 36, yy);
      let hs = f.hash;
      if (t < vt) { const r = rng(Math.floor(t * 24) + i * 11); hs = f.hash.replace(/[0-9a-f]/g, () => '0123456789abcdef'[Math.floor(r() * 16)]); }
      if (bad) hs = 'e1d09a77…44c0';
      ctx.fillStyle = bad ? RED : t < vt ? hexA(C.cream, 0.35) : C.tealHi;
      ctx.fillText(hs, KIT.x + 270, yy);
      font(ctx, 500, 14, MONO);
      ctx.fillStyle = hexA(C.cream, 0.4);
      ctx.fillText('= ' + f.hash, KIT.x + 470, yy);
      if (bad) cross(ctx, KIT.x + KIT.w - 52, yy, 22, RED, seg(t, T_TAMPER + 0.2, T_TAMPER + 0.6));
      else if (v > 0) check(ctx, KIT.x + KIT.w - 52, yy, 22, GREEN, v);
    });
    // consensus meter
    const agree = tamper ? 3 : Math.round(4 * seg(t, 45.0, 47.0));
    font(ctx, 600, 15, MONO);
    ctx.letterSpacing = '2px';
    ctx.textAlign = 'right';
    ctx.fillStyle = tamper ? RED : C.tealHi;
    ctx.fillText(`${agree}/4 ${L.kit.match}`, KIT.x + KIT.w - 36, KIT.y + 42);
    ctx.letterSpacing = '0px';
    for (let k = 0; k < 4; k++) {
      rr(ctx, KIT.x + KIT.w - 36 - 210 + k * 26 - 120, KIT.y + 36, 20, 12, 3);
      ctx.fillStyle = k < agree ? (tamper ? hexA(C.cream, 0.5) : C.tealHi) : tamper && k === 3 ? RED : 'rgba(244,243,239,0.12)';
      ctx.fill();
    }
    ctx.restore();
    // blocked overlay
    if (tamper) {
      const p = E.outBack(seg(t, T_TAMPER + 0.6, T_TAMPER + 1.1), 1.4);
      ctx.save();
      ctx.globalAlpha = env(t, T_TAMPER + 0.6, 55.4, 0.3, 0.4);
      ctx.translate(W / 2, KIT.y + KIT.h / 2);
      ctx.scale(p, p);
      rr(ctx, -330, -90, 660, 180, 22);
      ctx.fillStyle = 'rgba(40,10,12,0.96)'; ctx.fill();
      ctx.strokeStyle = RED; ctx.lineWidth = 3;
      ctx.shadowColor = RED; ctx.shadowBlur = 40; ctx.stroke(); ctx.shadowBlur = 0;
      font(ctx, 700, 16, MONO);
      ctx.letterSpacing = '5px';
      ctx.fillStyle = RED;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠  ' + L.kit.mismatch, 0, -46);
      ctx.letterSpacing = '0px';
      font(ctx, 700, 40, SANS);
      ctx.fillStyle = '#fff';
      ctx.fillText(L.kit.blocked, 0, 2);
      font(ctx, 400, 18, TEXT);
      ctx.fillStyle = hexA('#ffd9d6', 0.8);
      ctx.fillText(L.kit.blockedSub, 0, 48);
      ctx.restore();
    }
  }

  // =====================================================================
  // 7 — any browser via gateway: no wallet, no gas (55.4 – 60)
  // =====================================================================
  function sceneGateway(ctx, t, L) {
    darkBackground(ctx, t, { center: '#101a2b' });
    const a = E.outQuart(seg(t, 55.4, 56.2));
    browser(ctx, 560, 150 + (1 - a) * 50, 800, 470, {
      alpha: a, url: typed('tapekit.org/4246.0', t, 55.6, 56.5), status: t > 56.6 ? 'ok' : null,
      badge: t > 56.8 ? L.gateway.gate.toUpperCase() : null,
      content: (x, y, w, h) => siteMock(ctx, x, y, w, h, seg(t, 56.6, 57.6)),
    });
    const icons = [
      (x, y) => { walletIcon(ctx, x, y, 26, C.cream); },
      (x, y) => { gasIcon(ctx, x, y, 26, C.cream); },
      (x, y) => { globeIcon(ctx, x, y, 26, C.cream); },
    ];
    const xs = [600, 960, 1320];
    L.gateway.chips.forEach((c, i) => {
      const p = E.outBack(seg(t, 57.0 + i * 0.3, 57.5 + i * 0.3));
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha = clamp(p) * (1 - seg(t, 59.6, 60));
      ctx.translate(xs[i], 720);
      ctx.scale(p, p);
      chipLabel(ctx, 0, 0, c, { size: 20, h: 62, icon: icons[i], fill: i < 2 ? 'rgba(244,243,239,0.05)' : hexA(C.teal, 0.14), stroke: i < 2 ? hexA(C.cream, 0.4) : C.teal });
      ctx.restore();
      if (i < 2) {
        // strike through the icon
        ctx.save();
        ctx.globalAlpha = seg(t, 57.4 + i * 0.3, 57.7 + i * 0.3);
        font(ctx, 600, 20, MONO);
        ctx.letterSpacing = '4px';
        const w = ctx.measureText(c).width + 52 + 34;
        ctx.letterSpacing = '0px';
        ctx.strokeStyle = RED;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xs[i] - w / 2 + 22, 720 + 14); ctx.lineTo(xs[i] - w / 2 + 52, 720 - 14);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // =====================================================================
  // 8 — cost over time (60 – 64.4)
  // =====================================================================
  function sceneCost(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0f1828' });
    headline(ctx, t, 60.1, 64.2, L.cost.months, L.cost.kicker, 140, 190, { size: 64, index: '05', lineLen: 80 });
    const gx = 420, gy = 280, gw = 1260, gh = 380;
    const p = E.inOutCubic(seg(t, 60.5, 62.6));
    ctx.save();
    ctx.globalAlpha = seg(t, 60.1, 60.6);
    ctx.strokeStyle = 'rgba(244,243,239,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    font(ctx, 500, 14, MONO);
    ctx.fillStyle = hexA(C.cream, 0.45);
    ctx.textAlign = 'right';
    ctx.fillText(L.cost.months, gx + gw, gy + gh + 34);
    for (let m = 0; m <= 24; m += 6) {
      ctx.textAlign = 'center';
      ctx.fillText(String(m), gx + (m / 24) * gw, gy + gh + 34);
    }
    // server: monthly bills accumulate
    ctx.beginPath();
    ctx.strokeStyle = hexA(RED, 0.85);
    ctx.lineWidth = 4;
    const months = 24;
    let first = true;
    for (let m = 0; m <= months * p; m++) {
      const x = gx + (m / months) * gw;
      const yv = gy + gh - 24 - (m / months) * (gh - 70);
      const yPrev = gy + gh - 24 - ((m - 1) / months) * (gh - 70);
      if (first) { ctx.moveTo(x, gy + gh - 24); first = false; } else { ctx.lineTo(x, yPrev); ctx.lineTo(x, yv); }
    }
    ctx.stroke();
    // DeWEB: one-time gas, then flat
    ctx.beginPath();
    ctx.strokeStyle = C.tealHi;
    ctx.shadowColor = C.teal; ctx.shadowBlur = 16;
    ctx.moveTo(gx, gy + gh - 4);
    ctx.lineTo(gx + 6, gy + gh - 4);
    ctx.lineTo(gx + 6, gy + gh - 80);
    ctx.lineTo(gx + 6 + (gw - 6) * p, gy + gh - 80);
    ctx.stroke();
    ctx.shadowBlur = 0;
    font(ctx, 600, 18, MONO);
    ctx.textAlign = 'left';
    ctx.fillStyle = hexA(RED, 0.9);
    const sxEnd = gx + gw * p;
    if (p > 0.15) ctx.fillText(L.cost.server, Math.min(sxEnd, gx + gw - 220) - 40, gy + gh - 24 - p * (gh - 70) - 26);
    ctx.fillStyle = C.tealHi;
    if (p > 0.1) ctx.fillText(`${L.cost.deweb} · ${L.cost.once}`, gx + 30, gy + gh - 104);
    ctx.restore();
    const xs = [600, 960, 1320];
    L.cost.chips.forEach((c, i) => {
      const q = E.outBack(seg(t, 62.4 + i * 0.25, 62.9 + i * 0.25));
      if (q <= 0) return;
      ctx.save();
      ctx.globalAlpha = clamp(q);
      ctx.translate(xs[i], 780);
      ctx.scale(q, q);
      chipLabel(ctx, 0, 0, c, { size: 18 });
      ctx.restore();
    });
  }

  // =====================================================================
  // 9 — how it differs + one root of trust (64.4 – 77.4)
  // =====================================================================
  function compareGlyph(ctx, i, x, y, col) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 3;
    if (i === 0) { // pin + gateway
      ctx.beginPath(); ctx.arc(x - 30, y - 10, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 30, y + 4); ctx.lineTo(x - 30, y + 30); ctx.stroke();
      rr(ctx, x + 2, y - 22, 52, 44, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 14, y - 22); ctx.lineTo(x + 14, y + 22); ctx.moveTo(x + 42, y - 22); ctx.lineTo(x + 42, y + 22); ctx.stroke();
    } else if (i === 1) { // two separate layers
      rr(ctx, x - 50, y - 30, 100, 20, 5); ctx.stroke();
      rr(ctx, x - 50, y + 14, 100, 20, 5); ctx.stroke();
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 12); ctx.stroke();
    } else if (i === 2) { // editable box
      rr(ctx, x - 40, y - 30, 64, 60, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, y + 18); ctx.lineTo(x + 44, y - 26); ctx.lineWidth = 6; ctx.stroke();
    } else { // special client + seeders
      rr(ctx, x - 30, y - 24, 60, 40, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 40, y + 26); ctx.lineTo(x + 40, y + 26); ctx.stroke();
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.55; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 62, y - 4 + Math.sin(a) * 40, 5, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  function sceneCompare(ctx, t, L) {
    darkBackground(ctx, t, { center: '#111828' });
    const cardsOut = seg(t, 72.9, 73.6);
    ctx.save();
    ctx.globalAlpha = 1 - cardsOut;
    decodeText(ctx, '06  —  ' + L.compare.kicker, W / 2, 190, seg(t, 64.5, 65.4), { align: 'center', size: 22, ls: 6, t, color: C.teal });
    ctx.restore();
    const cw = 380, gap = 30, x0 = (W - (4 * cw + 3 * gap)) / 2, cy = 260, ch = 380;
    L.compare.cards.forEach((c, i) => {
      const t0 = i < 2 ? 64.7 + i * 0.3 : 69.0 + (i - 2) * 0.3;
      const a = E.outQuart(seg(t, t0, t0 + 0.7));
      if (a <= 0) return;
      const x = x0 + i * (cw + gap);
      const focus = i < 2 ? env(t, 64.7, 69.0, 0.4, 0.4) : env(t, 69.0, 72.9, 0.4, 0.3);
      ctx.save();
      ctx.globalAlpha = a * (0.5 + 0.5 * focus) * (1 - cardsOut);
      const y = cy + (1 - a) * 60 - cardsOut * 40;
      rr(ctx, x, y, cw, ch, 22);
      ctx.fillStyle = '#111a28'; ctx.fill();
      ctx.strokeStyle = focus > 0 ? hexA(C.cream, 0.15 + 0.25 * focus) : 'rgba(244,243,239,0.1)';
      ctx.lineWidth = 1.5; ctx.stroke();
      compareGlyph(ctx, i, x + cw / 2, y + 100, hexA(C.cream, 0.7));
      font(ctx, 700, 36, SANS);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(c.name, x + 34, y + 222);
      c.note.forEach((ln, k) => {
        let size = 20;
        font(ctx, 400, size, TEXT);
        while (ctx.measureText(ln).width > cw - 68 && size > 14) { size--; font(ctx, 400, size, TEXT); }
        ctx.fillStyle = hexA(C.cream, 0.66);
        ctx.fillText(ln, x + 34, y + 268 + k * 30);
      });
      ctx.fillStyle = hexA('#ffb4ae', 0.9);
      cross(ctx, x + cw - 44, y + 44, 18, hexA(RED, 0.85), seg(t, t0 + 0.4, t0 + 0.8));
      ctx.restore();
    });
    // one root of trust
    const ra = seg(t, 73.2, 74.2);
    if (ra > 0) {
      const rootX = W / 2, rootY = 600;
      const boxes = [[760, 330, L.compare.rootSub[0], BLUE], [1160, 330, L.compare.rootSub[1], C.teal]];
      boxes.forEach(([x, y, lab, col], i) => {
        const p = E.outBack(seg(t, 73.2 + i * 0.2, 73.8 + i * 0.2));
        const link = [];
        for (let k = 0; k <= 30; k++) { const u = k / 30; link.push([lerp(x, rootX, E.inOutCubic(u)), lerp(y + 40, rootY - 60, u)]); }
        ctx.save();
        ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.shadowColor = col; ctx.shadowBlur = 14;
        strokePts(ctx, link, E.inOutCubic(seg(t, 73.6, 74.4)));
        ctx.restore();
        if (t > 74.4) signalDots(ctx, link, t, col, 0.8, 2, 4);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(clamp(p, 0, 1.2), clamp(p, 0, 1.2));
        chipLabel(ctx, 0, 0, lab.toUpperCase(), { size: 20, h: 70, fill: hexA(col, 0.14), stroke: col, pad: 34 });
        ctx.restore();
      });
      const rp = E.outBack(seg(t, 74.2, 74.8), 1.6);
      ctx.save();
      ctx.translate(rootX, rootY);
      ctx.scale(rp, rp);
      ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2);
      ctx.fillStyle = '#0f2426'; ctx.fill();
      ctx.strokeStyle = C.tealHi; ctx.lineWidth = 3; ctx.shadowColor = C.teal; ctx.shadowBlur = 40; ctx.stroke(); ctx.shadowBlur = 0;
      drawLogo(ctx, 0, 0, 0.075, C.cream, 0, 1);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = seg(t, 74.5, 75.0) * (1 - seg(t, 77.0, 77.4));
      font(ctx, 600, 18, MONO);
      ctx.letterSpacing = '4px';
      ctx.fillStyle = hexA(C.cream, 0.55);
      ctx.textAlign = 'center';
      ctx.fillText('L1', rootX, rootY + 100);
      ctx.restore();
      ctx.letterSpacing = '0px';
      revealText(ctx, L.compare.root, W / 2, 200, seg(t, 73.5, 74.8), { size: 72, weight: 700, ls: -2, out: seg(t, 76.8, 77.4) });
    }
  }

  // =====================================================================
  // 10 — ecosystem orbit (77.4 – 83)
  // =====================================================================
  function sceneEco(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0e1c24' });
    const cx = W / 2, cy = 470;
    const a = E.outBack(seg(t, 77.5, 78.2), 1.4);
    // orbit rings
    ctx.save();
    ctx.globalAlpha = seg(t, 77.5, 78.3) * (1 - seg(t, 82.6, 83));
    ctx.strokeStyle = 'rgba(244,243,239,0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, cy, 600, 270, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, 380, 170, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const items = L.eco.items;
    items.forEach(([name, desc], i) => {
      const p = E.outBack(seg(t, 78.0 + i * 0.22, 78.6 + i * 0.22));
      if (p <= 0) return;
      const ang = -Math.PI / 2 + (i / items.length) * Math.PI * 2 + (t - 77.4) * 0.06;
      const x = cx + Math.cos(ang) * 600, y = cy + Math.sin(ang) * 270;
      const link = [];
      for (let k = 0; k <= 24; k++) { const u = k / 24; link.push([lerp(cx, x, u), lerp(cy, y, u)]); }
      ctx.save();
      ctx.globalAlpha = clamp(p) * (1 - seg(t, 82.6, 83));
      ctx.strokeStyle = hexA(C.teal, 0.35); ctx.lineWidth = 2;
      strokePts(ctx, link, clamp(p));
      if (p >= 1) signalDots(ctx, link, t + i * 0.2, C.tealHi, 0.5, 2, 3);
      ctx.translate(x, y);
      ctx.scale(clamp(p, 0, 1.15), clamp(p, 0, 1.15));
      font(ctx, 700, 26, SANS);
      const nw = ctx.measureText(name).width;
      font(ctx, 400, 16, TEXT);
      const dw = ctx.measureText(desc).width;
      const bw = Math.max(nw, dw) + 56;
      rr(ctx, -bw / 2, -44, bw, 88, 20);
      ctx.fillStyle = 'rgba(13,22,32,0.95)'; ctx.fill();
      ctx.strokeStyle = i === 0 ? C.tealHi : hexA(C.cream, 0.25); ctx.lineWidth = 1.5; ctx.stroke();
      font(ctx, 700, 26, SANS);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 0, -12);
      font(ctx, 400, 16, TEXT);
      ctx.fillStyle = hexA(C.cream, 0.6);
      ctx.fillText(desc, 0, 20);
      ctx.restore();
    });
    // core
    ctx.save();
    ctx.globalAlpha = 1 - seg(t, 82.6, 83);
    ctx.translate(cx, cy);
    ctx.scale(a, a);
    const pulse = 1 + 0.04 * Math.sin(t * 3);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
    rg.addColorStop(0, hexA(C.teal, 0.35)); rg.addColorStop(1, hexA(C.teal, 0));
    ctx.fillStyle = rg; ctx.fillRect(-260, -260, 520, 520);
    ctx.beginPath(); ctx.arc(0, 0, 120 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#0f2426'; ctx.fill();
    ctx.strokeStyle = C.tealHi; ctx.lineWidth = 3; ctx.stroke();
    font(ctx, 800, 50, SANS);
    ctx.letterSpacing = '-2px';
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DeWEB', 0, 4);
    ctx.letterSpacing = '0px';
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 1 - seg(t, 82.6, 83);
    decodeText(ctx, '07  —  ' + L.eco.kicker, W / 2, 110, seg(t, 77.6, 78.5), { align: 'center', size: 22, ls: 6, t, color: C.teal });
    ctx.restore();
  }

  // =====================================================================
  // 11 — finale on cream (83 – 93)
  // =====================================================================
  function sceneFinale(ctx, t, L) {
    darkBackground(ctx, t, { center: '#0e1c24' });
    const wp = E.inOutCubic(seg(t, 83.0, 84.1));
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, wp * 1200, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(29,29,27,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // faint browser frames drifting behind
    for (let i = 0; i < 5; i++) {
      const pr = E.outCubic(seg(t, 83.6 + i * 0.12, 84.8 + i * 0.12));
      ctx.globalAlpha = 0.09 * pr;
      const bx = 140 + i * 360, by = 120 + (i % 2) * 560 - (t - 83) * 6;
      rr(ctx, bx, by, 280, 180, 14);
      ctx.strokeStyle = C.tealDeep; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by + 30); ctx.lineTo(bx + 280, by + 30); ctx.stroke();
    }
    ctx.restore();
    if (wp > 0 && wp < 1) {
      ctx.save();
      ctx.strokeStyle = C.tealHi; ctx.lineWidth = 6; ctx.shadowColor = C.teal; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, wp * 1200, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const ly = H / 2 - 70;
    const draw = seg(t, 83.9, 85.1), fill = E.outCubic(seg(t, 84.9, 85.5));
    const slide = E.inOutCubic(seg(t, 85.5, 86.4));
    const ls = 0.2;
    font(ctx, 800, 170, SANS);
    ctx.letterSpacing = '-6px';
    const wordW = ctx.measureText('DeWEB').width;
    ctx.letterSpacing = '0px';
    const gap = 50, logoW = 1020 * ls, groupW = logoW + gap + wordW;
    const lx = lerp(W / 2, W / 2 - groupW / 2 + logoW / 2, slide);
    if (draw > 0) drawLogo(ctx, lx, ly, ls * (1 + 0.06 * Math.sin(seg(t, 84.9, 85.5) * Math.PI)), C.navy, draw, fill);
    if (slide > 0) {
      const wx = W / 2 - groupW / 2 + logoW + gap;
      const rv = E.outCubic(seg(t, 86.3, 87.2));
      ctx.save();
      ctx.beginPath(); ctx.rect(wx - 10, ly - 160, (wordW + 60) * rv, 320); ctx.clip();
      font(ctx, 800, 170, SANS);
      ctx.letterSpacing = '-6px';
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('DeWEB', wx + (1 - rv) * -60, ly + 8);
      ctx.restore();
      ctx.letterSpacing = '0px';
      ctx.save();
      ctx.globalAlpha = seg(t, 86.9, 87.4);
      font(ctx, 600, 18, MONO);
      ctx.letterSpacing = '8px';
      ctx.fillStyle = C.tealDeep;
      ctx.textAlign = 'left';
      ctx.fillText('BY TAPEOUT', wx + 6, ly - 108);
      ctx.restore();
      ctx.letterSpacing = '0px';
    }
    revealText(ctx, L.tagline, W / 2, ly + 180, seg(t, 87.0, 88.1), { size: 52, weight: 500, color: C.ink, ls: -1, stagger: 0.4 });
    const up = E.outBack(seg(t, 87.8, 88.5));
    if (up > 0) {
      ctx.save();
      ctx.translate(W / 2, ly + 272);
      ctx.scale(up, up);
      font(ctx, 600, 26, MONO);
      ctx.letterSpacing = '3px';
      const tw = ctx.measureText('tapeout.net').width + 72;
      rr(ctx, -tw / 2, -32, tw, 64, 32);
      ctx.fillStyle = C.tealDeep; ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tapeout.net', 0, 2);
      ctx.restore();
      ctx.letterSpacing = '0px';
    }
    ctx.save();
    ctx.globalAlpha = seg(t, 88.4, 89.2) * 0.7;
    font(ctx, 500, 16, MONO);
    ctx.letterSpacing = '5px';
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.fillText(L.footer, W / 2, H - 200);
    ctx.restore();
    ctx.letterSpacing = '0px';
  }

  // =====================================================================
  const SCENE_FNS = [sceneTrust, sceneTitle, sceneFiles, sceneOwner, sceneAccess, sceneKit, sceneGateway, sceneCost, sceneCompare, sceneEco, sceneFinale];
  function drawFrame(ctx, t, lang, opts = {}) {
    const L = window.TAPEOUT_I18N[lang] || window.TAPEOUT_I18N.en;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    let si = 0;
    for (let i = 0; i < SCENES.length; i++) if (t >= SCENES[i]) si = i;
    SCENE_FNS[si](ctx, t, L);
    // dip-through-dark between scenes (the opening collapse and the cream wipe have their own transitions)
    for (const b of SCENES.slice(2, 10)) {
      const d = 1 - Math.abs(t - b) / 0.35;
      if (d > 0) {
        ctx.fillStyle = `rgba(5,7,12,${0.85 * E.inOutCubic(clamp(d))})`;
        ctx.fillRect(0, 0, W, H);
        flare(ctx, W / 2, H / 2, 1400 * d, d * 0.5);
      }
    }
    const light = t > 83.7;
    if (!light) vignette(ctx, 0.7);
    hud(ctx, t, L, seg(t, 1.0, 2.0) * (1 - seg(t, 82.6, 83.4)), SCENES);
    if (opts.subtitles !== false) subtitles(ctx, t, L, light);
    drawGrain(ctx, t, light ? 0.05 : 0.08);
    const k = Math.max(1 - seg(t, 0, 0.4), seg(t, DURATION - 0.8, DURATION));
    if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  window.TapeOutFilm = { W, H, DURATION, FPS: 60, NAME: 'tapeout_deweb', drawFrame };
})();
