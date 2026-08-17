# Player Journey Explorer — Walkthrough

This guide explains how a Level Designer can use the dashboard, how telemetry is prepared, and how each assignment requirement is implemented.

## 1. Start the dashboard

From the repository root:

```bash
pnpm install
pnpm build:data
pnpm verify:data
pnpm dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173/`). The production build is created with `pnpm build`. The Vercel configuration runs the data build, validation, and frontend build during deployment. No environment variables are required.

## 2. What appears on screen

The dashboard is organised into three areas:

- **Explore controls** on the left for map, date, match, player population, event, and heatmap filters.
- **Journey map** in the main workspace, showing the selected minimap with paths and event markers.
- **Evidence and playback panels** below the map for match replay, event inspection, CSV export, and data-backed design prompts.

The header reports the number of source events and journey files. The map header reports the currently visible player and event counts.

## 3. Explore maps and dates

1. Choose one of the three maps from **Map**.
2. Choose **All dates** or a collection date from **Date**.
3. The browser loads only the matching map/date JSON shards instead of downloading all raw telemetry at once.
4. Changing map or date clears the selected match so that a match cannot accidentally be replayed against the wrong shard.

The supplied minimap image is rendered as the base layer. Player coordinates are drawn in the same logical 1024×1024 space, so the overlay remains aligned even when the source minimap image has a different pixel size.

## 4. Find and select a match

Use **Search matches** to filter the match list by a short ID prefix or any part of its raw identifier. Select a result from **Match** to focus the dashboard on one game session.

Each option includes a short readable ID, player/journey count, and collection date. The list is capped at 150 options for responsiveness; the hint below the control asks the user to refine the search when more matches are available.

Match identity is date-qualified internally. This prevents raw IDs that repeat across collection folders from being merged into one journey.

## 5. Read player journeys

Movement events are grouped by `match + player` and sorted by timestamp before being drawn as paths:

- **Green paths** represent human players.
- **Purple, lower-opacity paths** represent bots.

Use the **Players** checkboxes to show humans, bots, or both. This makes it possible to compare human routes with NPC traffic and to avoid treating bot combat as human-versus-human behaviour.

## 6. Read event markers

The **Events** controls can isolate event categories relevant to a design question. The map legend and markers use distinct visual encodings:

| Event | Marker | Meaning |
|---|---|---|
| Human kill | Amber cross | A kill attributed to a human player |
| Bot kill | Cyan boxed cross | A kill attributed to a bot |
| Human death | Red outlined circle | A human player was killed |
| Bot-caused death | Purple outlined square | A player death attributed to a bot |
| Storm death | Amber diamond | The player was eliminated by the storm |
| Loot | Cyan square | A recorded loot interaction |

Hover over a discrete marker to see its event label, player, and logical map position. Click a marker to open the **Selected event** inspector, which also shows the match identifier and exact rounded coordinates. Movement rows are intentionally rendered as paths rather than thousands of individual dots.

## 7. Use heatmaps

Choose an overlay from **Heatmap**:

- **Player traffic** aggregates movement rows to show heavily travelled areas.
- **Kill zones** aggregates kill events.
- **Death zones** aggregates death and storm-death events.
- **None** removes the overlay.

Heatmaps use 32×32 logical map cells and a weighted blur. This keeps the visualization readable and performant while remaining honest about what was observed: traffic is based on recorded movement samples, not an invented continuous occupancy model.

## 8. Zoom, pan, and inspect dense areas

Use the map controls to zoom in, zoom out, or reset the view. The mouse wheel also changes zoom, while dragging pans the map. These controls are useful for examining choke points, POIs, storm edges, and areas where markers overlap.

## 9. Replay a match

1. Select one match.
2. Press **Replay** to start from the beginning, or use the scrubber to choose a position.
3. Press **Pause** or drag the slider to inspect a moment.

Playback normalises the selected match's earliest and latest telemetry timestamps to 0–100%. This communicates event order reliably even though the source timestamps are compressed telemetry values rather than a trusted wall-clock duration. Both paths and discrete events are progressively revealed as the slider advances.

Playback is disabled when **All matching journeys** is selected because there is no single timeline to replay.

## 10. Filter, reset, and export

- Event and player filters update the map and metrics immediately.
- **Reset filters** returns to Ambrose Valley, all dates, all matches, all event types, both player populations, and no heatmap.
- **Export CSV** downloads the currently filtered rows, including map, date, match, player, bot flag, coordinates, timestamp, and event name.
- Map, date, match, and heatmap choices are reflected in the URL query string, so a filtered view can be copied and shared.

## 11. How the data pipeline works

The source contains 1,243 extensionless Parquet files across five date folders. `scripts/build_data.py`:

1. Reads every valid Parquet file with PyArrow.
2. Decodes the byte-encoded `event` field.
3. Derives the collection date from the parent folder.
4. Detects bots from numeric `user_id` values and maps the supported bot event names.
5. Converts world `x/z` coordinates to minimap coordinates using the map-specific origin and scale from the supplied README.
6. Validates event names and coordinate bounds.
7. Writes compact map/date shards and `public/data/catalog.json`.

The frontend fetches the catalog first and then requests only the shards needed by the current map/date selection. `scripts/verify_data.py` checks shard counts, row counts, coordinate bounds, and event vocabulary before a deployment is accepted.

## 12. Coordinate mapping assumptions

The source telemetry is 3D. The dashboard uses `x` and `z` for the 2D map; `y` is elevation and is not plotted. For each map:

```text
u = (x - origin_x) / scale
v = (z - origin_z) / scale
map_x = u * 1024
map_y = (1 - v) * 1024
```

The vertical flip is required because game coordinates use a bottom-left-style spatial orientation while images use a top-left pixel origin. Out-of-bounds converted points fail the data validation step rather than being silently drawn in the wrong location.

## 13. Design insights included in the tool

The **What the telemetry suggests** cards connect the visualization to level-design decisions. They are also documented in `INSIGHTS.md`:

1. **Ambrose Valley carries the dataset** — 61,013 events (68.5%), so it is the strongest starting point for route and POI review.
2. **Combat is strongly bot-weighted** — the observed event mix contains 2,415 `BotKill` events versus 3 `Kill` events, so bot encounters should be separated from human PvP analysis.
3. **Movement supports route analysis** — 73,059 movement rows provide enough signal to compare traffic concentration with loot activity and investigate ignored spaces.

Each insight includes the observed pattern, a concrete statistic, an actionable design implication, and why a Level Designer should care.

## 14. Assignment requirement checklist

- [x] Loads and parses the supplied Parquet data.
- [x] Displays journeys on the correct minimap with world-to-image coordinate mapping.
- [x] Distinguishes human and bot players visually and with filters.
- [x] Marks kills, deaths, loot, and storm deaths distinctly.
- [x] Filters by map, date, and match.
- [x] Provides match timeline/playback.
- [x] Provides traffic, kill-zone, and death-zone heatmaps.
- [x] Includes responsive controls, empty/loading states, URL sharing, and CSV export.
- [x] Documents architecture and coordinate mapping in `ARCHITECTURE.md`.
- [x] Documents three evidence-backed game insights in `INSIGHTS.md`.
- [x] Includes this walkthrough for evaluator and Level Designer use.

For a submission, publish the repository through a static host such as Vercel. The included `vercel.json` defines the build command and `dist` output directory; the deployed URL should be added to the repository README once the host provides it.
