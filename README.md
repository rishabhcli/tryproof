# TryProof

A virtual try-on that checks itself against your skin. Built on the YouCam API for the YouCam API Skin AI and eCommerce VTO Hackathon.

**Live demo:** see the repository description. **Source license:** MIT.

## The idea

Most try-on tools render a look and stop. TryProof treats the render as a claim and checks it.

1. **Read.** Skin Analysis scores eight concerns (redness, blemishes, dark circles, texture, pores, radiance, oiliness, spots). Facial Color Tones finds the skin shade.
2. **Prescribe.** A small rules engine (`public/js/rules.mjs`) turns those scores into the settings for Makeup Virtual Try-On: smoothing strength, foundation coverage and glow, under-eye concealer strength.
3. **Prove.** The rendered image goes back through Skin Analysis. Each concern gets a before and after score. If a setting made a concern read worse, TryProof backs that setting off and renders again. If a concern barely moved, it strengthens the setting. It runs this once, then keeps the better round by score.
4. **Shop.** The verified settings are written as a plain product spec (shade, coverage, finish) that a shopper or a counter assistant can use.

Skin Analysis is used here as a verifier of the try-on, not only as a report.

## YouCam APIs used

| API | Endpoint | Role |
|---|---|---|
| AI Skin Analysis (SD, 8 concerns) | `task/skin-analysis` | Reads the face, then scores every render |
| AI Facial Color Tones Analyzer | `task/skin-tone-analysis` | Skin shade for foundation and concealer |
| AI Makeup Virtual Try-On | `task/makeup-vto` | `skin_smooth`, `foundation`, `concealer` effects |
| File API | `file` | Upload photos and re-host renders so they can be scored |

One practical detail: Skin Analysis cannot fetch a try-on result by its signed URL, so TryProof downloads each render and re-uploads it through the File API before scoring it.

Cost for one face is about 45 to 70 units (12 per Skin Analysis, 20 for Color Tones, 1 per try-on).

## What the recorded results show

The demo uses three AI-generated faces, not real people, with real API responses recorded on 30 Oct 2026 in `public/cache/`. Honest summary of those runs:

- Skin Analysis scores moved on every face after the try-on. The prescribed look improved 6 or 7 of the 8 concerns on each face.
- The prescribed look and the one-size-fits-all preset score about the same on average. TryProof does not claim that prescription beats a good preset on score. What it adds is a per-skin check and the ability to catch regressions.
- On the Dev sample, the first render made pores read worse (75 to 63). TryProof backed the smoothing setting off, re-rendered and kept the better round.
- Scores describe how the rendered image reads to the Skin Analysis model. They are not medical advice, and a rendered look is a simulation.

## Run it

```bash
npm test                      # rules engine tests (node:test, no dependencies)
node scripts/dev-server.mjs   # demo mode on http://localhost:5173, no API key needed
```

Live mode needs the serverless proxy in `api/`. Run `npx vercel dev`, open the site, switch to **Live, your key**, paste your own YouCam API key and choose a selfie. The key is sent in an `x-youcam-key` header for each request, used once and never stored or logged. Nothing is saved server-side.

Self-hosting with a server key is possible by setting `YOUCAM_API_KEY` and `ALLOW_SERVER_KEY=1`. This is off by default so a public deployment cannot spend anyone's units.

### Rebuild the cache with your own units

```bash
echo "YOUCAM_API_KEY=sk-..." > .env.local
node scripts/stage1.mjs maya dev rosa   # Skin Analysis + Color Tones (about 32 units per face)
node scripts/stage2.mjs maya dev rosa   # the full loop (26 to 39 units per face)
```

## Layout

```
public/            static app (index.html, styles.css, js/)
public/js/rules.mjs      prescription, adjustment and scoring rules
public/js/pipeline.mjs   the loop; same code runs in Node and in the browser
public/cache/<face>/     recorded API results, renders and concern overlays
api/                     allow-listed proxy: upload, start, poll
lib/youcam.mjs           Node client (upload, run task, re-host render)
scripts/                 cache builders, dev server, screenshot script
tests/                   rules engine tests
```

## Notes on how this was built

Written for this hackathon during the submission period. The code was written with help from an AI coding assistant (Claude), and the three sample faces were generated with an AI image model. The face images are synthetic. No photo of a real person is used in the demo.

## License

MIT, see `LICENSE`.
