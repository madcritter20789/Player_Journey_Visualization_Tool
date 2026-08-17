export type EventName = 'Position' | 'BotPosition' | 'Kill' | 'Killed' | 'BotKill' | 'BotKilled' | 'KilledByStorm' | 'Loot';

export interface EventRow {
  map: string;
  date: string;
  match: string;
  user: string;
  bot: boolean;
  x: number;
  y: number;
  t: number;
  event: EventName;
}

export interface MatchSummary {
  id: string;
  source_id: string;
  map: string;
  date: string;
  journeys: number;
  events: number;
  start: number;
  end: number;
}

export interface Catalog {
  maps: string[];
  dates: string[];
  shards: { map: string; date: string; path: string; rows: number }[];
  matches: MatchSummary[];
  totals: { files: number; rows: number; humans: number; bots: number; };
}

export interface PackedEvents {
  fields: string[];
  events: [string, string, string, string, boolean, number, number, number, EventName][];
}
