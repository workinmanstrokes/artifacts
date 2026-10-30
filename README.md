# Artifacts

Static HTML pages published from Claude artifacts, served with GitHub Pages at
https://workinmanstrokes.github.io/artifacts/. The root `index.html` links to each page.

| Path | What it is |
|---|---|
| `diddlersfreq0ff-privacy/` | Privacy policy for diddlersFreq0ff (Spin & Deal) |
| `diddlersfreq0ff-launch-guide/` | Launch guide for diddlersFreq0ff |
| `fishing-almanac/` | Fishing Almanac web app |
| `fishing-almanac-v1/` | Earlier version of Fishing Almanac |
| `velvet-vault/` | Velvet Vault: virtual-currency slots prototype (slots, store, stats) |
| `prism-grade/` | Prism Grade: photo-based trading card pre-grading concept |
| `reel-legends-usa/` | Reel Legends: USA fishing game (installable PWA) |
| `living-pond/` | Living Pond: single-pond casting and reeling game |
| `mini-4k-bypass-runbook/` | Runbook notes for decompiling the DJI Fly APK (Mini 4K SDK work) |
| `overlap/` | Overlap: group availability finder |

## Structure

Each page lives in its own folder with an `index.html`. Most are single self-contained files;
`reel-legends-usa/` and `velvet-vault/` are split into `app.js`, `data.js`, `engine.js`,
`render.js`, `style.css` and a web manifest with icons.

## Run locally

No build step. Serve the repo root with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Adding a page

Create a new folder with an `index.html`, then add a link to it in the root `index.html`.
Pushing to `main` updates the GitHub Pages site.
