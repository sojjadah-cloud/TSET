import { create } from 'zustand';
import { act, continueDay, decide, endDay, newGame, type Action } from '../sim/engine';
import type { GameState, Lang, SystemId } from '../sim/types';
import { loadGame, loadPrefs, saveGame, savePrefs, type Prefs } from './persistence';
import { sfx } from '../audio/sfx';

export type View = 'station' | SystemId;
export type Modal = null | 'timeline' | 'status' | 'settings' | 'how' | 'decision';

interface Store extends Prefs {
  game: GameState | null;
  screen: 'welcome' | 'game';
  view: View;
  modal: Modal;
  corruptNotice: boolean;
  savedAt: number;
  setLang: (l: Lang) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  startNew: () => void;
  resume: () => void;
  toWelcome: () => void;
  beginMission: () => void;
  setView: (v: View) => void;
  setModal: (m: Modal) => void;
  dispatch: (a: Action) => void;
  choose: (eventId: string, optionId: string) => void;
  dismissOutcome: () => void;
  finishDay: () => void;
  nextDay: () => void;
  dismissCorrupt: () => void;
}

const initial = loadGame();
const prefs = loadPrefs();

export const useGame = create<Store>((set, get) => {
  const commit = (game: GameState | null) => {
    const ok = saveGame(game);
    set({ game, savedAt: ok ? Date.now() : get().savedAt });
  };
  const persistPrefs = () => {
    const { lang, sound, music, reduceMotion } = get();
    savePrefs({ lang, sound, music, reduceMotion });
  };
  return {
    ...prefs,
    game: initial.game,
    screen: 'welcome',
    view: 'station',
    modal: null,
    corruptNotice: initial.corrupt,
    savedAt: 0,

    setLang: (lang) => {
      set({ lang });
      persistPrefs();
    },
    setPrefs: (p) => {
      set(p);
      persistPrefs();
    },
    startNew: () => {
      sfx.play('confirm');
      commit(newGame());
      set({ screen: 'game', view: 'station', modal: null });
    },
    resume: () => {
      if (!get().game) return;
      sfx.play('click');
      set({ screen: 'game', view: 'station', modal: null });
    },
    toWelcome: () => set({ screen: 'welcome', modal: null, view: 'station' }),
    beginMission: () => {
      const g = get().game;
      if (!g) return;
      sfx.play('confirm');
      commit({ ...g, phase: 'playing' });
    },
    setView: (view) => {
      if (get().view !== view) sfx.play('whoosh');
      set({ view, modal: null });
    },
    setModal: (modal) => {
      if (modal) sfx.play('click');
      set({ modal });
      const g = get().game;
      if (g?.phase === 'playing' && modal === 'status') commit(act(g, { type: 'flag', flag: 'viewed:status' }));
      if (g?.phase === 'playing' && modal === 'timeline') commit(act(g, { type: 'flag', flag: 'viewed:timeline' }));
    },
    dispatch: (a) => {
      const g = get().game;
      if (!g || g.phase !== 'playing') return;
      const next = act(g, a);
      if (next === g) {
        sfx.play('deny');
        return;
      }
      if (a.type !== 'flag' && a.type !== 'mark') sfx.play(a.type === 'setCtl' || a.type === 'priority' ? 'tick' : 'success');
      commit(next);
    },
    choose: (eventId, optionId) => {
      const g = get().game;
      if (!g) return;
      const next = decide(g, eventId, optionId);
      if (next === g) return sfx.play('deny');
      sfx.play('confirm');
      commit(next);
    },
    dismissOutcome: () => {
      const g = get().game;
      if (!g) return;
      commit({ ...g, lastOutcome: null });
      if (g.activeEvents.length === 0) set({ modal: null });
    },
    finishDay: () => {
      const g = get().game;
      if (!g) return;
      const next = endDay(g);
      if (next === g) return sfx.play('deny');
      sfx.play('whoosh');
      commit(next);
      set({ view: 'station', modal: null });
    },
    nextDay: () => {
      const g = get().game;
      if (!g) return;
      sfx.play('confirm');
      commit(continueDay(g));
      set({ view: 'station', modal: null });
    },
    dismissCorrupt: () => set({ corruptNotice: false }),
  };
});

// Keep the audio engine in sync with preferences.
useGame.subscribe((s) => sfx.configure(s.sound, s.music));
