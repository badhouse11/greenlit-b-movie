import { useState } from 'react';
import type { Game } from '../game/types';
import { newGame } from '../game/engine';
import { PALETTE, STUDIO_NAMES, stock } from '../lib/palette';
import { Ticket } from '../components/Ticket';

/** The house studio prints on Grenadine, so the humans choose from the rest. */
const HUMAN_STOCKS = ['darlington', 'beeswax', 'powder', 'lilac', 'bubblegum'];

export function Setup({ onCancel, onStart }: { onCancel: () => void; onStart: (g: Game) => void }) {
  const [names, setNames] = useState(['', '']);
  const [colours, setColours] = useState(['darlington', 'beeswax']);

  const suggest = (i: number) => {
    const taken = new Set(names);
    const pool = STUDIO_NAMES.filter((n) => !taken.has(n));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setNames((ns) => ns.map((n, j) => (j === i ? pick : n)));
  };

  const start = () => {
    const seed = Math.random().toString(36).slice(2, 10);
    onStart(
      newGame({
        mode: 'two',
        seed,
        id: `two-${seed}`,
        humans: names.map((n, i) => ({ name: n.trim() || `Studio ${i === 0 ? 'A' : 'B'}`, colour: colours[i] })),
      }),
    );
  };

  return (
    <main className="page page--narrow bsetup">
      <div className="t-wide">Two-Hander</div>
      <h1 className="page-title t-ticket">Name your studios</h1>
      <p className="lede">Two studios, one phone, best of three reels. Autoplay+ is bidding against you both.</p>
      <div className="bsetup__grid">
        {[0, 1].map((i) => {
          const s = stock(colours[i]);
          return (
            <Ticket key={i} bg={s.bg} ink={s.ink} className="bsetup__card">
              <label className="field">
                <span className="t-wide">Studio {i === 0 ? 'A' : 'B'}</span>
                <input
                  id={`studio-name-${i}`}
                  className="input"
                  value={names[i]}
                  maxLength={28}
                  placeholder={i === 0 ? 'Badhouse Pictures' : 'Velvet Rope Pictures'}
                  onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
                />
              </label>
              <button type="button" className="link-btn" onClick={() => suggest(i)}>
                Suggest a name
              </button>
              <div className="bsetup__stocks" role="group" aria-label={`Ticket colour for studio ${i === 0 ? 'A' : 'B'}`}>
                {HUMAN_STOCKS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="bswatch"
                    style={{ background: PALETTE[k].bg }}
                    aria-label={PALETTE[k].name}
                    aria-pressed={colours[i] === k}
                    disabled={colours[1 - i] === k}
                    onClick={() => setColours((cs) => cs.map((c, j) => (j === i ? k : c)))}
                  />
                ))}
              </div>
            </Ticket>
          );
        })}
      </div>
      <div className="btn-row">
        <button className="btn btn--big btn--hot" onClick={start}>
          Roll reel one
        </button>
        <button className="btn btn--ghost" onClick={onCancel}>
          Back
        </button>
      </div>
    </main>
  );
}
