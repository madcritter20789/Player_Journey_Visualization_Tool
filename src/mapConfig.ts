export const MAP_IMAGES: Record<string, string> = {
  AmbroseValley: '/minimaps/AmbroseValley_Minimap.png',
  GrandRift: '/minimaps/GrandRift_Minimap.png',
  Lockdown: '/minimaps/Lockdown_Minimap.jpg',
};

export const EVENT_TYPES = ['Position', 'BotPosition', 'Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot'] as const;
export const MOVEMENT_EVENTS = new Set(['Position', 'BotPosition']);
export const KILL_EVENTS = new Set(['Kill', 'BotKill']);
export const DEATH_EVENTS = new Set(['Killed', 'BotKilled', 'KilledByStorm']);

export const eventLabel: Record<string, string> = {
  Position: 'Human movement',
  BotPosition: 'Bot movement',
  Kill: 'Human kill',
  Killed: 'Human death',
  BotKill: 'Bot kill',
  BotKilled: 'Bot-caused death',
  KilledByStorm: 'Storm death',
  Loot: 'Loot',
};
