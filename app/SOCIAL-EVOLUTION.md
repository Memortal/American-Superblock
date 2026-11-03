# MEMO / Social Evolution v1 — architecture and experiment contract

## System boundary
- Entry point: existing **Life Lab → Social Evolution ↗**.
- Runtime: browser ES modules, no new dependencies, no GPT/API calls.
- Inputs: active modeled `buildings[].courtyard` and fixed `entrances[]` from the American Superblock.
- Geometry: **only four courtyard use programs, benches and shade proposal overlays**. Entrances, cores, dwelling envelopes, Level 4 VOID, egress, structure, MEP, and source IFC/BIM remain unchanged.
- A courtyard is represented by a centroid and conservative radius; collision/route checks are **not performed**. No mutation is construction-ready.

## Agent state and behavior
- For each run, fixed resident profiles from a seeded PRNG: home courtyard, age, sociability, privacy preference, mobility, preferred program, social consent, and one of three schedule types.
- Each resident independently decides whether to go out in two daily windows; sociality, privacy and schedule affect willingness.
- The resident selects a public courtyard based on preference-program match, seating, shade, stochastic routine variation, and distance from the home courtyard.
- Attendees are subject to a capacity proxy; overflow adds crowding penalty.
- Mutual, voluntary contacts may be recorded between present agents, with a per-pair deterministic random draw. Repeated contacts on separate simulated days form a sustained relationship. Interaction attempts without mutual interest count against contact respect.
- **No personal medical, demographic identity, health or protected-class assumptions are involved.** All agents are synthetic; no empirical calibration.

## Fitness
Normalizing metrics to 0–1:
- I: positive voluntary interactions per resident-day, capped at a target of 0.32 pair-interactions per resident-day.
- R: fraction of residents involved in ties formed on at least two different days.
- D: fraction of sustained ties across homes in different modeled buildings.
- P: fraction of residents completing at least max(3, ceil(days/6)) voluntary visits.
- C: contact respect = 1 − unwanted contact attempts / all attempts.
- H: overcrowded visit slots / all voluntary participations.
- L: fraction without sustained ties.
- K: relative intervention complexity points.

`raw_social = 100 × (0.30 I + 0.27 R + 0.16 D + 0.17 P + 0.10 C)`

`fitness = clamp(raw_social − 18 H − 9 (1−C) − 0.18 K − 8 L, 0, 100)`

The scoring weights are adjustable research assumptions, not validated predictors of happiness or social relationships. There is no claim of AI-discovered best architecture.

## Mutation rules
- Exactly four existing courtyard IDs; positions, radii, building IDs remain fixed.
- Per-courtyard genome: program in {open, commons, garden, culture, maker, quiet}; seating count 0–4; shade structures 0–2.
- Schematic object-footprint guard: `18 × seats + 34 × shade + 48 × (program != open) <= 55% of courtyard-area proxy`.
- This is **not** a clearance or physical clash certification. Detailed constraints need upstream verified path/geometry APIs.
- Gen 0 is baseline; offspring mutate one courtyard and one trait. Duplicate or invalid candidates are not evaluated. Elitist archive retains best eight valid candidates.

## Experiment and repeatability
- Defaults: 80 agents, 30 simulated days, 4 generations, 5 candidates/generation, 3 matched seeds (20261026–20261028).
- Baseline and every candidate use identical seeds, profiles, schedules and pair-level pseudo-random comparisons.
- Store per-seed metrics, mean aggregate fitness, per-courtyard visits, all generations and design genome. Provide cancel and JSON export.
- UI visualizes baseline/evolved scores and proposed changes as independent scene graph objects; Hide/Restore disposes their meshes.
- Tests must assert determinism, invalid-mutation rejection, unchanged source objects, surviving entrances, reversible baseline, and monotone elite best score.

## Known limitations / roadmap
1. The Life Lab's legacy animation and new social optimizer do not yet share a physically routed agent navigation mesh or persistent relationship memory. This module is a **parallel controlled study** linked to the existing model.
2. Before generating exterior proposals beyond schematic overlays, add verified accessible walkable cells, site grade, setbacks, utility bands, privacy buffers, fire paths, and entrance/core route masks.
3. Expand to 16 entrance thresholds only when each required spatial/MEP/structural check is available. Preserve airlocks and no public access into residential privacy zones.
4. Calibrate probability parameters against voluntary observations/participatory resident surveys before comparing actual design alternatives.
5. Replace the fixed weighted fitness with multiobjective/Pareto optimization; guard low-participation subpopulations and require design robustness across more sampled scenarios.
6. Validate with held-out seeds, seasonal/weather scenarios, and traffic/visitor profiles; provide uncertainty ranges, not single deterministic predictions.
