# TapeOut — Promo Film

A 76-second motion-design promo for [tapeout.net](https://tapeout.net), written entirely in code (Canvas 2D).
No voice-over: the story is carried by on-screen subtitles, kinetic typography and a procedural score.
Turkish and English versions are rendered from the same timeline.

## Story

| Time | Scene | What happens |
|---|---|---|
| 0–7 s | Assets | Coins float in 3D, then snap into a grid and turn into transistor tiles |
| 7–13 s | Production | The tiles form a silicon wafer; title “Tools of production” |
| 13–21 s | The gate | A NAND gate draws itself and steps through its truth table; token = transistor, 7 bytes |
| 21–27 s | Memory | A LATCH holds one bit of state against a clock waveform |
| 27–38 s | Canvas | The TapeOut editor: gates drop in, wires connect, a half adder runs live |
| 38–47 s | Tape out | The button is pressed, transistors burn, and a circuit NFT (TapeID 42.1) is born |
| 47–54 s | Compose | The circuit becomes a black box inside bigger chips, which tile into a larger network |
| 54–66 s | Protocol | Processors · Markets · $BEM mining |
| 66–76 s | Brand | Cream wipe, logo, “On-chain hardware.”, tapeout.net |

## Files

- `index.html`: interactive player (play/pause, scrubbing, TR/EN switch, subtitles on/off; space bar plays and pauses)
- `film.js`: the deterministic renderer, `drawFrame(ctx, t, lang)`
- `i18n.js`: all copy and subtitle timings (TR + EN)
- `../tools/render.mjs`: renders frame by frame in headless Chromium → ffmpeg (1920×1080, 60 fps, H.264)
- `soundtrack.mjs`: procedural music and sound design (WAV), synced to the timeline
- `../tools/subtitles.mjs`: exports `.srt` / `.vtt` from `i18n.js`
- `build.sh`: builds everything into `out/`

## Usage

```bash
# preview: open index.html in a browser (?lang=en, ?t=39.5, ?subs=0)
./build.sh            # out/tapeout_promo_tr.mp4, out/tapeout_promo_en.mp4, .srt/.vtt
node ../tools/render.mjs --dir . --lang en --stills 10,40,70   # quick still frames
node ../tools/render.mjs --dir . --lang tr --subs 0 --name tapeout_promo_tr_clean.mp4   # version without burned-in subtitles
```

To change the copy or the subtitle timings, edit `i18n.js` and rebuild.
