import { SAVE_VERSION } from '../sim/engine';
import type { GameState, Lang } from '../sim/types';

const SAVE_KEY = 'lunar-station:mission';
const PREFS_KEY = 'lunar-station:prefs';

export interface Prefs {
  lang: Lang;
  sound: number; // 0..1
  music: number; // 0..1
  reduceMotion: boolean;
}

export const defaultPrefs: Prefs = { lang: 'ar', sound: 0.6, music: 0.25, reduceMotion: false };

/** Minimal shape check so a corrupted or old save never crashes the game. */
function isValidSave(v: unknown): v is GameState {
  if (!v || typeof v !== 'object') return false;
  const s = v as GameState;
  return (
    s.version === SAVE_VERSION &&
    typeof s.day === 'number' &&
    s.day >= 1 &&
    s.day <= 7 &&
    !!s.res &&
    typeof s.res.oxygenKg === 'number' &&
    !!s.sys &&
    !!s.ctl &&
    !!s.crew &&
    Array.isArray(s.messages) &&
    Array.isArray(s.decisions) &&
    Array.isArray(s.pending) &&
    Array.isArray(s.reports) &&
    !!s.dayStart
  );
}

export function loadGame(): { game: GameState | null; corrupt: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { game: null, corrupt: false };
    const parsed = JSON.parse(raw);
    if (isValidSave(parsed)) return { game: parsed, corrupt: false };
    localStorage.removeItem(SAVE_KEY);
    return { game: null, corrupt: true };
  } catch {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
    return { game: null, corrupt: true };
  }
}

export function saveGame(g: GameState | null) {
  try {
    if (g) localStorage.setItem(SAVE_KEY, JSON.stringify(g));
    else localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    const p = JSON.parse(raw);
    return {
      lang: p.lang === 'en' ? 'en' : 'ar',
      sound: typeof p.sound === 'number' ? Math.min(1, Math.max(0, p.sound)) : defaultPrefs.sound,
      music: typeof p.music === 'number' ? Math.min(1, Math.max(0, p.music)) : defaultPrefs.music,
      reduceMotion: !!p.reduceMotion,
    };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
