"""Convert LILA BLACK's Parquet telemetry into static files for the browser."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq


ROOT = Path(__file__).resolve().parents[1]
LOGICAL_MAP_SIZE = 1024
MAPS = {
    'AmbroseValley': {'scale': 900, 'origin_x': -370, 'origin_z': -473},
    'GrandRift': {'scale': 581, 'origin_x': -290, 'origin_z': -290},
    'Lockdown': {'scale': 1000, 'origin_x': -500, 'origin_z': -500},
}
EVENTS = {'Position', 'BotPosition', 'Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot'}


def event_name(value: Any) -> str:
    return value.decode('utf-8') if isinstance(value, bytes) else str(value)


def logical_position(map_id: str, x: float, z: float) -> tuple[float, float]:
    config = MAPS[map_id]
    u = (x - config['origin_x']) / config['scale']
    v = (z - config['origin_z']) / config['scale']
    return round(u * LOGICAL_MAP_SIZE, 2), round((1 - v) * LOGICAL_MAP_SIZE, 2)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'public' / 'data')
    args = parser.parse_args()

    files = sorted((ROOT / 'data' / 'raw' / 'telemetry').glob('February_*/*.nakama-0'))
    if not files:
        raise SystemExit('No .nakama-0 files found under data/raw/telemetry. Check the source data layout.')

    packed: list[list[Any]] = []
    shard_rows: dict[tuple[str, str], list[list[Any]]] = defaultdict(list)
    journeys: dict[str, set[str]] = defaultdict(set)
    match_meta: dict[str, dict[str, Any]] = {}
    users: dict[bool, set[str]] = {False: set(), True: set()}
    map_counts: Counter[str] = Counter()
    event_counts: Counter[str] = Counter()
    raw_match_dates: dict[str, set[str]] = defaultdict(set)
    invalid_points = 0

    for path in files:
        date = path.parent.name.replace('_', ' ')
        data = pq.read_table(path).to_pydict()
        for user, match, map_id, x, z, timestamp, raw_event in zip(
            data['user_id'], data['match_id'], data['map_id'], data['x'], data['z'], data['ts'], data['event'],
        ):
            user_id, match_id, map_name = str(user), str(match), str(map_id)
            name = event_name(raw_event)
            if map_name not in MAPS:
                raise ValueError(f'Unknown map {map_name!r} in {path}')
            if name not in EVENTS:
                raise ValueError(f'Unknown event {name!r} in {path}')

            bot = user_id.isdigit()
            px, py = logical_position(map_name, float(x), float(z))
            if not (0 <= px <= LOGICAL_MAP_SIZE and 0 <= py <= LOGICAL_MAP_SIZE):
                invalid_points += 1
            timestamp_ms = int(timestamp.timestamp() * 1000)
            # Raw match IDs are reused across at least two collection folders. The
            # date-qualified key is the only safe identity for filters/playback.
            match_key = f'{date}|{match_id}'
            packed.append([map_name, date, match_key, user_id, bot, px, py, timestamp_ms, name])
            shard_rows[(map_name, date)].append([map_name, date, match_key, user_id, bot, px, py, timestamp_ms, name])
            journeys[match_key].add(user_id)
            users[bot].add(user_id)
            map_counts[map_name] += 1
            event_counts[name] += 1
            raw_match_dates[match_id].add(date)

            summary = match_meta.setdefault(match_key, {
                'id': match_key, 'source_id': match_id, 'map': map_name, 'date': date, 'journeys': 0, 'events': 0,
                'start': timestamp_ms, 'end': timestamp_ms,
            })
            if summary['map'] != map_name or summary['date'] != date:
                raise ValueError(f'Match {match_key} has inconsistent map/date metadata')
            summary['events'] += 1
            summary['start'] = min(summary['start'], timestamp_ms)
            summary['end'] = max(summary['end'], timestamp_ms)

    for match_id, player_ids in journeys.items():
        match_meta[match_id]['journeys'] = len(player_ids)

    if invalid_points:
        raise ValueError(f'{invalid_points} rows fall outside configured minimap bounds')

    packed.sort(key=lambda row: (row[0], row[1], row[2], row[7], row[3]))
    matches = sorted(match_meta.values(), key=lambda item: (item['date'], item['map'], item['id']))
    shards = []
    for (map_name, date), rows in sorted(shard_rows.items()):
        slug = f"{map_name.lower()}__{date.lower().replace(' ', '-')}"
        shards.append({'map': map_name, 'date': date, 'path': f"/data/shards/{slug}.json", 'rows': len(rows)})
    catalog = {
        'maps': list(MAPS),
        'dates': sorted({row[1] for row in packed}),
        'shards': shards,
        'matches': matches,
        'totals': {'files': len(files), 'rows': len(packed), 'humans': len(users[False]), 'bots': len(users[True])},
    }
    report = {
        'files_read': len(files), 'rows_written': len(packed), 'invalid_coordinate_rows': invalid_points,
        'rows_by_map': dict(map_counts), 'events': dict(event_counts),
        'raw_match_ids_spanning_dates': sum(len(dates) > 1 for dates in raw_match_dates.values()),
    }

    args.output.mkdir(parents=True, exist_ok=True)
    shard_dir = args.output / 'shards'
    shard_dir.mkdir(parents=True, exist_ok=True)
    for (map_name, date), rows in shard_rows.items():
        slug = f"{map_name.lower()}__{date.lower().replace(' ', '-')}"
        (shard_dir / f'{slug}.json').write_text(
            json.dumps({'fields': ['map', 'date', 'match', 'user', 'bot', 'x', 'y', 't', 'event'], 'events': rows}, separators=(',', ':')),
            encoding='utf-8',
        )
    (args.output / 'catalog.json').write_text(json.dumps(catalog, separators=(',', ':')), encoding='utf-8')
    (args.output / 'build-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
