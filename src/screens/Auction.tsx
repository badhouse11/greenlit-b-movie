import { useEffect, useRef, useState } from 'react';
import type { Game, Studio } from '../game/types';
import {
  closeLot,
  drawLot,
  fastForward,
  genreOf,
  traitsHidden,
  houseFor,
  humans,
  humansFull,
  isHuman,
  maxBid,
  minNextBid,
  nextHouseBid,
  placeBid,
  slotsLeft,
  studioById,
} from '../game/engine';
import { stock } from '../lib/palette';
import { LotTicket, StudioStub, Traits } from '../components/Cards';
import { FitText } from '../components/Ticket';
import type { Act } from '../App';

const OPEN_MS = 15000;
const BID_MS = 8000;
const GOING_MS = 1800;

/**
 * Runs the live auction clock: draws lots, lets house studios raise after a short random pause,
 * hurries the hammer when every human is out, and closes the lot when time runs out.
 */
function useAuction(game: Game, act: Act) {
  const lot = game.reel.lot;
  const key = lot ? `${game.reel.number}:${lot.drawNo}:${lot.bids.length}` : null;
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [passed, setPassed] = useState<string[]>([]);
  const closing = useRef<string | null>(null);
  const move = nextHouseBid(game);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(t);
  }, []);

  // A new lot: reset passes. Any new bid: reset the clock.
  useEffect(() => setPassed([]), [lot?.drawNo, game.reel.number]);
  useEffect(() => {
    if (!lot) return;
    closing.current = null;
    setDeadline(Date.now() + (lot.bids.length ? BID_MS : OPEN_MS));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // House studios raise after a short, slightly random pause.
  useEffect(() => {
    if (!move) return;
    const t = window.setTimeout(
      () => act((g) => placeBid(g, move.studioId, move.amount), { quiet: true }),
      650 + Math.random() * 1250,
    );
    return () => window.clearTimeout(t);
  }, [key, move?.studioId, move?.amount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Everyone human is out and no house wants to raise: going, going...
  const humanOut = (s: Studio) => {
    const rs = game.reel.studios[s.id];
    return passed.includes(s.id) || slotsLeft(rs) === 0 || lot?.high?.studioId === s.id || maxBid(rs) < minNextBid(lot);
  };
  const allOut = !!lot && humans(game).every(humanOut);
  useEffect(() => {
    if (allOut && !move) setDeadline((d) => Math.min(d, Date.now() + GOING_MS));
  }, [allOut, !!move, key]); // eslint-disable-line react-hooks/exhaustive-deps

  // The hammer.
  useEffect(() => {
    if (!lot || !deadline || now < deadline || move) return;
    if (closing.current === key) return;
    closing.current = key;
    act((g) => closeLot(g), { quiet: true });
  }, [now, deadline, key, !!move]); // eslint-disable-line react-hooks/exhaustive-deps

  // Next star on the table.
  useEffect(() => {
    if (game.phase !== 'auction' || lot || humansFull(game)) return;
    const t = window.setTimeout(() => act((g) => drawLot(g), { undoable: true, quiet: true }), game.reel.drawCount === 0 ? 400 : 1300);
    return () => window.clearTimeout(t);
  }, [game.phase, !!lot, game.reel.drawCount, humansFull(game)]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = lot?.bids.length ? BID_MS : OPEN_MS;
  const left = Math.max(0, deadline - now);
  const fraction = lot && deadline ? Math.min(1, left / total) : 0;
  const call = !lot
    ? ''
    : left < 1200
      ? 'Going… going…'
      : allOut && !move
        ? 'Going…'
        : lot.high
          ? 'Any advance?'
          : 'Opening bid $1M';

  const bid = (studioId: string, amount: number) => act((g) => placeBid(g, studioId, amount));
  const pass = (studioId: string) => setPassed((p) => (p.includes(studioId) ? p : [...p, studioId]));
  return { lot, fraction, call, bid, pass, passed, seconds: Math.ceil(left / 1000), humanOut };
}

/** Bid options: the minimum, plus a couple of jumps, never past the studio's limit. */
function bidSteps(game: Game, studioId: string): number[] {
  const rs = game.reel.studios[studioId];
  const min = minNextBid(game.reel.lot);
  const max = maxBid(rs);
  return [min, min + 1, min + 3].filter((v, i, a) => v <= max && a.indexOf(v) === i);
}

function LastSale({ game }: { game: Game }) {
  const sale = game.reel.sales[game.reel.sales.length - 1];
  if (!sale) return <div className="bsold muted">The first star is on the way…</div>;
  const who = sale.studioId ? studioById(game, sale.studioId) : null;
  return (
    <div className="bsold" aria-live="polite">
      {who ? (
        <>
          <b>Sold:</b> {sale.card.name} to {who.name} for ${sale.price}M
        </>
      ) : (
        <>
          <b>Binned:</b> {sale.card.name}. No takers.
        </>
      )}
    </div>
  );
}

function BidBoard({ game, fraction, call }: { game: Game; fraction: number; call: string }) {
  const lot = game.reel.lot;
  const leader = lot?.high ? studioById(game, lot.high.studioId) : null;
  return (
    <div className="bid-board bboard" aria-live="polite">
      <div className="bid-board__call t-wide">{call}</div>
      <div className="bid-board__price t-ticket">{lot?.high ? `$${lot.high.amount}M` : 'No bids'}</div>
      <div className="bid-board__leader">
        {leader ? (
          <span className="chip chip--studio" style={{ ['--chip-bg' as string]: stock(leader.colour).bg, ['--chip-ink' as string]: stock(leader.colour).ink }}>
            {leader.name}
          </span>
        ) : (
          <span className="muted">Waiting for an opening bid</span>
        )}
      </div>
      <div className="bid-board__bar" aria-hidden="true">
        <span style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

function FinishCasting({ game, act }: { game: Game; act: Act }) {
  const waiting = game.studios.filter((s) => !isHuman(s) && slotsLeft(game.reel.studios[s.id]) > 0);
  return (
    <div className="bdone">
      <h2 className="t-ticket">{humans(game).length > 1 ? 'Both casts are complete' : 'Your cast is complete'}</h2>
      <p className="muted">
        {waiting.map((s) => s.name).join(' and ')} still {waiting.length === 1 ? 'has' : 'have'} empty slots. They’ll fill them from the deck.
      </p>
      <button className="btn btn--big btn--hot" onClick={() => act((g) => fastForward(g))}>
        Let the rivals finish casting
      </button>
    </div>
  );
}

/* ====================================================================== */
/*  Solo auction: Dailies and Free Play                                    */
/* ====================================================================== */
export function SoloAuction({ game, act }: { game: Game; act: Act }) {
  const a = useAuction(game, act);
  const me = humans(game)[0];
  const rs = game.reel.studios[me.id];
  const lot = a.lot;
  const lead = lot?.high?.studioId === me.id;
  const full = slotsLeft(rs) === 0;
  const steps = lot && !full && !lead ? bidSteps(game, me.id) : [];
  const out = a.passed.includes(me.id);

  return (
    <main className="page page--narrow bauction">
      <div className="bgenre-strip">
        <span className="t-wide">Now casting</span>
        <strong className="t-ticket">{genreOf(game).name}</strong>
      </div>
      <LastSale game={game} />
      {lot ? (
        <>
          <div className="bauction__lot">
            <LotTicket key={lot.drawNo} card={lot.card} hideTraits={traitsHidden(game)} />
          </div>
          <BidBoard game={game} fraction={a.fraction} call={a.call} />
          <div className="bcontrols" role="group" aria-label="Your bids">
            {full ? (
              <p className="muted">Your cast is full. Watch the rivals scrap.</p>
            ) : lead ? (
              <p className="bcontrols__note">You’re the top bid. Hold your nerve.</p>
            ) : steps.length === 0 ? (
              <p className="bcontrols__note">Too rich for you: you can bid at most ${maxBid(rs)}M.</p>
            ) : (
              <>
                <div className="bcontrols__bids">
                  {steps.map((v, i) => (
                    <button key={v} className={`btn ${i === 0 ? 'btn--hot' : ''} bbid`} onClick={() => a.bid(me.id, v)}>
                      Bid ${v}M
                    </button>
                  ))}
                </div>
                <button className="btn btn--ghost bpass" disabled={out} onClick={() => a.pass(me.id)}>
                  {out ? 'Passed' : 'Pass'}
                </button>
              </>
            )}
          </div>
        </>
      ) : humansFull(game) ? (
        <FinishCasting game={game} act={act} />
      ) : (
        <div className="bwait t-wide">Next star coming up…</div>
      )}

      <section className="bauction__ledger" aria-label="Studios">
        <StudioStub studio={me} rs={rs} you leading={lead} />
        <div className="brivals">
          {game.studios
            .filter((s) => !isHuman(s))
            .map((s) => (
              <RivalRow key={s.id} game={game} studio={s} />
            ))}
        </div>
      </section>
    </main>
  );
}

function RivalRow({ game, studio }: { game: Game; studio: Studio }) {
  const rs = game.reel.studios[studio.id];
  const s = stock(studio.colour);
  const lead = game.reel.lot?.high?.studioId === studio.id;
  return (
    <details className={`brival ${lead ? 'is-leading' : ''}`} style={{ ['--r-bg' as string]: s.bg, ['--r-ink' as string]: s.ink }}>
      <summary>
        <span className="brival__name t-ticket">{studio.name}</span>
        <span className="brival__money t-mono">
          ${rs.budget}M · {rs.cast.length}/5
        </span>
      </summary>
      <p className="brival__blurb">{houseFor(studio)?.blurb}</p>
      <ul className="brival__cast">
        {rs.cast.length === 0 && <li className="muted">Nobody yet</li>}
        {rs.cast.map((m) => (
          <li key={m.card.id}>
            <span>{m.card.name}</span> <span className="t-mono">${m.price}M</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ====================================================================== */
/*  Two-Hander: the phone lies flat between you                            */
/* ====================================================================== */
export function TableAuction({ game, act }: { game: Game; act: Act }) {
  const a = useAuction(game, act);
  const [p1, p2] = humans(game);
  const lot = a.lot;
  const house = game.studios.find((s) => !isHuman(s))!;
  const hrs = game.reel.studios[house.id];
  const leader = lot?.high ? studioById(game, lot.high.studioId) : null;

  return (
    <div className="btable" role="application" aria-label="Two-Hander auction table">
      <Half game={game} studio={p2} flipped a={a} />
      <div className="btable__mid">
        <div className="btable__clock" aria-hidden="true">
          <span style={{ width: `${a.fraction * 100}%` }} />
        </div>
        <div className="btable__midrow">
          <span className="btable__house" style={{ background: stock(house.colour).bg, color: stock(house.colour).ink }}>
            {house.name} · ${hrs.budget}M · {hrs.cast.length}/5
          </span>
          <span className="btable__leader t-mono">{leader ? `Top: ${leader.name}` : lot ? 'No bids yet' : ''}</span>
        </div>
        {!lot && humansFull(game) && (
          <button className="btn btn--hot" onClick={() => act((g) => fastForward(g))}>
            Let {house.name} finish casting
          </button>
        )}
      </div>
      <Half game={game} studio={p1} a={a} />
    </div>
  );
}

function Half({
  game,
  studio,
  flipped = false,
  a,
}: {
  game: Game;
  studio: Studio;
  flipped?: boolean;
  a: ReturnType<typeof useAuction>;
}) {
  const rs = game.reel.studios[studio.id];
  const s = stock(studio.colour);
  const lot = a.lot;
  const lead = lot?.high?.studioId === studio.id;
  const full = slotsLeft(rs) === 0;
  const steps = lot && !full && !lead ? bidSteps(game, studio.id) : [];
  const out = a.passed.includes(studio.id);
  const sale = game.reel.sales[game.reel.sales.length - 1];

  return (
    <section
      className={`bhalf ${flipped ? 'bhalf--flipped' : ''} ${lead ? 'is-leading' : ''}`}
      style={{ ['--h-bg' as string]: s.bg, ['--h-ink' as string]: s.ink }}
      aria-label={`${studio.name}’s side`}
    >
      <header className="bhalf__head">
        <span className="bhalf__name t-ticket">{studio.name}</span>
        <span className="bhalf__money t-mono">
          ${rs.budget}M · max ${maxBid(rs)}M · {rs.cast.length}/5
        </span>
      </header>
      <div className="bhalf__lot">
        {lot ? (
          <>
            <div className="bhalf__kicker t-wide">{lot.card.deck === 'legacy' ? 'From the vault' : 'Now casting'}</div>
            <div className={`bhalf__star t-ticket ${lot.card.deck === 'legacy' ? 'is-legend' : ''}`}>
              <FitText text={lot.card.name} max={30} min={14} />
            </div>
            <Traits traits={lot.card.traits} small />
            <div className="bhalf__price t-ticket">
              {lot.high ? `$${lot.high.amount}M` : 'No bids'}
              <span className="bhalf__secs t-mono">{a.seconds}s</span>
            </div>
          </>
        ) : sale ? (
          <div className="bhalf__sale">
            {sale.studioId ? `${sale.card.name} → ${studioById(game, sale.studioId).name}, $${sale.price}M` : `${sale.card.name}: binned`}
          </div>
        ) : (
          <div className="bhalf__sale">Next star coming up…</div>
        )}
      </div>
      <div className="bhalf__buttons">
        {!lot ? null : full ? (
          <span className="bhalf__note">Full house</span>
        ) : lead ? (
          <span className="bhalf__note">You’re top bid</span>
        ) : steps.length === 0 ? (
          <span className="bhalf__note">Max ${maxBid(rs)}M</span>
        ) : (
          <>
            {steps.slice(0, 2).map((v) => (
              <button key={v} className="btn bhalf__bid" onClick={() => a.bid(studio.id, v)}>
                ${v}M
              </button>
            ))}
            <button className="btn btn--ghost bhalf__pass" disabled={out} onClick={() => a.pass(studio.id)}>
              {out ? 'Out' : 'Pass'}
            </button>
          </>
        )}
      </div>
      <ol className="bhalf__cast">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className={rs.cast[i] ? '' : 'empty'}>
            {rs.cast[i] ? rs.cast[i].card.name : 'Open'}
          </li>
        ))}
      </ol>
    </section>
  );
}
