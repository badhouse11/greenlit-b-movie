import { useEffect, useState } from 'react';
import { msToNextDaily, puzzleNumber, utcDateKey } from '../game/engine';
import { loadDailies, loadGame, streak } from '../lib/storage';
import { FitText, Ticket } from '../components/Ticket';
import { ShopStrip } from '../components/ShopStrip';
import { CrossSell } from '../components/Cards';

export function useCountdownToNextDaily() {
  const [ms, setMs] = useState(() => msToNextDaily());
  useEffect(() => {
    const t = window.setInterval(() => setMs(msToNextDaily()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function Home({
  onDailies,
  onFree,
  onTwo,
  onResume,
  onHow,
  onArchive,
  archiveCount,
}: {
  onDailies: () => void;
  onFree: () => void;
  onTwo: () => void;
  onResume: () => void;
  onHow: () => void;
  onArchive: () => void;
  archiveCount: number;
}) {
  const key = utcDateKey();
  const all = loadDailies();
  const today = all[key];
  const n = puzzleNumber(key);
  const run = streak(all, key);
  const countdown = useCountdownToNextDaily();
  const saved = loadGame();
  const unfinished = saved && saved.phase !== 'final' && !(saved.mode === 'free' && saved.phase === 'result');

  return (
    <>
      <ShopStrip />
      <main className="page home bhome">
        <Ticket className="hero-ticket bhero" wrapClassName="hero-wrap">
          <div className="hero-ticket__main">
            <div className="hero-ticket__kicker t-wide">The support feature · 1 or 2 players</div>
            <h1 className="wordmark">
              <FitText text="Greenlit" max={132} min={28} />
            </h1>
            <div className="bhero__sub t-ticket">(B-Movie)</div>
            <p className="hero-ticket__line">
              You’ve got $20 million. You need five stars.
              <em>You have absolutely no idea what film you’re making.</em>
            </p>
          </div>
          <div className="hero-ticket__stub" aria-hidden="true">
            <div className="perf-v" />
            <div style={{ display: 'flex', gap: 10 }}>
              <span className="vert vert--big">Double bill</span>
              <span className="vert">Second feature · No refunds</span>
            </div>
          </div>
        </Ticket>

        <section className="bmodes" aria-label="Choose a mode">
          <Ticket bg="#E9A752" ink="#5A2A14" className="bmode" serrated>
            <div className="bmode__kicker t-wide">One player · once a day</div>
            <h2 className="bmode__name t-ticket">Dailies #{n}</h2>
            {today?.done ? (
              <>
                <p className="bmode__line">
                  Done: <b>{today.total}/15</b>. Next Dailies in <span className="t-mono">{countdown}</span>
                </p>
                <button className="btn btn--big" onClick={onDailies}>
                  See today’s result
                </button>
              </>
            ) : (
              <>
                <p className="bmode__line">Same puzzle for everyone in the world today. One go.</p>
                <button className="btn btn--big btn--hot" onClick={onDailies}>
                  {today ? 'Carry on with today’s Dailies' : 'Play today’s Dailies'}
                </button>
              </>
            )}
            {run > 0 && <p className="bmode__streak t-mono">Streak: {run} {run === 1 ? 'day' : 'days'}</p>}
          </Ticket>

          <Ticket bg="#78614D" ink="#F3D9A8" className="bmode" serrated>
            <div className="bmode__kicker t-wide">Two players · one phone</div>
            <h2 className="bmode__name t-ticket">Two-Hander</h2>
            <p className="bmode__line">Head to head, phone flat on the table. Best of three reels.</p>
            <div className="btn-row">
              <button className="btn btn--big bmode__btn" onClick={onTwo}>
                Start a Two-Hander
              </button>
            </div>
          </Ticket>
        </section>

        <div className="home__actions bhome__more">
          {unfinished && saved && (
            <button className="btn btn--ghost" onClick={onResume}>
              Resume your {saved.mode === 'two' ? 'Two-Hander' : 'Free Play'} (reel {saved.reel.number})
            </button>
          )}
          <button className="btn btn--ghost" onClick={onFree}>
            Free Play: practise all you like
          </button>
        </div>

        <nav className="home__foot" aria-label="More">
          <button className="link-btn" onClick={onHow}>
            How it works
          </button>
          <button className="link-btn" onClick={onArchive}>
            The archive{archiveCount ? ` (${archiveCount} ${archiveCount === 1 ? 'film' : 'films'})` : ''}
          </button>
        </nav>

        <CrossSell />
      </main>
    </>
  );
}
