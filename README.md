# HALCYON: a statistics expedition

> *The numbers say the colony must die. The numbers are lying.*

HALCYON is a 3D browser game for **CS3006 Introduction to Data Science for Engineers (Part B)**. You drive a survey rover across Veyra, a moon of the gas giant Thessaly, to save a colony of 2,400 people from an evacuation built on bad statistics. Each of the four chapters is a statistics concept you **discover by making decisions**, and your decisions change the ending.

| Chapter | Location | Concepts discovered by playing |
|---|---|---|
| I · Survey | Survey Depot | population vs sample, **sampling bias**, simple random vs **stratified** sampling, skew (mean vs median), **Central Limit Theorem**, SE = s/√n, **95% confidence intervals** |
| II · Static | Rift Listening Post | H₀/H₁, **Poisson** null distribution, **p-value**, α, rejection region, **Type I/II errors**, power |
| III · Geyser Run | Cryogeyser Basin | scatter plots, **least squares**, residuals, why Σe² and not Σe, SSE, **R²**, residual SD as prediction risk |
| IV · Blight | Greenhouse Ring | **confounding**, **Simpson's paradox**, Pearson r vs Spearman ρ, **correlation ≠ causation**, reverse causation |
| V · The Council | Council Hall | the vote: your evidence decides one of three endings |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (deploy anywhere: Vercel, Netlify, GitHub Pages)
npm run preview    # serve the production build
```

The game needs a WebGL-capable browser (desktop Chrome, Edge, Firefox or Safari) and a keyboard. Touch controls are included for tablets. If the frame rate is low, switch **Graphics → Low** in the pause menu (Esc).

- Game: `index.html`
- Playtest dashboard: `playtest.html` (also linked from the title screen)

## Documentation

- [How to play](docs/HOW_TO_PLAY.md)
- [Learning objectives & concept accuracy](docs/LEARNING_OBJECTIVES.md)
- [Game design & learning loop](docs/DESIGN.md)
- [Playtest protocol & evidence template](docs/PLAYTEST.md)

The same material is in the game itself under **Field manual** (press `C`).

## How this meets the rubric

| Criterion | Where |
|---|---|
| **Concept coverage & correctness (1.5)** | 4 chapters covering the lecture topics (descriptive, inferential, regression). Every chapter opens with **stated learning objectives**, ends with a **codex** of correct formulas, and has a recap at the end of the game. See `docs/LEARNING_OBJECTIVES.md`. |
| **Game design & learning loop (1.5)** | Clear goal (save Halcyon), rules (evidence tiers), feedback (immediate outcome plus explanation), and progression (5 chapters, 3 endings). Decisions change outcomes: sampling method and n, α and listening time, which regression line to trust and whether to cross, which filter to install and whether to ban drones. Players **predict before they see** (CLT shape, hypotheses) and test their own rules in simulators. |
| **Implementation (1)** | Runs in the browser with no server. **Every number is computed live** (`src/stats/stats.js`): sampling distributions, CIs, Poisson p-values, power by simulation, OLS, R², Pearson and Spearman. Hidden truths are randomised each playthrough. **Real data**: Old Faithful (272 eruptions) and Charig et al. 1986 (Simpson's paradox). |
| **Documentation & evidence of learning (1)** | How-to-play guide, learning objectives, built-in **pre-test/post-test** (parallel forms, counterbalanced), feedback form, JSON export, and a **playtest dashboard** that computes the learning gain with a **paired t-test**. See `docs/PLAYTEST.md`. |

## Project structure

```
src/
  main.js              boot, title, game loop, chapter orchestration
  state.js             save game + playtest telemetry + export
  stats/
    stats.js           statistics engine (mean, SD, CI, Poisson, OLS, R², r, ρ, t-test)
    rng.js             seeded RNG + samplers (normal, Poisson, exponential)
    faithful.js        REAL Old Faithful data (R datasets::faithful)
  engine/
    world.js           Three.js scene: sky, gas giant, terrain, crystals, base, rift, geysers, bloom
    geo.js             terrain height + crystal-yield field + landmarks (shared with the labs)
    rover.js           rover model, driving physics, chase camera
    audio.js           procedural WebAudio sound
  chapters/            ch1_survey, ch2_static, ch3_geyser, ch4_blight, finale
  ui/                  HUD, dialogue, charts, panels, tests, manual, feedback
  playtest.js          playtest dashboard
public/data/faithful.csv   original data file
```

## Data sources

- **Old Faithful geyser data**: Azzalini, A. & Bowman, A. W. (1990). *A look at some data on the Old Faithful geyser.* Applied Statistics 39, 357–365. Distributed as R `datasets::faithful`.
- **Kidney-stone treatments**: Charig, C. R. et al. (1986). *Comparison of treatment of renal calculi by open surgery, percutaneous nephrolithotomy, and extracorporeal shockwave lithotripsy.* BMJ 292, 879–882. In the game the counts are reframed as filters × dome size, with the numbers unchanged.
- **UC Berkeley admissions** (post-test item): Bickel, Hammel & O'Connell (1975), *Science* 187, 398–404.
- Chapter I's yield field, Chapter II's pulses and Chapter IV part 2 are **simulated** with known ground truth, so the game can always tell you what actually happened.

Tech: Three.js, Vite, vanilla JS, Canvas 2D charts, WebAudio. No external services. Fonts are bundled.

## Deployment

Live at **https://halcyon.zapdos.me** (Oracle VPS, PM2 app `halcyon` → `server.cjs` on `127.0.0.1:3108`, Caddy reverse proxy).
Update: `npm run build`, upload `dist/ server.cjs ecosystem.config.cjs` into a new `/home/ubuntu/halcyon/releases/<timestamp>`, repoint `/home/ubuntu/halcyon/current`, then `pm2 startOrReload /home/ubuntu/halcyon/current/ecosystem.config.cjs --only halcyon --update-env && pm2 save`.
