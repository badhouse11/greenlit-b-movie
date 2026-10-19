import { useEffect, useState } from 'react';
import type { Card, Critic, Film, Genre, ReelStudio, Studio } from '../game/types';
import type { Line, Scorecard } from '../game/engine';
import { ROLES, RULES, maxBid, slotsLeft } from '../game/engine';
import { stock } from '../lib/palette';
import { GREENLIT_URL } from '../lib/links';
import { FitText, Ticket, serialFor } from './Ticket';

/* ---------------------------------------------------------------------- */
/*  Trait stamps: little rubber-stamped tags printed on the star tickets   */
/* ---------------------------------------------------------------------- */
const TRAIT_KEY: Record<string, string> = {
  Muscle: 'muscle',
  Laughs: 'laughs',
  Heart: 'heart',
  Scream: 'scream',
  Prestige: 'prestige',
  'Box Office': 'boxoffice',
  Cult: 'cult',
  'Song & Dance': 'song',
  Charm: 'charm',
  Edge: 'edge',
};

export function Trait({ name, tone, small = false }: { name: string; tone?: 'want' | 'bonus' | 'clash'; small?: boolean }) {
  return (
    <span className={`trait trait--${TRAIT_KEY[name] ?? 'x'} ${tone ? `trait--${tone}` : ''} ${small ? 'trait--small' : ''}`}>{name}</span>
  );
}

export function Traits({ traits, genre, small }: { traits: string[]; genre?: Genre; small?: boolean }) {
  const tone = (t: string) => (!genre ? undefined : genre.wants.includes(t) ? 'want' : genre.bonus === t ? 'bonus' : genre.clash === t ? 'clash' : undefined);
  return (
    <span className="traits">
      {traits.map((t) => (
        <Trait key={t} name={t} tone={tone(t)} small={small} />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/*  The lot: one star on the table                                         */
/* ---------------------------------------------------------------------- */
export function LotTicket({ card, compact = false, hideTraits = false }: { card: Card; compact?: boolean; hideTraits?: boolean }) {
  const legacy = card.deck === 'legacy';
  const num = card.id.replace(/\D/g, '');
  return (
    <Ticket
      serrated
      frame={false}
      wrapClassName={legacy ? 'vault-surprise' : 'slide-in'}
      className={`blot ${legacy ? 'blot--legacy' : ''} ${compact ? 'blot--compact' : ''}`}
    >
      <div className="blot__top">
        <span>{legacy ? 'From the vault' : 'Now casting'}</span>
        <span>
          No. {legacy ? 'L' : 'T'}
          {num}
        </span>
      </div>
      <div className="blot__name t-ticket">
        <FitText text={card.name} max={compact ? 30 : 46} min={14} />
      </div>
      {hideTraits ? (
        <span className="traits" aria-label="Traits sealed until the premiere">
          {card.traits.map((_, i) => (
            <span key={i} className="trait trait--sealed">
              Sealed
            </span>
          ))}
        </span>
      ) : (
        <Traits traits={card.traits} />
      )}
      {!compact && (
        <div className="blot__serial" aria-hidden="true">
          {serialFor(card.name)} · admit one star
        </div>
      )}
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/*  Studio stub: budget and five slots                                     */
/* ---------------------------------------------------------------------- */
export function StudioStub({
  studio,
  rs,
  you = false,
  genre,
  leading = false,
}: {
  studio: Studio;
  rs: ReelStudio;
  you?: boolean;
  genre?: Genre;
  leading?: boolean;
}) {
  const s = stock(studio.colour);
  const full = slotsLeft(rs) === 0;
  return (
    <Ticket bg={s.bg} ink={s.ink} className={`bstub ${leading ? 'is-leading' : ''}`}>
      <div className="bstub__head">
        <div className="bstub__name t-ticket">
          {studio.name}
          {you && <span className="bstub__you">You</span>}
        </div>
        <div className="bstub__money t-mono">
          {full ? 'Full house' : `$${rs.budget}M · max $${maxBid(rs)}M`}
        </div>
      </div>
      <ol className="bslots">
        {Array.from({ length: RULES.castSize }, (_, i) => {
          const m = rs.cast[i];
          return (
            <li key={i} className={m ? (m.card.deck === 'legacy' ? 'is-legend' : '') : 'empty'}>
              {m ? (
                <>
                  <span className="bslots__name">{m.card.name}</span>
                  {genre && <Traits traits={m.card.traits} genre={genre} small />}
                  <span className="bslots__price t-mono">${m.price}M</span>
                </>
              ) : (
                <span className="bslots__name">Open slot</span>
              )}
            </li>
          );
        })}
      </ol>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/*  The genre card, revealed                                               */
/* ---------------------------------------------------------------------- */
export function GenreCard({ genre, number, roles = false, sealed = false }: { genre: Genre; number: number; roles?: boolean; sealed?: boolean }) {
  return (
    <div className="gcard">
      <div className="gcard__head t-mono">
        <span>Commission no. {String(number).padStart(2, '0')}</span>
        <span>{sealed ? 'Your commission' : 'Opened'}</span>
      </div>
      <div className="gcard__name t-ticket">
        <FitText text={genre.name} max={56} min={20} />
      </div>
      {sealed ? (
        <p className="gcard__sealed">What it wants stays sealed until the premiere. Cast it from instinct.</p>
      ) : (
      <dl className="gcard__rows">
        <div>
          <dt>Wants · +2 each</dt>
          <dd>
            {genre.wants.map((t) => (
              <Trait key={t} name={t} tone="want" />
            ))}
          </dd>
        </div>
        <div>
          <dt>Bonus · +1</dt>
          <dd>
            <Trait name={genre.bonus} tone="bonus" />
          </dd>
        </div>
        <div>
          <dt>Clashes · −1</dt>
          <dd>
            <Trait name={genre.clash} tone="clash" />
          </dd>
        </div>
      </dl>
      )}
      {roles && !sealed && (
        <div className="gcard__roles">
          <div className="gcard__roles-head t-wide">The roles · 1 Plot stamp each</div>
          <ul>
            {ROLES.map((r) => (
              <li key={r.key}>
                <span>{r.label}</span>
                <Trait name={genre.roles[r.key]} small />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  The critic: a newspaper review clipping                                */
/* ---------------------------------------------------------------------- */
export function CriticClip({ critic, quote, stamps }: { critic: Critic; quote?: string; stamps?: number }) {
  return (
    <article className="clip">
      <div className="clip__mast">
        <span>{critic.paper}</span>
        <span>Film page</span>
      </div>
      <div className="clip__byline t-wide">Our critic</div>
      <h3 className="clip__name t-ticket">{critic.name}</h3>
      <div className="clip__taste">{critic.taste}</div>
      <p className="clip__rule">{critic.rule}</p>
      {quote && (
        <blockquote className="clip__quote">
          “{quote}”
          {stamps !== undefined && (
            <span className="clip__stars" aria-label={`${stamps} of 5 stamps`}>
              {'★'.repeat(stamps)}
              <span>{'★'.repeat(RULES.stamps - stamps)}</span>
            </span>
          )}
        </blockquote>
      )}
      <p className="clip__foot">Every film starts on 2 Plot stamps. The critic adds or takes away from there.</p>
    </article>
  );
}

/* ---------------------------------------------------------------------- */
/*  Loyalty card: punches its stamps one by one, with the reasons          */
/* ---------------------------------------------------------------------- */
const CATS = [
  { key: 'casting', label: 'Casting' },
  { key: 'budget', label: 'Budget' },
  { key: 'plot', label: 'Plot' },
] as const;

export function LoyaltyCard({
  studio,
  title,
  card,
  animate = false,
  delay = 0,
  you = false,
  plotNote,
}: {
  studio: Studio;
  title: string;
  card: Scorecard;
  animate?: boolean;
  delay?: number;
  you?: boolean;
  plotNote?: string;
}) {
  const s = stock(studio.colour);
  const target = card.casting + card.budget + card.plot;
  const [shown, setShown] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(target);
      return;
    }
    let n = 0;
    let t: number;
    const tick = () => {
      n += 1;
      setShown(n);
      if (n < target) t = window.setTimeout(tick, 260);
    };
    t = window.setTimeout(tick, delay + 300);
    return () => window.clearTimeout(t);
  }, [animate, target, delay]);

  let before = 0;
  return (
    <Ticket className="bloyal" frame={false}>
      <div className="bloyal__band" style={{ background: s.bg, color: s.ink }}>
        <div className="bloyal__studio t-ticket">
          {studio.name}
          {you && <span className="bstub__you">You</span>}
        </div>
        <div className="bloyal__title">{title}</div>
      </div>
      <div className="bloyal__body">
        {CATS.map((cat) => {
          const value = card[cat.key];
          const start = before;
          before += value;
          const lit = Math.max(0, Math.min(value, shown - start));
          return (
            <div key={cat.key} className="bloyal__row">
              <div className="bloyal__label">
                <strong className="t-ticket">{cat.label}</strong>
                <div className="punches" aria-label={`${value} of 5 ${cat.label} stamps`}>
                  {Array.from({ length: RULES.stamps }, (_, i) => (
                    <span
                      key={i}
                      className={`punch ${i < lit ? 'is-on' : ''} ${i < value ? 'is-due' : ''}`}
                      style={{ ['--tilt' as string]: `${((i * 37) % 21) - 10}deg` }}
                    >
                      {i < lit ? '★' : ''}
                    </span>
                  ))}
                </div>
              </div>
              <Why cat={cat.key} card={card} plotNote={plotNote} />
            </div>
          );
        })}
        <div className="loyalty__total">
          <span>Total</span>
          <b>
            {Math.min(shown, target)}
            <small>/15</small>
          </b>
        </div>
      </div>
    </Ticket>
  );
}

function Why({ cat, card, plotNote }: { cat: 'casting' | 'budget' | 'plot'; card: Scorecard; plotNote?: string }) {
  if (cat === 'budget') return <p className="why">Spent ${card.spent}M of $20M.</p>;
  if (cat === 'plot' && card.plotByPlayer) return <p className="why">{plotNote ?? 'Scored by the other studio.'}</p>;
  const lines: Line[] = cat === 'casting' ? card.fitLines : card.plotLines;
  const total = lines.reduce((a, l) => a + l.pts, 0);
  return (
    <ul className="why">
      {lines.length === 0 && <li>Nothing on genre. Fit score 0.</li>}
      {lines.map((l, i) => (
        <li key={i} className={l.pts < 0 ? 'neg' : l.pts === 0 ? 'nil' : ''}>
          <b>{l.pts > 0 ? `+${l.pts}` : l.pts === 0 ? '·' : l.pts}</b> {l.text}
        </li>
      ))}
      {cat === 'casting' && lines.length > 0 && <li className="why__sum">Fit score {total}</li>}
    </ul>
  );
}

/* ---------------------------------------------------------------------- */
/*  A finished film, printed as a ticket                                   */
/* ---------------------------------------------------------------------- */
export function FilmTicket({ film }: { film: Film }) {
  const s = stock(film.studioColour);
  const total = film.stamps.casting + film.stamps.budget + film.stamps.plot;
  return (
    <Ticket bg={s.bg} ink={s.ink} className="film film--compact bfilm">
      <div className="film__main">
        <div className="film__presents t-wide">{film.studioName} presents</div>
        <div className="film__title t-ticket">{film.title}</div>
        <div className="film__genre">
          <span>{film.genre}</span>
          <span>{film.mode === 'dailies' ? `Dailies #${film.puzzle}` : film.mode === 'two' ? `Two-Hander · reel ${film.reel}` : 'Free Play'}</span>
        </div>
        {film.logline && <p className="film__logline">{film.logline}</p>}
        <div className="film__cast">
          Starring{' '}
          {film.cast.map((c, i) => (
            <b key={c.name}>
              {c.name}
              {c.legacy ? ' ★' : ''}
              {i < film.cast.length - 1 ? ' / ' : ''}
            </b>
          ))}
        </div>
      </div>
      <div className="film__stub" aria-hidden="true">
        <div className="perf-v" />
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="vert vert--big">{total}/15</span>
          <span className="vert">B-movie · {new Date(film.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
        </div>
      </div>
    </Ticket>
  );
}

/* ---------------------------------------------------------------------- */
/*  The cross-sell to the main feature                                     */
/* ---------------------------------------------------------------------- */
export function CrossSell({ variant = 'home' }: { variant?: 'home' | 'after' | 'rules' }) {
  const head = variant === 'after' ? 'Liked the support feature?' : 'Got more friends?';
  const body =
    variant === 'after'
      ? 'The main feature’s on. Grab your friends: GREENLIT is the full game for 3 to 8 players, everyone bidding from their own phone.'
      : 'The full feature for 3 to 8 players. Everyone bids from their own phone.';
  return (
    <Ticket bg="#ACCAB2" ink="#2F4A3A" className="xsell" serrated>
      <div className="xsell__kicker t-wide">{head}</div>
      <div className="xsell__now t-ticket">
        Now showing: <span>Greenlit</span>
      </div>
      <p className="xsell__body">{body}</p>
      <a className="btn btn--go xsell__btn" href={GREENLIT_URL} target="_blank" rel="noopener">
        Play the full Greenlit
      </a>
    </Ticket>
  );
}
