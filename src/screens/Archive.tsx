import { useState } from 'react';
import type { Film } from '../game/types';
import { FilmTicket } from '../components/Cards';
import { downloadFilmTicket } from '../lib/exportTicket';

export function Archive({ films, onBack, onRemove }: { films: Film[]; onBack: () => void; onRemove: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const sorted = [...films].sort((a, b) => b.date - a.date);

  const save = async (f: Film) => {
    setBusy(f.id);
    try {
      await downloadFilmTicket(f);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="page page--narrow barchive">
      <button className="link-btn" onClick={onBack}>
        Back
      </button>
      <div className="t-wide">Every film you’ve made</div>
      <h1 className="page-title t-ticket">The archive</h1>
      {sorted.length === 0 ? (
        <p className="lede">Nothing in the can yet. Finish a reel and your film lands here.</p>
      ) : (
        <ul className="barchive__list">
          {sorted.map((f) => (
            <li key={f.id}>
              <FilmTicket film={f} />
              <div className="btn-row">
                <button className="btn btn--small" disabled={busy === f.id} onClick={() => save(f)}>
                  {busy === f.id ? 'Printing…' : 'Download ticket'}
                </button>
                {confirm === f.id ? (
                  <>
                    <button className="btn btn--small btn--hot" onClick={() => onRemove(f.id)}>
                      Yes, remove it
                    </button>
                    <button className="btn btn--small btn--ghost" onClick={() => setConfirm(null)}>
                      Keep it
                    </button>
                  </>
                ) : (
                  <button className="btn btn--small btn--ghost" onClick={() => setConfirm(f.id)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
