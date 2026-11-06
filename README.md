# LUNAR STATION | المحطة القمرية

A bilingual (Arabic default, English) seven-day lunar base management simulation for children aged 7–12, by Team MADAR.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # simulation engine tests
npm run build
```

## Exploration mode (`src/adventure/`)

You play as Commander Noor and walk around the base. Controls: **W A S D** or **arrow keys** to move, **Shift** to run, **Space** to jump, **E** to interact. With the mouse, click the ground to walk there, drag to look around, and scroll to zoom.

- `world.ts` – walkable ground, collision shapes and interaction spots for the surface and the habitat interior.
- `Explorer.tsx` – movement loop, follow camera, `[E]` prompts, off-screen guidance arrow. On the surface you lope with a suit and get long low-gravity jumps; indoors there is no suit, so movement is quicker and jumps are small.
- `steps.ts` – 2–4 short objectives per day, plus where each decision happens in the world.
- `CircuitPuzzle.tsx` – Day 1: reconnect the loose solar cable by matching panel plugs to sockets (colour + shape). This restores panel output from 85 % to 100 %.
- `PipePuzzle.tsx` – the Day 2 water-repair mini-game (rotate pipes until water flows, with hints).
- `AdventureHud.tsx` – LUNA the assistant, objective tracker, choice card, celebrations and badges.

**Vertical slice:** Day 2 "Water emergency" is fully built: alert → walk into the habitat → find the faulty machine → choose → pipe mini-game → recycler 55 % → 88 % → celebration and badge → sleep to end the day. Day 1 also has its solar circuit mini-game. Days 3–7 use walking, prompts and in-world choices; their own mini-games are still to come.

## Architecture

| Folder | Purpose |
|---|---|
| `src/config/science.ts` | Four separate groups: `NASA_REFERENCE`, `DERIVED`, `SIM_ASSUMPTIONS`, `BALANCE` |
| `src/sim/rates.ts` | One function (`computeRates`) computes every 24 h flow; the UI forecast and the day transition both use it |
| `src/sim/engine.ts` | New game, player actions, decisions, `endDay` (fixed processing order), `continueDay`, scoring |
| `src/sim/missions.ts` | Day-start scenario, decision events, delayed-consequence effects (stored by key), daily objectives |
| `src/sim/status.ts` | System levels and alerts, derived only from the simulation state |
| `src/store/` | Zustand store + versioned localStorage persistence with corrupted-save recovery |
| `src/i18n/` | Structured `ar` / `en` dictionaries (`ar` is type-checked to have every English key) |
| `src/components/scene/` | Layered 2.5D SVG lunar base with interactive facilities and camera focus |
| `src/components/systems/` | Five system control screens |
| `src/components/screens/` | Welcome, briefing, decision, timeline, status, settings, daily report, final results |
| `src/services/donki.ts` | Opt-in NASA DONKI solar-flare lookup (display only, never drives the game) |
| `src/audio/sfx.ts` | Synthesized WebAudio effects and ambient pad (no audio files) |

### Day transition order (`endDay`)
1. Rates computed once from current settings → 2. Battery = previous + charged − used → 3. Oxygen → 4. Water: consumption once, then recovery **only of wastewater entering the recycler** → 5. Food → 6. Plants → 7. Crew health and radiation → 8. DTN auto-forward of queued messages → 9. Failure check → 10. Report. Delayed consequences apply at the start of the next day, after scripted day-start conditions.

## Seven-day mission and consequence examples
| Day | Event | Example delayed consequence |
|---|---|---|
| 1 | Energy plan | “Greenhouse first” weakens life support; plants gain leaves on Day 3 |
| 2 | Recycler at 55 % | Not repairing → recycler worsens (Day 3), repair costs 2 parts (Day 3), water-triage decision (Day 4) |
| 3 | Dust on panels (65 %) | Not cleaning → more dust on Day 6; dimming → plants drop leaves on Day 5 |
| 4 | Solar particle event | Shelter readiness depends on inspecting it on Day 1 or 4; EVA during storm → health hit Day 5 |
| 5 | Relay lost | Messages are queued, never deleted; late relay pass has limited bandwidth, rest carry over |
| 6 | CO₂ scrubber failing | Backup canisters must be replaced next day and can run out |
| 7 | Final assessment | Score from health, resources, systems, plants, comms, decision quality, objectives |

## Scientific values vs. game assumptions
- **NASA reference:** O₂ 0.771 / 1.083 kg/day, water 2.5 + 0.4 L/day, CO₂ 350 L/day and 3 mmHg threshold, 16 h/8 h photoperiod, 384,400 km, 299,792 km/s, ISS 98 % recovery (shown as a demo value only).
- **Derived:** 1.28 s / 2.56 s light time, 1.125 kg water per kg O₂ (electrolysis).
- **Game assumptions (labelled in-game):** tank capacities and starting amounts, 85 % recycler, 70 % of drinking water returning as wastewater, 0.25 kW average solar, the 5.6 kWh/day load split, relay path geometry, plant-health model, radiation “simulated units” (not mSv).

## Notes and limitations
- The base is on the far side, so Earth is intentionally **not** drawn in the sky; the relay satellite is shown instead and Earth appears in the Communications diagram.
- The scene is hand-built 2.5D SVG (not WebGL 3D), with hotspots aligned to the drawn facilities.
- The reference image and source documents were not available in this workspace, so visuals and the scenario follow the written brief.
- DONKI uses NASA's rate-limited `DEMO_KEY`; set `VITE_NASA_API_KEY` for your own key.
