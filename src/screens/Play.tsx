import { useEffect, useState } from 'react';
import type { Game, Studio } from '../game/types';
import {
  RULES,
  criticOf,
  filmTitle,
  finishReel,
  genreKnown,
  genreOf,
  givePlot,
  houseFor,
  humans,
  isHuman,
  matchLeader,
  nextReel,
  reelRanking,
  rivalOf,
  scorecard,
  setPhase,
  setTitle,
  shareText,
  studioById,
} from '../game/engine';
import { loadDailies, streak } from '../lib/storage';
import { SITE_URL } from '../lib/links';
import { stock } from '../lib/palette';
import { CrossSell, FilmTicket, GenreCard, LoyaltyCard, StudioStub } from '../components/Cards';
import { Ticket } from '../components/Ticket';
import { SoloAuction, TableAuction } from './Auction';
import { useCountdownToNextDaily } from './Home';
import type { Act, Toast } from '../App';

interface PlayProps {
  game: Game;
  act: Act;
  say: (t: Toast) => void;
  onLeave: () => void;
  onUndo?: () => void;
  canUndo: boolean;
  onHow: () => void;
  onArchive: () => void;
  onFree: () => void;
}

const PHASE_LABEL: Record<Game['phase'], string> = {
  commission: 'The commission',
  auction: 'Casting auction',
  reveal: 'The reveal',
  critic: 'Title it',
  title: 'Title it',
  pitch: 'The pitches',
  scoring: 'Scoring',
  oscar: 'The envelope',
  result: 'The result',
  final: 'Final credits',
};

export function Play(props: PlayProps) {
  const { game, onLeave, onUndo, canUndo, onHow } = props;
  const tableTop = game.mode === 'two' && game.phase === 'auction';
  const label = game.mode === 'dailies' ? `Dailies #${game.puzzle}` : game.mode === 'free' ? 'Free Play' : `Reel ${game.reel.number}/${game.totalReels}`;
  return (
    <>
      {!tableTop && (
        <header className="marquee bmarquee">
          <button className="marquee__mark" onClick={onLeave} aria-label="Back to the lobby">
            GREENLIT <small>(B-MOVIE)</small>
          </button>
          <div className="marquee__reel">
            {label} · {PHASE_LABEL[game.phase]}
          </div>
          <div className="marquee__tools">
            {onUndo && (
              <button className="tool" onClick={onUndo} disabled={!canUndo}>
                Undo
              </button>
            )}
            <button className="tool" onClick={onHow}>
              Rules
            </button>
          </div>
        </header>
      )}
      <Phase {...props} />
    </>
  );
}

function Phase(props: PlayProps) {
  const { game, act } = props;
  switch (game.phase) {
    case 'commission':
      return <Commission {...props} />;
    case 'auction':
      return game.mode === 'two' ? (
        <>
          <TableAuction game={game} act={act} />
          <button className="btable__exit" onClick={props.onLeave} aria-label="Leave to the lobby">
            ✕
          </button>
        </>
      ) : (
        <SoloAuction game={game} act={act} />
      );
    case 'reveal':
      return <Reveal {...props} />;
    case 'critic':
      return <TitleIt {...props} />;
    case 'title':
      return <TitleIt {...props} />;
    case 'pitch':
      return <Pitches {...props} />;
    case 'scoring':
      return <Scoring {...props} />;
    case 'oscar':
      return <Oscar {...props} />;
    case 'result':
      return game.mode === 'two' ? <ReelStandings {...props} /> : <SoloResult {...props} />;
    case 'final':
      return game.mode === 'two' ? <FinalCredits {...props} /> : <SoloResult {...props} />;
  }
}

/* ====================================================================== */
/*  Commission: the sealed envelope                                        */
/* ====================================================================== */
function Commission({ game, act }: PlayProps) {
  const rivals = game.studios.filter((s) => !isHuman(s));
  return (
    <main className="page page--narrow centre-stack bcommission">
      <div className="t-wide">{game.mode === 'two' ? `Reel ${game.reel.number}` : game.mode === 'dailies' ? `Dailies #${game.puzzle}` : 'Free Play'}</div>
      {genreKnown(game) ? (
        <>
          <div className="bcommission__genre">
            <GenreCard genre={genreOf(game)} number={game.reel.number} sealed />
          </div>
          <p className="lede">
            Every star carries secret trait stamps. This genre wants some of them, hates one, and has five roles to fill. You’ll see it all at the premiere.
          </p>
        </>
      ) : (
        <>
        <div className="envelope" aria-label="A sealed envelope">
          <div className="envelope__flap" aria-hidden="true" />
          <div className="envelope__body">
            <span className="t-mono">Commission no. {String(game.reel.number).padStart(2, '0')}</span>
            <strong className="t-ticket">Genre classified</strong>
            <span className="t-mono">To be opened after casting</span>
          </div>
          <div className="envelope__seal t-ticket" aria-hidden="true">
            B
          </div>
        </div>
        <p className="lede">
          The genre is sealed. Nobody sees it until casting closes. Bid on stars whose traits you think the film will want.
        </p>
        </>
      )}
      <section className="bcommission__rivals" aria-label="Your rivals">
        <h2 className="t-wide">{rivals.length === 1 ? 'Also bidding' : 'Today’s rivals'}</h2>
        {rivals.map((s) => (
          <div key={s.id} className="brival-card" style={{ ['--r-bg' as string]: stock(s.colour).bg, ['--r-ink' as string]: stock(s.colour).ink }}>
            <strong className="t-ticket">{s.name}</strong>
            <span>{houseFor(s)?.blurb}</span>
          </div>
        ))}
      </section>
      {game.mode === 'two' && <p className="muted">Lay the phone flat between you. Studio A sits at the bottom edge.</p>}
      <button className="btn btn--big btn--hot" onClick={() => act((g) => setPhase(g, 'auction'), { undoable: true })}>
        {genreKnown(game) ? `Start casting your ${genreOf(game).name}` : 'Open the casting auction'}
      </button>
    </main>
  );
}

/* ====================================================================== */
/*  The reveal                                                             */
/* ====================================================================== */
function Reveal({ game, act }: PlayProps) {
  const [open, setOpen] = useState(genreKnown(game));
  const genre = genreOf(game);
  if (!open) {
    return (
      <div className="reveal" role="dialog" aria-modal="true" aria-label="The genre reveal">
        <div className="reveal__inner" style={{ display: 'grid', gap: 18, justifyItems: 'center' }}>
          <div className="t-wide">Casting is closed</div>
          <div className="envelope envelope--dark" aria-hidden="true">
            <div className="envelope__flap" />
            <div className="envelope__body">
              <strong className="t-ticket">Your next picture is…</strong>
            </div>
            <div className="envelope__seal t-ticket">B</div>
          </div>
          <button className="btn btn--big btn--hot" onClick={() => setOpen(true)} autoFocus>
            Open the envelope
          </button>
        </div>
      </div>
    );
  }
  const order = [...humans(game), ...game.studios.filter((s) => !isHuman(s))];
  return (
    <main className="page page--narrow centre-stack breveal">
      <div className="t-wide">{genreKnown(game) ? 'The premiere: traits revealed' : 'Your next picture is'}</div>
      <div className="breveal__card">
        <GenreCard genre={genre} number={game.reel.number} roles />
      </div>
      <p className="lede">Solid stamps are what the genre wants (+2). Dashed is the bonus (+1). Struck through clashes (−1). The roles are your Plot.</p>
      <div className="breveal__casts">
        {order.map((s) => (
          <StudioStub key={s.id} studio={s} rs={game.reel.studios[s.id]} genre={genre} you={isHuman(s) && game.mode !== 'two'} />
        ))}
      </div>
      <button className="btn btn--big btn--hot" onClick={() => act((g) => setPhase(g, 'title'), { undoable: true })}>
        Title your {humans(game).length > 1 ? 'films' : 'film'}
      </button>
    </main>
  );
}

/* ====================================================================== */
/*  Title it                                                               */
/* ====================================================================== */
const OPENERS = ['Night of the', 'Return of the', 'The Last', 'Attack of the', 'Revenge of the', 'Bride of the', 'The Curse of the', 'Escape from the', 'Daughter of the', 'Kiss of the'];
const NOUNS = ['Fifty-Foot Agent', 'Velvet Lobster', 'Midnight Caddie', 'Second Unit', 'Budget Cuts', 'Swamp Accountant', 'Disco Mummy', 'Overtime', 'Lonely Usher', 'Popcorn People', 'Recast', 'Body Doubles'];
const randomTitle = () => `${OPENERS[Math.floor(Math.random() * OPENERS.length)]} ${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;

function TitleIt({ game, act }: PlayProps) {
  const people = humans(game);
  const genre = genreOf(game);
  return (
    <main className="page page--narrow btitle">
      <div className="t-wide">{genre.name}</div>
      <h1 className="page-title t-ticket">Title it</h1>
      <p className="lede">Name your film. A logline is optional, but it goes in the archive forever.</p>
      <div className="btitle__forms">
        {people.map((s) => {
          const rs = game.reel.studios[s.id];
          const st = stock(s.colour);
          return (
            <Ticket key={s.id} bg={st.bg} ink={st.ink} className="btitle__card">
              <div className="t-wide">{s.name} presents</div>
              <label className="field">
                <span className="visually-hidden">Film title for {s.name}</span>
                <input
                  id={`title-${s.id}`}
                  className="input input--line btitle__input"
                  value={rs.title}
                  maxLength={60}
                  placeholder={`Untitled ${genre.name}`}
                  onChange={(e) => act((g) => setTitle(g, s.id, e.target.value, g.reel.studios[s.id].logline))}
                />
              </label>
              <label className="field">
                <span>Logline (optional)</span>
                <input
                  id={`logline-${s.id}`}
                  className="input"
                  value={rs.logline}
                  maxLength={120}
                  placeholder="In a world where…"
                  onChange={(e) => act((g) => setTitle(g, s.id, g.reel.studios[s.id].title, e.target.value))}
                />
              </label>
              <button type="button" className="link-btn" onClick={() => act((g) => setTitle(g, s.id, randomTitle(), g.reel.studios[s.id].logline))}>
                Stuck? Pull a title out of the hat
              </button>
              <div className="btitle__cast">Starring {rs.cast.map((m) => m.card.name).join(' / ')}</div>
            </Ticket>
          );
        })}
      </div>
      <button className="btn btn--big btn--hot" onClick={() => act((g) => setPhase(g, g.mode === 'two' ? 'pitch' : 'scoring'), { undoable: true })}>
        {game.mode === 'two' ? 'On to the pitches' : 'Punch the card'}
      </button>
    </main>
  );
}

/* ====================================================================== */
/*  Two-Hander pitches and secret Plot scores                              */
/* ====================================================================== */
function usePitchClock(resetKey: unknown) {
  const [left, setLeft] = useState(RULES.pitchSeconds);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    setLeft(RULES.pitchSeconds);
    setRunning(false);
  }, [resetKey]);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setLeft((l) => (l <= 1 ? (setRunning(false), 0) : l - 1)), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  return { left, running, start: () => setRunning(true), pause: () => setRunning(false) };
}

function Pitches({ game, act }: PlayProps) {
  const people = humans(game);
  const nextUp = people.find((s) => game.reel.plotGiven[s.id] === undefined);
  const [stage, setStage] = useState<'pitch' | 'pass' | 'score'>('pitch');
  const [stamps, setStamps] = useState(0);
  const clock = usePitchClock(nextUp?.id);

  if (!nextUp) {
    return (
      <main className="page page--narrow centre-stack">
        <h1 className="page-title t-ticket">Both films are scored</h1>
        <button className="btn btn--big btn--hot" onClick={() => act((g) => setPhase(g, 'scoring'))}>
          Punch the cards
        </button>
      </main>
    );
  }
  const judge = rivalOf(game, nextUp.id);
  const rs = game.reel.studios[nextUp.id];
  const st = stock(nextUp.colour);

  if (stage === 'pass') {
    return (
      <main className="page page--narrow centre-stack bpass">
        <div className="t-wide">Look away</div>
        <p className="lede">
          Hand the phone to <b>{judge.name}</b>. {nextUp.name}, eyes on the ceiling.
        </p>
        <button className="btn btn--big" onClick={() => setStage('score')}>
          I’m {judge.name}. Let me score it
        </button>
      </main>
    );
  }

  if (stage === 'score') {
    return (
      <main className="page page--narrow centre-stack bscore">
        <div className="t-wide">{judge.name}, in secret</div>
        <h1 className="page-title t-ticket" style={{ textAlign: 'center' }}>
          Score the plot of {filmTitle(game, nextUp.id)}
        </h1>
        <p className="lede">
          Be fair. The app also counts how many of the five roles their cast really fills. Land within one of that and you bank an Honest Critic bonus point.
        </p>
        <div className="punches punches--big" role="group" aria-label="Plot stamps">
          {Array.from({ length: RULES.stamps }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`punch ${i < stamps ? 'is-on' : ''}`}
              style={{ ['--tilt' as string]: `${((i * 37) % 21) - 10}deg` }}
              aria-pressed={i < stamps}
              aria-label={`${i + 1} of 5`}
              onClick={() => setStamps(stamps === i + 1 ? i : i + 1)}
            >
              {i < stamps ? '★' : ''}
            </button>
          ))}
        </div>
        <p className="t-mono">{stamps} of 5</p>
        <button
          className="btn btn--big btn--go"
          onClick={() => {
            act((g) => givePlot(g, nextUp.id, stamps));
            setStamps(0);
            setStage('pitch');
          }}
        >
          Seal my score
        </button>
      </main>
    );
  }

  return (
    <main className="page page--narrow centre-stack bpitch">
      <div className="t-wide">The pitch · 60 seconds</div>
      <Ticket bg={st.bg} ink={st.ink} className="clock-ticket">
        <div className="clock-ticket__studio t-ticket">{nextUp.name}</div>
        <div className="bpitch__title t-ticket">{filmTitle(game, nextUp.id)}</div>
        {rs.logline && <p className="bpitch__log">{rs.logline}</p>}
        <div className="bpitch__time t-ticket">{clock.left}</div>
        <div className="clock-bar" aria-hidden="true">
          <span style={{ width: `${(clock.left / RULES.pitchSeconds) * 100}%` }} />
        </div>
        <div className="cast-line">Starring {rs.cast.map((m) => m.card.name).join(' / ')}</div>
      </Ticket>
      <p className="lede">
        {nextUp.name}, sell it to {judge.name}. Plot, set pieces, the big finish.
      </p>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        {clock.running ? (
          <button className="btn btn--big btn--ghost" onClick={clock.pause}>
            Pause
          </button>
        ) : (
          <button className="btn btn--big btn--hot" onClick={clock.start} disabled={clock.left === 0}>
            {clock.left === RULES.pitchSeconds ? 'Start the clock' : 'Resume'}
          </button>
        )}
        <button className="btn btn--big" onClick={() => setStage('pass')}>
          Pitch over
        </button>
      </div>
    </main>
  );
}

/* ====================================================================== */
/*  Scoring: the loyalty cards punch themselves                            */
/* ====================================================================== */
function Scoring({ game, act }: PlayProps) {
  const order = [...humans(game), ...game.studios.filter((s) => !isHuman(s))];
  const plotNote = (s: Studio) => (game.mode === 'two' && isHuman(s) ? `Scored by ${rivalOf(game, s.id).name}.` : undefined);
  return (
    <main className="page bscoring">
      <div className="page-head">
        <div>
          <div className="t-wide">
            {genreOf(game).name} · reel {game.reel.number}
          </div>
          <h1 className="page-title t-ticket">Punch the cards</h1>
        </div>
      </div>
      <div className="bloyal-grid">
        {order.map((s, i) => (
          <LoyaltyCard
            key={s.id}
            studio={s}
            title={filmTitle(game, s.id)}
            card={scorecard(game, s.id)}
            animate
            delay={i === 0 ? 0 : 900 + i * 400}
            you={isHuman(s) && game.mode !== 'two'}
            plotNote={plotNote(s)}
          />
        ))}
      </div>
      <div className="btn-row" style={{ justifyContent: 'center', marginTop: 24 }}>
        <button className="btn btn--big btn--hot" onClick={() => act((g) => finishReel(g))}>
          And the Oscar goes to…
        </button>
      </div>
    </main>
  );
}

/* ====================================================================== */
/*  The Oscar                                                              */
/* ====================================================================== */
function Oscar({ game, act }: PlayProps) {
  const [stage, setStage] = useState<'table' | 'drumroll' | 'winner'>('table');
  const result = game.results[game.results.length - 1];
  const winner = studioById(game, result.winnerId);
  useEffect(() => {
    if (stage !== 'drumroll') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setStage('winner'), reduce ? 600 : 3200);
    return () => window.clearTimeout(t);
  }, [stage]);
  return (
    <div className={`oscar oscar--${stage}`} role="dialog" aria-modal="true" aria-label="The Oscar">
      <div className="oscar__inner">
        {stage === 'table' && (
          <>
            <div className="t-wide oscar__kicker">
              {result.genre} · Reel {String(result.reel).padStart(2, '0')}
            </div>
            <p className="oscar__line t-ticket">The envelope, please.</p>
            <p className="oscar__sub">Somebody do a drumroll.</p>
            <button className="btn btn--big oscar__btn" onClick={() => setStage('drumroll')} autoFocus>
              Open the envelope
            </button>
          </>
        )}
        {stage === 'drumroll' && (
          <>
            <p className="oscar__line t-ticket">And the Oscar goes to</p>
            <div className="oscar__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </>
        )}
        {stage === 'winner' && (
          <>
            <div className="t-wide oscar__kicker">And the Oscar goes to</div>
            <h1 className="oscar__winner t-ticket">{winner.name}</h1>
            <p className="oscar__film">
              for <em>{filmTitle(game, winner.id)}</em>
            </p>
            <p className="oscar__sub">{result.totals[winner.id]} of 15 stamps</p>
            <button className="btn btn--big oscar__btn" onClick={() => act((g) => setPhase(g, 'result'))}>
              {isHuman(winner) && game.mode !== 'two' ? 'Collect your Oscar' : 'See the results'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  Solo result: share, streak, history, cross-sell                        */
/* ====================================================================== */
function SoloResult({ game, say, onLeave, onArchive, onFree }: PlayProps) {
  const me = humans(game)[0];
  const ranking = reelRanking(game);
  const place = ranking.findIndex((r) => r.studio.id === me.id);
  const film = game.films.find((f) => f.reel === game.reel.number);
  const verdict = scorecard(game, me.id);
  const text = shareText(game, SITE_URL());
  const countdown = useCountdownToNextDaily();
  const all = loadDailies();
  const run = game.dateKey ? streak(all, game.dateKey) : 0;
  const history = Object.values(all)
    .filter((r) => r.done)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 7);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      say({ text: 'Copied. Paste it anywhere.' });
    } catch {
      say({ text: 'Couldn’t copy automatically. Press and hold the text to copy it.', error: true });
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* cancelled: fall through to copy */
      }
    }
    copy();
  };

  const headline = place === 0 ? 'You took the Oscar' : place === ranking.length - 1 ? 'Bottom of the bill' : `You came ${['', 'second', 'third'][place] ?? `${place + 1}th`}`;

  return (
    <main className="page page--narrow bresult">
      <div className="t-wide">{game.mode === 'dailies' ? `Dailies #${game.puzzle}` : 'Free Play'} · {genreOf(game).name}</div>
      <h1 className="page-title t-ticket">{headline}</h1>
      {film && <FilmTicket film={film} />}
      <blockquote className="bresult__quote">
        “{verdict.quote}” <span>{criticOf(game).name}, {criticOf(game).paper}</span>
      </blockquote>

      <section className="bresult__table" aria-label="How everyone did">
        <h2 className="t-wide">The bill</h2>
        <ol className="brank">
          {ranking.map(({ studio, card }, i) => (
            <li key={studio.id} className={studio.id === me.id ? 'is-you' : ''}>
              <span className="brank__place t-mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="dot" style={{ background: stock(studio.colour).bg }} />
              <span className="brank__name">{studio.name}</span>
              <span className="brank__stamps t-mono" aria-label={`Casting ${card.casting}, budget ${card.budget}, plot ${card.plot}`}>
                {card.casting}·{card.budget}·{card.plot}
              </span>
              <b className="brank__total">{card.total}</b>
            </li>
          ))}
        </ol>
        <p className="muted bresult__key">Casting · Budget · Plot</p>
      </section>

      <section className="bshare" aria-label="Share your result">
        <pre className="bshare__text">{text}</pre>
        <div className="btn-row">
          <button className="btn btn--hot" onClick={share}>
            Share result
          </button>
          <button className="btn btn--ghost" onClick={copy}>
            Copy
          </button>
        </div>
      </section>

      {game.mode === 'dailies' && (
        <section className="bstreak">
          <div>
            <span className="t-wide">Streak</span>
            <b className="t-ticket">{run}</b>
          </div>
          <div>
            <span className="t-wide">Next Dailies</span>
            <b className="t-ticket t-mono">{countdown}</b>
          </div>
          {history.length > 1 && (
            <ul className="bstreak__history">
              {history.map((h) => (
                <li key={h.dateKey}>
                  <span className="t-mono">#{h.puzzle}</span>
                  <span>{h.total}/15</span>
                  {h.won && <span className="bstreak__oscar">Oscar</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="btn-row">
        <button className="btn" onClick={onFree}>
          {game.mode === 'free' ? 'Play again' : 'Practise in Free Play'}
        </button>
        <button className="btn btn--ghost" onClick={onArchive}>
          The archive
        </button>
        <button className="btn btn--ghost" onClick={onLeave}>
          Lobby
        </button>
      </div>
      <CrossSell variant="after" />
    </main>
  );
}

/* ====================================================================== */
/*  Two-Hander standings and final credits                                 */
/* ====================================================================== */
function Standings({ game }: { game: Game }) {
  const rows = [...game.studios].sort((a, b) => game.points[b.id] - game.points[a.id] || game.stubs[b.id] - game.stubs[a.id]);
  return (
    <ol className="brank">
      {rows.map((s, i) => (
        <li key={s.id} className={isHuman(s) ? 'is-you' : ''}>
          <span className="brank__place t-mono">{String(i + 1).padStart(2, '0')}</span>
          <span className="dot" style={{ background: stock(s.colour).bg }} />
          <span className="brank__name">
            {s.name}
            {game.honest[s.id] > 0 && <small> · {game.honest[s.id]} honest</small>}
          </span>
          <span className="brank__stamps t-mono">{game.stubs[s.id]} stub{game.stubs[s.id] === 1 ? '' : 's'}</span>
          <b className="brank__total">{game.points[s.id]}</b>
        </li>
      ))}
    </ol>
  );
}

function ReelStandings({ game, act }: PlayProps) {
  const films = game.films.filter((f) => f.reel === game.reel.number);
  const { tied } = matchLeader(game);
  const last = game.reel.number >= game.totalReels;
  return (
    <main className="page page--narrow bresult">
      <div className="t-wide">
        After reel {game.reel.number} of {game.totalReels}
      </div>
      <h1 className="page-title t-ticket">The board</h1>
      <Standings game={game} />
      <p className="muted">Points are your stamps added up, plus any Honest Critic bonus. Greenlight stubs break a tie.</p>
      <div className="bresult__films">
        {films.map((f) => (
          <FilmTicket key={f.id} film={f} />
        ))}
      </div>
      <button className="btn btn--big btn--hot" onClick={() => act((g) => nextReel(g), { undoable: true })}>
        {!last ? `On to reel ${game.reel.number + 1}` : tied ? 'Dead heat: sudden-death reel' : 'Roll the final credits'}
      </button>
    </main>
  );
}

function FinalCredits({ game, onLeave, onArchive }: PlayProps) {
  const { leader } = matchLeader(game);
  return (
    <main className="page page--narrow bresult bfinal">
      <div className="t-wide">Final credits</div>
      <h1 className="page-title t-ticket">{leader ? `${leader.name} wins the Two-Hander` : 'A dead heat'}</h1>
      <Standings game={game} />
      <div className="bresult__films">
        {game.films.map((f) => (
          <FilmTicket key={f.id} film={f} />
        ))}
      </div>
      <div className="btn-row">
        <button className="btn btn--ghost" onClick={onArchive}>
          The archive
        </button>
        <button className="btn" onClick={onLeave}>
          Lobby
        </button>
      </div>
      <CrossSell variant="after" />
    </main>
  );
}
