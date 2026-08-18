import { useEffect, useMemo, useRef, useState } from 'react';
import { DEATH_EVENTS, EVENT_TYPES, eventLabel, KILL_EVENTS, MAP_IMAGES, MOVEMENT_EVENTS } from './mapConfig';
import type { Catalog, EventName, EventRow, PackedEvents } from './types';

type HeatmapMode = 'none' | 'traffic' | 'kills' | 'deaths';
const logicalSize = 1024;
const defaultEvents = new Set<EventName>(EVENT_TYPES);
const insights = [
  { title: 'Ambrose Valley carries the dataset', stat: '61,013 events · 68.5%', body: 'Start route and POI reviews here because it has the strongest evidence base and the largest player impact.' },
  { title: 'Combat is strongly bot-weighted', stat: '2,415 BotKill vs 3 Kill', body: 'Separate bot encounters from human PvP before changing choke points or spawn locations.' },
  { title: 'Movement supports route analysis', stat: '73,059 movement rows', body: 'Compare traffic with loot markers to find ignored spaces and over-concentrated paths.' },
];

function unpack(data: PackedEvents): EventRow[] { return data.events.map(([map, date, match, user, bot, x, y, t, event]) => ({ map, date, match, user, bot, x, y, t, event })); }
function formatMatch(match: string) { const parts = match.split('|'); return parts[parts.length - 1].replace('.nakama-0', '').slice(0, 8); }
function readParam(name: string, fallback: string) { return new URLSearchParams(window.location.search).get(name) || fallback; }

function marker(ctx: CanvasRenderingContext2D, item: EventRow) {
  const { x, y } = item; ctx.lineWidth = 2.5;
  if (item.event === 'Kill') { ctx.strokeStyle = '#ffaa00'; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
  else if (item.event === 'BotKill') { ctx.strokeStyle = '#07cbff'; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); ctx.strokeRect(x - 3, y - 3, 6, 6); }
  else if (item.event === 'Killed') { ctx.strokeStyle = '#ff7c7c'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }
  else if (item.event === 'BotKilled') { ctx.strokeStyle = '#b7a0f4'; ctx.strokeRect(x - 6, y - 6, 12, 12); }
  else if (item.event === 'KilledByStorm') { ctx.fillStyle = '#ffb663'; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); }
  else if (item.event === 'Loot') { ctx.fillStyle = '#07cbff'; ctx.fillRect(x - 4, y - 4, 8, 8); }
}

function JourneyMap({ map, rows, heatmap, playback, onEventSelect }: { map: string; rows: EventRow[]; heatmap: HeatmapMode; playback: number | null; onEventSelect: (event: EventRow | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null); const drag = useRef({ active: false, moved: false, x: 0, y: 0, panX: 0, panY: 0 });
  const [imageFailed, setImageFailed] = useState(false); const [zoom, setZoom] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 }); const [hoverEvent, setHoverEvent] = useState<EventRow | null>(null);
  const clampPan = (next: { x: number; y: number }, scale = zoom) => { const size = canvas.current?.clientWidth ?? 0; const limit = Math.max(0, size * (scale - 1) + (scale > 1 ? 48 : 0)); return { x: Math.min(0, Math.max(-limit, next.x)), y: Math.min(0, Math.max(-limit, next.y)) }; };
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [map]);
  useEffect(() => { setPan((current) => clampPan(current)); }, [zoom]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const draw = () => {
      const width = element.clientWidth; const height = element.clientHeight; const ratio = window.devicePixelRatio || 1; element.width = width * ratio; element.height = height * ratio;
      const ctx = element.getContext('2d'); if (!ctx) return; ctx.setTransform(ratio * width / logicalSize, 0, 0, ratio * height / logicalSize, 0, 0); ctx.clearRect(0, 0, logicalSize, logicalSize);
      const movement = rows.filter((row) => MOVEMENT_EVENTS.has(row.event)); const discrete = rows.filter((row) => !MOVEMENT_EVENTS.has(row.event));
      const bounds = rows.reduce<[number, number]>((acc, row) => [Math.min(acc[0], row.t), Math.max(acc[1], row.t)], [Infinity, -Infinity]);
      const cutoff = playback === null || !Number.isFinite(bounds[0]) ? Infinity : bounds[0] + ((bounds[1] - bounds[0]) * playback / 100);
      const visibleMovement = movement.filter((row) => row.t <= cutoff); const visibleDiscrete = discrete.filter((row) => row.t <= cutoff);
      if (heatmap !== 'none') {
        const heatRows = heatmap === 'traffic' ? visibleMovement : visibleDiscrete.filter((row) => heatmap === 'kills' ? KILL_EVENTS.has(row.event) : DEATH_EVENTS.has(row.event));
        const cells = new Map<string, { x: number; y: number; count: number }>();
        for (const row of heatRows) { const key = `${Math.floor(row.x / 32)}:${Math.floor(row.y / 32)}`; const cell = cells.get(key) ?? { x: Math.floor(row.x / 32) * 32 + 16, y: Math.floor(row.y / 32) * 32 + 16, count: 0 }; cell.count += 1; cells.set(key, cell); }
        const max = Math.max(1, ...[...cells.values()].map((cell) => cell.count));
        for (const cell of cells.values()) { const alpha = 0.12 + 0.68 * (cell.count / max); const color = heatmap === 'traffic' ? `rgba(7,203,255,${alpha})` : heatmap === 'kills' ? `rgba(255,170,0,${alpha})` : `rgba(255,124,124,${alpha})`; const gradient = ctx.createRadialGradient(cell.x, cell.y, 0, cell.x, cell.y, heatmap === 'traffic' ? 30 : 45); gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(cell.x, cell.y, heatmap === 'traffic' ? 30 : 45, 0, Math.PI * 2); ctx.fill(); }
      }
      const byJourney = new Map<string, EventRow[]>(); for (const row of visibleMovement) { const key = `${row.match}|${row.user}`; const path = byJourney.get(key) ?? []; path.push(row); byJourney.set(key, path); }
      for (const path of byJourney.values()) { path.sort((a, b) => a.t - b.t); if (path.length < 2) continue; ctx.globalAlpha = path[0].bot ? 0.35 : 0.62; ctx.strokeStyle = path[0].bot ? '#b7a0f4' : '#65e7b1'; ctx.lineWidth = path[0].bot ? 1.1 : 1.6; ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); for (let index = 1; index < path.length; index += 1) ctx.lineTo(path[index].x, path[index].y); ctx.stroke(); }
      ctx.globalAlpha = 1; for (const row of visibleDiscrete) marker(ctx, row);
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(element); return () => observer.disconnect();
  }, [rows, heatmap, playback]);
  const pointFromEvent = (event: React.MouseEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: ((event.clientX - rect.left - pan.x) / zoom) * logicalSize / rect.width, y: ((event.clientY - rect.top - pan.y) / zoom) * logicalSize / rect.height }; };
  const closestEvent = (event: React.MouseEvent<HTMLCanvasElement>) => { const point = pointFromEvent(event); return rows.filter((row) => !MOVEMENT_EVENTS.has(row.event)).map((row) => ({ row, distance: Math.hypot(row.x - point.x, row.y - point.y) })).sort((a, b) => a.distance - b.distance)[0]; };
  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => { if (drag.current.moved) return; const closest = closestEvent(event); onEventSelect(closest && closest.distance < 22 ? closest.row : null); };
  const handleHover = (event: React.MouseEvent<HTMLCanvasElement>) => { const closest = closestEvent(event); setHoverEvent(closest && closest.distance < 22 ? closest.row : null); };
  const zoomAt = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nextZoom = Math.min(3, Math.max(1, zoom + (event.deltaY < 0 ? .15 : -.15)));
    if (nextZoom === zoom) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const center = { x: rect.width / 2, y: rect.height / 2 };
    const cursor = { x: event.clientX - rect.left - center.x, y: event.clientY - rect.top - center.y };
    const nextPan = { x: cursor.x - ((cursor.x - pan.x) / zoom) * nextZoom, y: cursor.y - ((cursor.y - pan.y) / zoom) * nextZoom };
    setPan(clampPan(nextPan, nextZoom));
    setZoom(nextZoom);
  };
  return <div className="map-frame" aria-label={`${map} player journey map`} style={{ cursor: zoom > 1 ? 'grab' : 'default' }} onWheel={zoomAt}>
    <div className="map-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} onPointerDown={(event) => { if (zoom <= 1) return; drag.current = { active: true, moved: false, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag.current.active) return; const dx = event.clientX - drag.current.x; const dy = event.clientY - drag.current.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true; setPan(clampPan({ x: drag.current.panX + dx, y: drag.current.panY + dy })); }} onPointerUp={() => { drag.current.active = false; }}>
      {!imageFailed && <img src={MAP_IMAGES[map]} alt={`${map} minimap`} onError={() => setImageFailed(true)} />}{imageFailed && <div className="missing-map">Minimap image unavailable</div>}<canvas ref={canvas} onClick={handleClick} onMouseMove={handleHover} onMouseLeave={() => setHoverEvent(null)} aria-hidden="true" />
    </div>
    <div className="map-controls"><button onClick={() => setZoom((value) => Math.min(3, value + .25))} aria-label="Zoom in">+</button><button onClick={() => setZoom((value) => Math.max(1, value - .25))} aria-label="Zoom out">−</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset map view">Reset</button></div>
    {hoverEvent && <div className="map-tooltip"><strong>{eventLabel[hoverEvent.event]}</strong><span>{hoverEvent.user} · {Math.round(hoverEvent.x)}, {Math.round(hoverEvent.y)}</span></div>}
    {rows.length === 0 && <div className="map-empty">No events match these filters.</div>}
  </div>;
}

function downloadCsv(rows: EventRow[]) { const header = 'map,date,match,user,bot,x,y,t,event\n'; const csv = header + rows.map((row) => [row.map, row.date, row.match, row.user, row.bot, row.x, row.y, row.t, row.event].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'lila-filtered-events.csv'; anchor.click(); URL.revokeObjectURL(url); }

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [rows, setRows] = useState<EventRow[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [map, setMap] = useState(() => readParam('map', 'AmbroseValley')); const [date, setDate] = useState(() => readParam('date', 'all')); const [match, setMatch] = useState(() => readParam('match', 'all')); const [matchSearch, setMatchSearch] = useState(''); const [showHumans, setShowHumans] = useState(true); const [showBots, setShowBots] = useState(true); const [events, setEvents] = useState<Set<EventName>>(defaultEvents); const [heatmap, setHeatmap] = useState<HeatmapMode>(() => readParam('heatmap', 'none') as HeatmapMode); const [playback, setPlayback] = useState(100); const [playing, setPlaying] = useState(false); const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null); const animation = useRef<number | null>(null);
  useEffect(() => { fetch('/data/catalog.json').then(async (response) => { if (!response.ok) throw new Error('Catalog unavailable. Run the data build first.'); setCatalog(await response.json() as Catalog); }).catch((reason: Error) => setError(reason.message)); }, []);
  useEffect(() => { if (!catalog) return; const shardList = catalog.shards.filter((shard) => shard.map === map && (date === 'all' || shard.date === date)); let cancelled = false; setLoading(true); Promise.all(shardList.map((shard) => fetch(shard.path).then((response) => { if (!response.ok) throw new Error(`Could not load ${shard.path}`); return response.json() as Promise<PackedEvents>; }))).then((payloads) => { if (!cancelled) { setRows(payloads.flatMap(unpack)); setLoading(false); } }).catch((reason: Error) => { if (!cancelled) { setError(reason.message); setLoading(false); } }); return () => { cancelled = true; }; }, [catalog, map, date]);
  useEffect(() => { const params = new URLSearchParams(); if (map !== 'AmbroseValley') params.set('map', map); if (date !== 'all') params.set('date', date); if (match !== 'all') params.set('match', match); if (heatmap !== 'none') params.set('heatmap', heatmap); window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`); }, [map, date, match, heatmap]);
  const matches = useMemo(() => catalog?.matches.filter((item) => item.map === map && (date === 'all' || item.date === date) && (!matchSearch || `${formatMatch(item.id)} ${item.id}`.toLowerCase().includes(matchSearch.toLowerCase()))) ?? [], [catalog, map, date, matchSearch]);
  const filtered = useMemo(() => rows.filter((row) => (match === 'all' || row.match === match) && (row.bot ? showBots : showHumans) && events.has(row.event)), [rows, match, showBots, showHumans, events]);
  const selectedSummary = catalog?.matches.find((item) => item.id === match); const players = useMemo(() => new Set(filtered.map((row) => row.user)).size, [filtered]); const hasMatch = match !== 'all';
  useEffect(() => { if (!playing || !hasMatch) return; let previous = performance.now(); const tick = (now: number) => { const elapsed = now - previous; previous = now; setPlayback((value) => { const next = value + elapsed * .0125; if (next >= 100) { setPlaying(false); return 100; } return next; }); animation.current = requestAnimationFrame(tick); }; animation.current = requestAnimationFrame(tick); return () => { if (animation.current) cancelAnimationFrame(animation.current); }; }, [playing, hasMatch]);
  const reset = () => { setMap('AmbroseValley'); setDate('all'); setMatch('all'); setMatchSearch(''); setShowHumans(true); setShowBots(true); setEvents(new Set(defaultEvents)); setHeatmap('none'); setPlayback(100); setPlaying(false); setSelectedEvent(null); };
  const toggleEvent = (event: EventName) => setEvents((current) => { const next = new Set(current); next.has(event) ? next.delete(event) : next.add(event); return next; });
  if (error) return <main className="state"><h1>Data unavailable</h1><p>{error}</p></main>; if (!catalog) return <main className="state"><h1>Loading telemetry…</h1><p>Preparing the map catalog.</p></main>;
  return <main>
    <header className="topbar"><div><p className="eyebrow">LILA BLACK · LEVEL DESIGN</p><h1>Player Journey Explorer</h1><p className="subhead">Turn production telemetry into actionable map behaviour.</p></div><div className="dataset-badge">{catalog.totals.rows.toLocaleString()} events · {catalog.totals.files} journeys</div></header>
    <section className="layout"><aside className="panel controls" aria-label="Filters and display controls"><div className="control-group"><h2>Explore</h2><label>Map<select value={map} onChange={(event) => { setMap(event.target.value); setMatch('all'); setSelectedEvent(null); }}>{catalog.maps.map((item) => <option key={item}>{item}</option>)}</select></label><label>Date<select value={date} onChange={(event) => { setDate(event.target.value); setMatch('all'); setSelectedEvent(null); }}><option value="all">All dates</option>{catalog.dates.map((item) => <option key={item}>{item}</option>)}</select></label><label>Search matches<input value={matchSearch} onChange={(event) => setMatchSearch(event.target.value)} placeholder="Match ID prefix…" /></label><label>Match<select value={match} onChange={(event) => { setMatch(event.target.value); setPlayback(100); setPlaying(false); setSelectedEvent(null); }}><option value="all">All matching journeys</option>{matches.slice(0, 150).map((item) => <option key={item.id} value={item.id}>{formatMatch(item.id)} · {item.journeys} players · {item.date}</option>)}</select></label>{matches.length > 150 && <p className="hint">Showing 150 matches. Refine the search to find more.</p>}<button className="secondary-button" onClick={reset}>Reset filters</button></div><div className="control-group"><h2>Players</h2><label className="check"><input type="checkbox" checked={showHumans} onChange={(event) => setShowHumans(event.target.checked)} /> Human paths</label><label className="check"><input type="checkbox" checked={showBots} onChange={(event) => setShowBots(event.target.checked)} /> Bot paths</label></div><div className="control-group"><h2>Events</h2><div className="event-grid">{EVENT_TYPES.map((event) => <label key={event} className="check"><input type="checkbox" checked={events.has(event)} onChange={() => toggleEvent(event)} /> {eventLabel[event]}</label>)}</div></div><div className="control-group"><h2>Heatmap</h2><label>Overlay<select value={heatmap} onChange={(event) => setHeatmap(event.target.value as HeatmapMode)}><option value="none">None</option><option value="traffic">Player traffic</option><option value="kills">Kill zones</option><option value="deaths">Death zones</option></select></label></div></aside>
      <section className="workspace"><div className="map-header"><div><h2>{map}</h2><p>{hasMatch ? `Match ${formatMatch(match)}` : 'All matching player journeys'}{loading ? ' · loading data' : ''}</p></div><div className="metrics"><span>{players} players</span><span>{filtered.length.toLocaleString()} visible events</span>{selectedSummary && <span>{selectedSummary.journeys} journeys · {((selectedSummary.end - selectedSummary.start) / 1000).toFixed(2)}s</span>}<button className="export-button" onClick={() => downloadCsv(filtered)}>Export CSV</button></div></div><JourneyMap map={map} rows={filtered} heatmap={heatmap} playback={hasMatch ? playback : null} onEventSelect={setSelectedEvent} />
        <aside className="detail-sidebar">
          <div className="legend"><span><i className="line human" />Human movement</span><span><i className="line bot" />Bot movement</span><span><i className="symbol human-kill">×</i>Human kill</span><span><i className="symbol bot-kill">⊠</i>Bot kill</span><span><i className="symbol human-death">○</i>Human death</span><span><i className="symbol bot-death">□</i>Bot-caused death</span><span><i className="symbol storm">◆</i>Storm death</span><span><i className="symbol loot">■</i>Loot</span></div>
          {selectedEvent && <section className="event-inspector panel"><div><p className="eyebrow">SELECTED EVENT</p><h2>{eventLabel[selectedEvent.event]}</h2></div><dl><div><dt>Player</dt><dd>{selectedEvent.user}</dd></div><div><dt>Match</dt><dd>{formatMatch(selectedEvent.match)}</dd></div><div><dt>Map position</dt><dd>{Math.round(selectedEvent.x)}, {Math.round(selectedEvent.y)}</dd></div></dl><button className="secondary-button" onClick={() => setSelectedEvent(null)}>Close</button></section>}
          <section className="playback panel"><div><h2>Match playback</h2><p>{hasMatch ? 'Use the scrubber to reveal player movement and events in telemetry order.' : 'Select one match to enable playback.'}</p></div><button disabled={!hasMatch} onClick={() => { if (playback >= 100) setPlayback(0); setPlaying((value) => !value); }}>{playing ? 'Pause' : playback >= 100 ? 'Replay' : 'Play'}</button><input aria-label="Playback position" type="range" min="0" max="100" value={playback} disabled={!hasMatch} onChange={(event) => { setPlaying(false); setPlayback(Number(event.target.value)); }} /><output>{hasMatch ? `${Math.round(playback)}%` : '—'}</output></section>
          <section className="insights"><div className="section-heading"><div><p className="eyebrow">DATA NOTES</p><h2>What the telemetry suggests</h2></div><p>Evidence-backed prompts for level design review.</p></div><div className="insight-grid">{insights.map((insight) => <article className="insight-card" key={insight.title}><p className="insight-stat">{insight.stat}</p><h3>{insight.title}</h3><p>{insight.body}</p></article>)}</div></section>
        </aside>
      </section>
    </section>
  </main>;
}
