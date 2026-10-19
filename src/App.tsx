import { useCallback, useEffect, useRef, useState } from 'react';
import type { Film, Game } from './game/types';
import { RuleError, dailySeed, newGame, puzzleNumber, utcDateKey } from './game/engine';
import { addToArchive, forgetDaily, loadArchive, loadDailies, loadGame, saveArchive, saveDaily, saveGame } from './lib/storage';
import { Home } from './screens/Home';
import { HowItWorks } from './screens/HowItWorks';
import { Setup } from './screens/Setup';
import { Play } from './screens/Play';
import { Archive } from './screens/Archive';

export type View = 'home' | 'how' | 'setup' | 'play' | 'archive';

export interface Toast {
  text: string;
  error?: boolean;
}

/** Every game action is a pure function from one Game to the next. */
export type Act = (fn: (g: Game) => Game, opts?: { undoable?: boolean; quiet?: boolean }) => boolean;

export const YOU = { name: 'Your Studio', colour: 'darlington' };

/** Testing aid: opening the site with ?fresh wipes today's Dailies on this device, then tidies the address. */
(() => {
  try {
    if (!new URLSearchParams(window.location.search).has('fresh')) return;
    forgetDaily(utcDateKey());
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    /* no storage: nothing to forget */
  }
})();

export default function App() {
  const [game, setGame] = useState<Game | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [past, setPast] = useState<Game[]>([]);
  const [view, setView] = useState<View>('home');
  const [returnTo, setReturnTo] = useState<View>('home');
  const [archive, setArchive] = useState<Film[]>(() => loadArchive());
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((t: Toast) => {
    window.clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = window.setTimeout(() => setToast(null), t.error ? 4600 : 3000);
  }, []);

  const install = useCallback((g: Game | null) => {
    gameRef.current = g;
    setGame(g);
  }, []);

  // Save every change: Dailies to today's record, everything else to the resume slot.
  useEffect(() => {
    if (!game) return;
    if (game.mode === 'dailies' && game.dateKey) {
      const done = ['oscar', 'result', 'final'].includes(game.phase);
      const me = game.results[0]?.totals.p1;
      saveDaily({
        dateKey: game.dateKey,
        puzzle: game.puzzle ?? 0,
        game,
        done,
        total: done ? me : undefined,
        won: done ? game.results[0]?.winnerId === 'p1' : undefined,
      });
    } else {
      saveGame(game);
    }
    if (game.films.length) {
      setArchive((a) => {
        const next = addToArchive(a, game.films);
        if (next !== a) saveArchive(next);
        return next;
      });
    }
  }, [game]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, game?.phase, game?.reel.number]);

  const act: Act = useCallback(
    (fn, opts = {}) => {
      const current = gameRef.current;
      if (!current) return false;
      try {
        const next = fn(current);
        if (opts.undoable && current.mode !== 'dailies') setPast((p) => [...p.slice(-40), current]);
        install(next);
        return true;
      } catch (e) {
        if (e instanceof RuleError) {
          if (!opts.quiet) say({ text: e.message, error: true });
          return false;
        }
        throw e;
      }
    },
    [install, say],
  );

  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    install(prev);
    say({ text: 'Undone. The studio lawyers have shredded the evidence.' });
  };

  const playDailies = () => {
    const key = utcDateKey();
    const rec = loadDailies()[key];
    const g =
      rec?.game ??
      newGame({ mode: 'dailies', seed: dailySeed(key), dateKey: key, puzzle: puzzleNumber(key), humans: [YOU], id: `dailies-${key}` });
    install(g);
    setPast([]);
    setView('play');
  };

  const playFree = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    install(newGame({ mode: 'free', seed, humans: [YOU], id: `free-${seed}` }));
    setPast([]);
    setView('play');
  };

  const startTwo = (g: Game) => {
    install(g);
    setPast([]);
    setView('play');
  };

  const resume = () => {
    const g = loadGame();
    if (!g) return;
    install(g);
    setPast([]);
    setView('play');
  };

  const leave = () => {
    install(null);
    setPast([]);
    setView('home');
  };

  const openAside = (v: View) => {
    setReturnTo(view);
    setView(v);
  };

  const removeFilm = (id: string) =>
    setArchive((a) => {
      const next = a.filter((f) => f.id !== id);
      saveArchive(next);
      return next;
    });

  return (
    <div className="app">
      {view === 'home' && (
        <Home
          onDailies={playDailies}
          onFree={playFree}
          onTwo={() => setView('setup')}
          onResume={resume}
          onHow={() => openAside('how')}
          onArchive={() => openAside('archive')}
          archiveCount={archive.length}
        />
      )}
      {view === 'how' && <HowItWorks onBack={() => setView(returnTo)} />}
      {view === 'setup' && <Setup onCancel={() => setView('home')} onStart={startTwo} />}
      {view === 'play' && game && (
        <Play
          game={game}
          act={act}
          say={say}
          onLeave={leave}
          onUndo={game.mode === 'dailies' ? undefined : undo}
          canUndo={past.length > 0}
          onHow={() => openAside('how')}
          onArchive={() => openAside('archive')}
          onFree={playFree}
        />
      )}
      {view === 'archive' && <Archive films={archive} onBack={() => setView(returnTo)} onRemove={removeFilm} />}

      {toast && (
        <div className={`toast ${toast.error ? 'toast--error' : ''}`} role={toast.error ? 'alert' : 'status'}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
