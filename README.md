# Learn FlexiTac

**Building Your Robot's First Tactile Skin.** An interactive course on [FlexiTac](https://flexitac.github.io/), a
thin, flexible 12 × 32 tactile sensor, from the pad and its reading board to putting it on a robot and simulating it.
English and 中文.

**Live:** https://flexitac.github.io/learn/

## What's inside

| Section | Lessons |
|---|---|
| 1 · The sensor | 1.1 Meet FlexiTac · 1.2 The sandwich · 1.3 Meet the reading board · 1.4 One frame · 1.5 Bytes to touch · 1.6 Build your own |
| 2 · On a robot | 2.1 Put FlexiTac on a robot · 2.2 Grasp with your mouse |
| 3 · In simulation | 3.1 Why simulate touch · 3.2 A pad made of points · 3.3 How deep, how hard · 3.4 Playground |

Every lesson is built around an interactive isometric figure or card that runs in the browser. Nothing needs a GPU
or an install.

## Repository layout

- `learn-flexitac/` is the site: a static single-page app (Vite + vanilla TypeScript). See its
  [README](learn-flexitac/README.md).
- `flexitac-anatomy/shared/` holds the data and models the site and figures share: sensor geometry, the scan model
  and the in-browser touch simulator. See its [README](flexitac-anatomy/shared/README.md).
- The figures are committed pre-built in `learn-flexitac/public/figures/`.

## Run it locally

```bash
cd learn-flexitac
npm install
npx vite          # dev server
npx vite build    # static build in dist/
```

Node 22 is recommended.

## Deploy

Every push to `main` builds the site and publishes it with GitHub Pages (`.github/workflows/deploy.yml`). In the
repository settings, set **Pages → Source** to **GitHub Actions**.

## Credits

FlexiTac, 3D-ViTac and VT-Refine are by the FlexiTac team. The robot drawings are derived from Seeed Studio's
reBot-DevArm CAD (CERN-OHL-W-2.0). The soft fingers are the UMI fin-shaped finger. Full sources and licences are on
the site's About page.
