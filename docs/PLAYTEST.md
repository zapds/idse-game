# Playtest protocol & evidence of learning

The rubric asks for *playtest evidence: a few peers tried it, with feedback or outcomes*. HALCYON collects this automatically. You only need to run the sessions and fill in the summary below.

## What the game measures

| Instrument | Details |
|---|---|
| **Pre-test** | 9 multiple-choice items (one per concept), set in **new contexts** (food apps, hospitals, fires) to test transfer, not recall of the game. |
| **Post-test** | A **parallel form** of the same 9 concepts with different scenarios. Forms A/B are **counterbalanced**: each player gets a random form first and the other one after, so form difficulty can't explain a gain. |
| **In-game behaviour** | CLT shape prediction (before seeing it), choice of H₀, sampling method, model used, data splits explored, final decisions, evidence tiers, ending, time played. |
| **Feedback** | Four 1–5 ratings (fun, clarity, discovered by playing, decisions mattered) and two free-text answers (what I learned, what was confusing). |

## Running a session (about 20–25 minutes per player)

1. Open the game (deployed link or `npm run dev`). Click **New expedition** and type the player's alias (e.g. `P1`).
2. The player takes the pre-test. **Don't help** with it.
3. The player plays all five chapters. Observe without giving answers. Note where they get stuck.
4. The player takes the post-test and fills in the feedback form.
5. On the results screen, click **Download results (.json)** and collect the file. If everyone plays on one laptop, the sessions are also archived in that browser.
6. Optional: ask one open question, e.g. *"Explain in your own words why Filter B looked better overall."*

## Analysing

Open **playtest.html** (title screen → *Playtest dashboard*), drop in all the JSON files (or click *Load sessions saved on this device*). It reports:

- mean pre vs post score, mean gain, **Hake's normalised gain** ⟨g⟩
- **paired t-test** on post − pre (t, df, two-sided p)
- % correct per concept, before vs after
- in-game behaviour, ratings and comments
- a **CSV export** for your report

Aim for **at least 5 players**. With 2–3 players the t-test will rarely be significant. Report the effect anyway and say so honestly.

## Evidence summary (fill in after your playtests)

| Player | Pre (/9) | Post (/9) | Gain | Ending | Fun (1–5) | Key quote |
|---|---|---|---|---|---|---|
| P1 | | | | | | |
| P2 | | | | | | |
| P3 | | | | | | |
| P4 | | | | | | |
| P5 | | | | | | |

**Summary:** mean pre ___ → mean post ___ (gain ___, ⟨g⟩ = ___), paired t(__) = ___, p = ___.

**Concepts with the biggest gain:** ___

**Concepts still weak:** ___

**What we changed after playtesting:** ___

> Only record what actually happened in your sessions. The dashboard computes every number from the players' files.
