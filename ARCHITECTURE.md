# Architecture

## What was built

Player Journey Explorer is a static React/TypeScript application for Level Designers. It renders selected player journeys over a minimap, separates human and bot movement, surfaces important gameplay events, and provides filter, playback, and heatmap workflows. The app uses Canvas rather than a mapping library because the maps are fixed images with a single, known coordinate system.

## Data flow

```
data/raw/telemetry/ (1,243 Parquet journey files)
        ↓  scripts/build_data.py (PyArrow)
public/data/shards/*.json + catalog.json
        ↓  browser fetch on load
React filters → Canvas paths, event markers, heatmap, playback
```

The preprocessing script is deliberately part of the repository. It reads every `.nakama-0` file, decodes the byte-encoded `event` column, derives the date from the source folder, identifies bots from numeric user IDs, checks the known schema/event names, converts positions to logical map coordinates, and produces compact map/date shards. `catalog.json` holds filter metadata; the browser fetches only the selected map/date shards. This reduces the initial payload while preserving a simple static deployment.

## Coordinate mapping

The game telemetry is 3D. The visualisation intentionally uses only world `x` and `z`; `y` is elevation. For every map, the converter applies the supplied constants:

```
u = (x - origin_x) / scale
v = (z - origin_z) / scale
map_x = u * 1024
map_y = (1 - v) * 1024
```

The result is stored in a 1024×1024 *logical* space. This matters because the supplied minimap source files are not all 1024×1024. The browser stretches each background image into the same logical square and draws the converted points on top, so source-image resolution does not affect location accuracy. The build validates that every supplied coordinate falls inside its configured bounds.

## UI behaviour

- Movement (`Position`, `BotPosition`) is grouped by match/player and drawn as paths.
- Humans are green; bots are purple and more transparent.
- `Kill`/`BotKill`, `Killed`/`BotKilled`, `KilledByStorm`, and `Loot` use distinct symbols.
- Playback is enabled only when one match is selected. The data timestamps are normalized to a 0–100% scrubber, avoiding a misleading wall-clock display for compressed telemetry times.
- Heatmaps first aggregate rows into 32×32 logical cells, then render a weighted blur per cell. This is readable and avoids drawing tens of thousands of expensive circles.
- Match search, URL query state, reset filters, CSV export, zoom/pan, and click-to-inspect event details support repeatable design investigations.

## Assumptions and trade-offs

| Decision | Reason / trade-off |
|---|---|
| Static preprocessed JSON instead of browser Parquet parsing | Faster initial experience and simple deployment; data must be rebuilt when source telemetry changes. |
| Date-qualified match identity | At least one raw `match_id` occurs in multiple collection-date folders, so playback/filtering uses `(date, raw match ID)` to prevent accidental cross-day merges. |
| Canvas rather than a map SDK | Lightweight and precise for fixed image maps; custom image-space zoom/pan is enough for this workflow. |
| Playback shown as progress, not elapsed clock time | Source match ranges are only 13–890 ms, so relative order is more useful than a literal duration. |
| Heatmaps use event locations, not interpolated paths | Honest to observed telemetry and performant; they do not claim continuous player occupancy. |
