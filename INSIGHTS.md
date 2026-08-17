# Insights

All figures below are calculated from the supplied 1,243 journey files / 89,104 event rows by `scripts/build_data.py`.

## 1. Ambrose Valley is where most observed behaviour happens

**What stands out.** Ambrose Valley contributes 61,013 events (68.5% of all telemetry), compared with 21,238 (23.8%) for Lockdown and 6,853 (7.7%) for Grand Rift.

**Action.** Prioritize Ambrose Valley traffic, loot, and death-zone reviews first. Compare its traffic heatmap with engagement and extraction outcomes before changing routes or POI placement.

**Potential metrics affected.** Player distribution across maps, engagement rate, extraction success, loot interaction rate, and queue/map-rotation balance.

**Why a Level Designer should care.** A map that carries most sessions creates the largest player impact and provides the most reliable evidence for level changes.

## 2. The telemetry is strongly bot-combat weighted

**What stands out.** There are 2,415 `BotKill` events and 700 `BotKilled` events, but only 3 `Kill` and 3 `Killed` events. The data includes 245 unique humans and 94 unique bots.

**Action.** Use the kill heatmap with bot visibility toggled off before making human PvP-spawn or choke-point decisions. Separately inspect bot encounter corridors and validate whether the six human-PvP events represent intended gameplay or sparse instrumentation.

**Potential metrics affected.** PvE/PvP combat mix, combat difficulty, human encounter rate, time-to-extract, and telemetry completeness.

**Why a Level Designer should care.** Bot encounters can create visually intense hotspots that should not be mistaken for human-versus-human conflict.

## 3. Movement is rich enough to guide route and POI decisions

**What stands out.** 73,059 rows (82.0%) are movement samples: 51,347 human positions and 21,712 bot positions. There are also 12,885 loot events.

**Action.** Start with the traffic heatmap, then turn on loot markers to identify high-traffic routes with weak pickup engagement and isolated loot clusters with little footfall. Test route readability, cover, loot placement, or objective placement in those areas.

**Potential metrics affected.** Route adoption, loot pickup rate, time spent in POIs, player retention during a match, and extraction completion.

**Why a Level Designer should care.** Dense movement data makes this tool useful for identifying both ignored spaces and over-concentrated paths without relying on anecdotes.
