"""Run a small structural check against the generated browser data."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'
EVENTS = {'Position', 'BotPosition', 'Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot'}


def main() -> None:
    report = json.loads((DATA / 'build-report.json').read_text(encoding='utf-8'))
    catalog = json.loads((DATA / 'catalog.json').read_text(encoding='utf-8'))
    assert report['files_read'] == 1243, report
    assert report['rows_written'] == 89104, report
    assert report['invalid_coordinate_rows'] == 0, report
    assert catalog['maps'] == ['AmbroseValley', 'GrandRift', 'Lockdown'], catalog['maps']
    assert len(catalog['shards']) == 15, len(catalog['shards'])

    row_count = 0
    for shard in catalog['shards']:
        path = DATA / 'shards' / Path(shard['path']).name
        payload = json.loads(path.read_text(encoding='utf-8'))
        assert payload['fields'][-1] == 'event'
        assert len(payload['events']) == shard['rows']
        for row in payload['events']:
            assert row[0] == shard['map'] and row[1] == shard['date'], row[:2]
            assert 0 <= row[5] <= 1024 and 0 <= row[6] <= 1024, row[5:7]
            assert isinstance(row[7], int) and row[8] in EVENTS, row[7:]
        row_count += len(payload['events'])
    assert row_count == report['rows_written'], row_count
    print(f'OK: {len(catalog["shards"])} shards, {row_count} rows, all coordinates and events valid')


if __name__ == '__main__':
    main()
