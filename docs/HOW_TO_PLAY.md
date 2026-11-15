# How to play HALCYON

## The story

**Year 2291. Veyra, third moon of the gas giant Thessaly.** Halcyon is a crystal-mining colony of 2,400 people. Director Marek Voss has filed for a **full evacuation**. His report makes three claims:

1. Crystal yield has fallen below what the colony needs to survive.
2. Tremors from the Rift are harmless background noise.
3. The greenhouse blight should be fixed by switching to Filter B and banning maintenance drones.

The colony's chief statistician, **Dr. Ilse Okoro**, went silent at the Cryogeyser Basin two weeks ago. Her last message was: *"The numbers are lying, but not the way Voss thinks."*

You drive the survey rover **KESTREL-7**, helped by its onboard analyst AI, **TALLY**. You have 36 hours before the Council votes.

## Controls

| Action | Keys |
|---|---|
| Drive | `W A S D` or arrow keys |
| Boost | hold `Shift` |
| Interact with a beacon | `E` |
| Drop a probe (Chapter I) | `F` |
| Look around | drag with the mouse; scroll wheel to zoom |
| Advance dialogue | click or `Space` |
| Field manual | `C` |
| Sound on/off | `N` |
| Pause / settings | `Esc` |

## Goal and rules

- Follow the **objective** (top-left) and the **minimap** marker to the glowing **beacon** for each chapter, then press `E`.
- Every chapter produces one piece of **evidence**, rated **strong**, **partial** or **compromised** depending on your decisions. The four slots in the top-right track it.
- The **Council vote** (Chapter V) adds up your evidence. There are three endings: *Dawn over Halcyon*, *Halcyon Holds* and *The Long Night*.
- Hidden facts (the true crystal yield, whether the Rift is waking, when the geyser erupts) are **randomised every playthrough**. You can't memorise answers. You have to reason from data.
- Some actions cost **time** (listening hours, drone surveys, waiting at the geyser), which shows on the Council clock.

## The chapters

1. **Survey** (cyan beacon, Survey Depot). Drop 8 probes anywhere, then use Okoro's sampling simulator. Compare Voss's near-base method with random and stratified sampling, run 500 surveys to see the sampling distribution, then spend a 200-power budget on one real survey and make a claim backed by a 95% confidence interval.
2. **Static** (orange beacon, Rift Listening Post, east). Choose the null hypothesis, pick α and how long to listen, test your rule on 1,000 simulated nights, then listen to the Rift and decide: sound the alarm or stand down?
3. **Geyser Run** (pale-blue beacon, Basin Gate, north). Fit a line by hand to 272 real Old Faithful eruptions, compare it with least squares, then use your model to decide whether to cross the basin before the next eruption. If you go, you drive it yourself against the clock.
4. **Blight** (green beacon, Greenhouse Ring). Split the greenhouse data different ways to decide which filter really works, then decide whether the drones are spreading the blight.
5. **The Council** (amber beacon, Council Hall). Present your evidence and watch the vote.

## Playtest mode

Every new expedition starts with a 9-question check (about 2 minutes) and ends with a parallel 9-question check plus a short feedback form. The **Results** screen lets you **download your results (.json)**. Send that file to the playtest organiser. It contains only your answers, decisions, alias (optional) and feedback.

## Tips

- Your progress saves after each chapter. *Continue* on the title screen resumes from the next chapter.
- On a slow laptop, open the pause menu and switch **Graphics: Low**.
- Lost? *Reset rover to base* is in the pause menu.
