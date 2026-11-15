# Game design & learning loop

## Design pillars

1. **Discover, don't read.** Every concept arrives as a problem the player has to act on (drive, sample, set a rule, fit a line, split data) before the explanation appears. Explanations come *after* the player's own result, as a debrief ("codex unlocked").
2. **Decisions with consequences.** Each chapter ends in a choice whose outcome is computed from the player's own numbers and a hidden, randomised truth. Statistically good choices pay off more often, and bad ones fail in a way the debrief can name (bias, Type II error, over-claiming, confounding).
3. **Real computation, real data.** No answer is hard-coded. Two chapters use real published data, and the other two use simulations with known ground truth, so the game can always show what really happened.
4. **One story ties it together.** All four claims come from the same evacuation report, and the finale cross-examines each one with the player's evidence.

## The core loop (each chapter)

```
  Claim (Voss)  →  Explore (drive / simulate / manipulate)  →  Predict / set a rule
        ↑                                                            ↓
   Next chapter  ←  Debrief + codex  ←  Outcome (hidden truth revealed)  ←  Decide
```

| Chapter | Explore | Predict / rule | Decide | Outcome depends on |
|---|---|---|---|---|
| I | 8 probes in 3D; sampling simulator | CLT shape prediction | method, n (budget), claim | bias of method, CI width, claim consistency |
| II | 1,000-night simulator for any α, T | H₀ choice; α and T locked before data | alarm or stand down | hidden truth (Rift waking?), p vs α, time cost |
| III | drag the line, residual squares, naive guesser | which model to trust | cross now or wait | model quality, residual SD, bootstrapped real residual, driving |
| IV | three ways to split the data; scatter vs timeline | reason for the reversal | filter; drone policy | confounder recognised, causal direction |
| V | n/a | n/a | n/a | sum of evidence tiers gives 1 of 3 endings |

## Feedback and progression

- **Immediate feedback:** HUD readings, live statistics, simulation results, and a debrief after every decision.
- **Progress feedback:** evidence slots (strong, partial or compromised), the Council clock, objectives and minimap.
- **End feedback:** an ending cinematic, a per-chapter recap with the player's own numbers, and the pre/post score comparison.
- **Replayability:** hidden truths are re-drawn every run (seeded RNG), so a second playthrough tests understanding rather than memory.

## Visual and audio direction

Low-poly, flat-shaded 3D at violet dusk. Thessaly, a banded teal gas giant with rings, fills the sky. Bioluminescent crystals whose *density follows the true yield field* make the sampling bias visible from the driver's seat. There's a glowing Rift fissure and cryogeyser plumes. The UI is glassy and editorial (Instrument Serif headings, Space Grotesk text, JetBrains Mono numbers). All audio is procedural (WebAudio): an ambient pad, engine hum, seismic thumps and geyser roar.

## Characters

- **TALLY**: the rover's analyst AI; tutor voice and hints.
- **Director Marek Voss**: makes the three statistical claims (each one a classic fallacy).
- **Dr. Ilse Okoro**: chief statistician, heard through recorded logs; can be rescued in Chapter III.
- **Chair Amara Reyes**: runs the Council vote.
