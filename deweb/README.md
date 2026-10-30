# TapeOut DeWEB — Explainer Film

A 93-second motion-design explainer about **DeWEB** (“Decentralizing the Web”), the TapeOut layer that hosts websites on-chain so they can be verified.
Like the promo, it is written entirely in code (Canvas 2D) and has no voice-over. Subtitles, kinetic typography and a procedural score tell the story.
Turkish and English versions are rendered from the same timeline.

## Story

| Time | Scene | What happens |
|---|---|---|
| 0–8 s | Blind trust | A verified contract sits behind an unverified swap site; the frontend is swapped (glitch, look-alike URL) |
| 8–12.6 s | DeWEB | Title out of a hex rain; the FRONTEND and CONTRACTS layers merge into one L1 layer |
| 12.6–25.4 s | On-chain files | Files in a circuit container are split into chunks of ≤ 24 KB, which become read-only contracts on L1; the SiteRegistry fills in path, type, SHA-256 hash and chunk count |
| 25.4–34 s | Ownership | Circuit NFT (ERC-721) ↔ ERC-6551 container ↔ site; when ownership passes from A to B, the site goes with it |
| 34–42.6 s | Access | `tape://4246.0` is typed and the page loads from the chain; then `mysite.xyz` → HashPort → 4246.0 |
| 42.6–55.4 s | TapeKit | Four independent nodes send packets, each hash is compared and 4/4 agree; one node is tampered with → “Page not shown” |
| 55.4–60 s | No wallet | A normal browser opens the site via tapekit.org: no wallet, no gas |
| 60–64.4 s | Cost | Monthly server bills keep rising; DeWEB costs one-time gas |
| 64.4–77.4 s | The difference | IPFS+ENS, Arweave, ICP, ZeroNet → “One root of trust” |
| 77.4–83 s | Ecosystem | TapeKit, HashPort, TapeSend, TapeCode, TapeKey and TAP orbit around DeWEB |
| 83–93 s | Brand | Cream wipe, logo + DeWEB, “Access for everyone.”, tapeout.net |

Example values such as the circuit ID, hashes and block numbers are illustrative.

## Files

- `index.html`: interactive player (play/pause, scrubbing, TR/EN, subtitles on/off)
- `film.js`: scenes, `drawFrame(ctx, t, lang)`; helpers come from `../shared/motion.js`
- `i18n.js`: all copy and subtitle timings (TR + EN)
- `soundtrack.mjs`: music and sound design (uses `../tools/synth.mjs`)
- `build.sh`: builds everything into `out/` (`../tools/render.mjs` + `../tools/subtitles.mjs`)

```bash
./build.sh                                          # out/tapeout_deweb_tr.mp4, out/tapeout_deweb_en.mp4, .srt/.vtt
node ../tools/render.mjs --dir . --lang tr --stills 20,50   # quick still frames
node ../tools/render.mjs --dir . --lang en --subs 0 --name tapeout_deweb_en_clean.mp4   # without burned-in subtitles
```
