import type { Film, Game } from '../game/types';

const KEYS = {
  daily: 'bmovie.dailies.v1', // { [dateKey]: DailyRecord }
  game: 'bmovie.game.v1', // the Free Play or Two-Hander game in progress
  archive: 'bmovie.archive.v1',
};

export interface DailyRecord {
  dateKey: string;
  puzzle: number;
  game: Game; // the reel as it stands, so a closed tab can resume
  done: boolean;
  total?: number;
  won?: boolean;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the game still plays, it just won't survive a refresh */
  }
}

export const loadDailies = () => read<Record<string, DailyRecord>>(KEYS.daily, {});
export function saveDaily(rec: DailyRecord) {
  const all = loadDailies();
  // Keep finished results light: the full game is only needed while a reel is live.
  all[rec.dateKey] = rec;
  for (const [k, v] of Object.entries(all)) {
    if (k !== rec.dateKey && v.done && v.game) all[k] = { ...v, game: slim(v.game) };
  }
  write(KEYS.daily, all);
}

/** Drops the draw piles from a finished game; the result screen doesn't need them. */
const slim = (g: Game): Game => ({ ...g, reel: { ...g.reel, talent: [], legacy: [], binned: [] } });

export const loadGame = () => read<Game | null>(KEYS.game, null);
export const saveGame = (g: Game | null) => write(KEYS.game, g);

export const loadArchive = () => read<Film[]>(KEYS.archive, []);
export const saveArchive = (films: Film[]) => write(KEYS.archive, films);

export function addToArchive(films: Film[], add: Film[]): Film[] {
  const ids = new Set(films.map((f) => f.id));
  const fresh = add.filter((f) => !ids.has(f.id));
  return fresh.length ? [...films, ...fresh] : films;
}

/** Days in a row with a finished Dailies, counting back from today (or yesterday, if today's isn't done yet). */
export function streak(all: Record<string, DailyRecord>, todayKey: string): number {
  const day = (k: string, back: number) => {
    const d = new Date(`${k}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - back);
    return d.toISOString().slice(0, 10);
  };
  let start = all[todayKey]?.done ? 0 : 1;
  let n = 0;
  while (all[day(todayKey, start + n)]?.done) n++;
  return n;
}
