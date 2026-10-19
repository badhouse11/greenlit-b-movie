/**
 * GREENLIT (B-MOVIE): the whole rulebook as pure functions.
 * Every function takes a Game and returns a new one; the UI never edits state any other way.
 * Every random choice in a reel comes from the reel's seed, so the same seed always plays the same reel.
 */
import talentDeck from '../data/talent.json';
import legacyDeck from '../data/legacy.json';
import genreDeck from '../data/genres.json';
import criticDeck from '../data/critics.json';
import houseRules from '../data/house.json';
import type {
  Card,
  Critic,
  Film,
  Game,
  Gender,
  Genre,
  HouseRules,
  Lot,
  Mode,
  Phase,
  Reel,
  ReelStudio,
  RoleKey,
  StarCard,
  Studio,
} from './types';

export const RULES = {
  startingBudget: 20,
  castSize: 5,
  minBid: 1,
  stamps: 5,
  plotBase: 2,
  lastOrders: houseRules.lastOrders,
  pitchSeconds: 60,
  rivalLead: 2,
  oscarClout: 2, // every Oscar winner adds this to the Casting fit score, whatever the genre // a rival never gets more than this many stars ahead of the slowest human
} as const;

export const TALENT: Card[] = (talentDeck.cards as StarCard[]).map((c) => ({ ...c, deck: 'talent' }));
export const LEGACY: Card[] = (legacyDeck.cards as StarCard[]).map((c) => ({ ...c, deck: 'legacy' }));
export const GENRES: Genre[] = genreDeck.cards as Genre[];
export const CRITICS: Critic[] = criticDeck.cards as Critic[];
export const HOUSES: HouseRules[] = houseRules.studios as HouseRules[];

export class RuleError extends Error {}

/* ------------------------------------------------------------------ */
/*  Seeded randomness                                                  */
/* ------------------------------------------------------------------ */

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, and identical on every device. */
export function rngFrom(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(input: readonly T[], rng: () => number): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)];

/* ------------------------------------------------------------------ */
/*  Dailies calendar                                                   */
/* ------------------------------------------------------------------ */

export const LAUNCH_DAY = '2026-10-19';

export const utcDateKey = (now: Date = new Date()) => now.toISOString().slice(0, 10);

export function puzzleNumber(dateKey: string): number {
  const days = (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${LAUNCH_DAY}T00:00:00Z`)) / 86400000;
  return Math.round(days) + 1;
}

export const dailySeed = (dateKey: string) => `dailies:${dateKey}`;

/** Milliseconds until the next UTC midnight, when a new Dailies drops. */
export function msToNextDaily(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const clone = <T>(x: T): T => structuredClone(x);

export const studioById = (g: Game, id: string): Studio => {
  const s = g.studios.find((x) => x.id === id);
  if (!s) throw new Error(`No studio ${id}`);
  return s;
};
export const houseFor = (s: Studio): HouseRules | null => HOUSES.find((h) => h.id === s.house) ?? null;
export const isHuman = (s: Studio) => !s.house;
export const humans = (g: Game) => g.studios.filter(isHuman);
/** Dailies and Free Play: the genre is on the envelope from the start and the traits stay hidden until the premiere. */
export const genreKnown = (g: Game) => g.mode !== 'two';
export const traitsHidden = (g: Game) => g.mode !== 'two' && ['commission', 'auction'].includes(g.phase);

export const ROLES: { key: RoleKey; label: string }[] = [
  { key: 'protagonist', label: 'Protagonist' },
  { key: 'antagonist', label: 'Antagonist' },
  { key: 'loveInterest', label: 'Love Interest' },
  { key: 'supporting', label: 'Supporting Cast' },
  { key: 'lightRelief', label: 'Light Relief' },
];

export const genreOf = (g: Game): Genre => GENRES.find((x) => x.id === g.reel.genreId)!;
export const criticOf = (g: Game): Critic => CRITICS.find((x) => x.id === g.reel.criticId)!;

export const slotsLeft = (rs: ReelStudio) => RULES.castSize - rs.cast.length;
/** Most a studio can bid and still keep $1M for every other empty slot. */
export const maxBid = (rs: ReelStudio) => (slotsLeft(rs) === 0 ? 0 : rs.budget - (slotsLeft(rs) - 1) * RULES.minBid);
export const spent = (rs: ReelStudio) => RULES.startingBudget - rs.budget;
export const castingClosed = (g: Game) => Object.values(g.reel.studios).every((rs) => slotsLeft(rs) === 0);
export const humansFull = (g: Game) => humans(g).every((s) => slotsLeft(g.reel.studios[s.id]) === 0);
export const minNextBid = (lot: Lot | null) => (lot?.high ? lot.high.amount + 1 : RULES.minBid);
export const legendsLeft = (g: Game) => g.reel.legacySlots.filter((n) => n > g.reel.drawCount).length;

/* ------------------------------------------------------------------ */
/*  New games and reels                                                */
/* ------------------------------------------------------------------ */

export interface NewHuman {
  name: string;
  colour: string;
}

export function newGame(opts: { mode: Mode; seed: string; humans: NewHuman[]; dateKey?: string; puzzle?: number; id?: string }): Game {
  const people: Studio[] = opts.humans.map((h, i) => ({ id: `p${i + 1}`, name: h.name.trim() || `Studio ${i + 1}`, colour: h.colour }));
  const houseIds = opts.mode === 'two' ? ['autoplay'] : ['autoplay', 'b48', 'tlc'];
  const houses: Studio[] = houseIds.map((id) => {
    const h = HOUSES.find((x) => x.id === id)!;
    return { id: h.id, name: h.name, colour: h.colour, house: h.id };
  });
  const studios = [...people, ...houses];
  const zero = Object.fromEntries(studios.map((s) => [s.id, 0]));
  const base: Omit<Game, 'reel'> = {
    id: opts.id ?? `${opts.mode}-${opts.seed}`,
    mode: opts.mode,
    seed: opts.seed,
    puzzle: opts.puzzle,
    dateKey: opts.dateKey,
    totalReels: opts.mode === 'two' ? 3 : 1,
    studios,
    phase: 'commission',
    genresUsed: [],
    points: { ...zero },
    stubs: { ...zero },
    honest: { ...zero },
    films: [],
    results: [],
  };
  return setUpReel(base as Game, 1);
}

function setUpReel(input: Game, number: number): Game {
  const g = clone(input);
  const seed = `${g.seed}:reel${number}`;
  const rng = rngFrom(seed);
  let pool = GENRES.filter((x) => !g.genresUsed.includes(x.id));
  if (pool.length === 0) pool = GENRES;
  const genre = pick(pool, rng);
  const critic = pick(CRITICS, rng);
  const talent = shuffle(TALENT, rng);
  const legacy = shuffle(LEGACY, rng);
  const totalSlots = g.studios.length * RULES.castSize;
  const legendCount = rng() < 0.5 ? 3 : 4;
  // Legends hide at secret draw numbers, never the very first lot, always before casting could close.
  const legacySlots = shuffle(
    Array.from({ length: totalSlots - 1 }, (_, i) => i + 2),
    rng,
  )
    .slice(0, legendCount)
    .sort((a, b) => a - b);
  const nextGender: Gender = 'f'; // girl, boy, girl, boy: always starting with an actress
  g.genresUsed.push(genre.id);
  g.reel = {
    number,
    seed,
    genreId: genre.id,
    criticId: critic.id,
    talent,
    legacy,
    binned: [],
    legacySlots,
    nextGender,
    drawCount: 0,
    lot: null,
    sales: [],
    studios: Object.fromEntries(
      g.studios.map((s) => [s.id, { studioId: s.id, budget: RULES.startingBudget, cast: [], dry: 0, title: '', logline: '' }]),
    ),
    plotGiven: {},
  };
  g.phase = 'commission';
  return g;
}

export function setPhase(input: Game, phase: Phase): Game {
  const g = clone(input);
  g.phase = phase;
  return g;
}

/* ------------------------------------------------------------------ */
/*  The casting auction                                                */
/* ------------------------------------------------------------------ */

/**
 * The most a house studio will pay for a card, before its budget is considered.
 * Flipped at random from a spread, so no single price is ever a safe winning bid.
 */
export function houseCeiling(h: HouseRules, card: Card, rng: () => number, genre?: Genre): number {
  // When the genre is public, rivals chase what it wants as well as their own favourites.
  const matches = card.traits.filter((t) => h.likes.includes(t) || genre?.wants.includes(t)).length;
  const c = h.ceiling;
  if (card.deck === 'legacy' && h.likesLegends && c.legend) return pick(c.legend, rng);
  const row = c.byMatches[Math.min(matches, c.byMatches.length - 1)];
  const base = pick(row, rng);
  const legend = base > 0 && card.deck === 'legacy' ? h.legendBonus : 0;
  return base + legend + (card.oscar ? RULES.oscarClout : 0); // everyone pays up for an Oscar winner
}

/** The next vault legend of the gender that's due, so the alternation never breaks. */
function takeLegacy(r: Reel): Card {
  let i = r.legacy.findIndex((c) => c.gender === r.nextGender);
  if (i < 0) i = 0;
  const [card] = r.legacy.splice(i, 1);
  r.nextGender = card.gender === 'f' ? 'm' : 'f';
  return card;
}

function takeTalent(r: Reel): Card {
  if (r.talent.length === 0) {
    // The deck ran dry: shuffle the binned stars back in. Seeded, so still the same for everyone.
    const back = r.binned.filter((c) => c.deck === 'talent');
    r.binned = r.binned.filter((c) => c.deck !== 'talent');
    r.talent = shuffle(back, rngFrom(`${r.seed}:refill:${r.drawCount}`));
    if (r.talent.length === 0) throw new RuleError('The talent deck is empty.');
  }
  let i = r.talent.findIndex((c) => c.gender === r.nextGender);
  if (i < 0) i = 0;
  const [card] = r.talent.splice(i, 1);
  r.nextGender = card.gender === 'f' ? 'm' : 'f';
  return card;
}

export function drawLot(input: Game): Game {
  if (input.phase !== 'auction') throw new RuleError('Casting is not open.');
  if (input.reel.lot) throw new RuleError('There is already a star on the table.');
  if (castingClosed(input)) throw new RuleError('Casting is closed.');
  const g = clone(input);
  const r = g.reel;
  const drawNo = r.drawCount + 1;
  const card = r.legacySlots.includes(drawNo) && r.legacy.length ? takeLegacy(r) : takeTalent(r);
  r.drawCount = drawNo;
  const ceilings: Record<string, number> = {};
  for (const s of g.studios) {
    const h = houseFor(s);
    const rs = r.studios[s.id];
    if (!h || slotsLeft(rs) === 0) continue;
    let ceiling = houseCeiling(h, card, rngFrom(`${r.seed}:lot${drawNo}:${h.id}`), genreKnown(g) ? genreOf(g) : undefined);
    if (rs.dry >= RULES.lastOrders) ceiling = Math.max(ceiling, RULES.minBid); // last orders
    ceilings[s.id] = ceiling;
  }
  r.lot = { card, drawNo, high: null, bids: [], ceilings };
  return g;
}

export function bidProblem(g: Game, studioId: string, amount: number): string | null {
  const lot = g.reel.lot;
  if (g.phase !== 'auction' || !lot) return 'Nothing is up for auction.';
  const rs = g.reel.studios[studioId];
  const name = studioById(g, studioId).name;
  if (slotsLeft(rs) === 0) return `${name} already has five stars.`;
  if (lot.high?.studioId === studioId) return `${name} is already the top bid.`;
  if (amount < minNextBid(lot)) return `The bid must be at least $${minNextBid(lot)}M.`;
  if (amount > maxBid(rs)) return `${name} can bid at most $${maxBid(rs)}M (it must keep $1M for each empty slot).`;
  return null;
}

export function placeBid(input: Game, studioId: string, amount: number): Game {
  const problem = bidProblem(input, studioId, amount);
  if (problem) throw new RuleError(problem);
  const g = clone(input);
  const bid = { studioId, amount };
  g.reel.lot!.high = bid;
  g.reel.lot!.bids.push(bid);
  return g;
}

/**
 * Which house studio raises next, and to what. Deterministic: the house prepared to go highest moves first,
 * ties go by seating order. Null when no house wants to raise.
 */
export function nextHouseBid(g: Game): { studioId: string; amount: number } | null {
  const lot = g.reel.lot;
  if (g.phase !== 'auction' || !lot) return null;
  const need = minNextBid(lot);
  let best: { studioId: string; amount: number; limit: number } | null = null;
  // Neck and neck: a rival never gets more than two stars ahead of the slowest human.
  const slowest = Math.min(...humans(g).map((s) => g.reel.studios[s.id].cast.length));
  for (const s of g.studios) {
    if (!s.house || lot.high?.studioId === s.id) continue;
    const rs = g.reel.studios[s.id];
    if (rs.cast.length >= slowest + RULES.rivalLead) continue;
    const h = houseFor(s)!;
    const paced = Math.max(RULES.minBid, Math.floor((h.pace * rs.budget) / Math.max(1, slotsLeft(rs))));
    const limit = Math.min(lot.ceilings[s.id] ?? 0, maxBid(rs), paced);
    if (limit >= need && (!best || limit > best.limit)) best = { studioId: s.id, amount: need, limit };
  }
  return best ? { studioId: best.studioId, amount: best.amount } : null;
}

/** The hammer falls: the top bid buys the star, or it goes in the bin. */
export function closeLot(input: Game): Game {
  const lot = input.reel.lot;
  if (!lot) throw new RuleError('Nothing is up for auction.');
  const g = clone(input);
  const r = g.reel;
  const buyer = lot.high?.studioId ?? null;
  for (const rs of Object.values(r.studios)) {
    if (rs.studioId === buyer) rs.dry = 0;
    else if (slotsLeft(rs) > 0) rs.dry += 1;
  }
  if (buyer) {
    const rs = r.studios[buyer];
    rs.cast.push({ card: lot.card, price: lot.high!.amount });
    rs.budget -= lot.high!.amount;
  } else {
    r.binned.push(lot.card);
  }
  r.sales.push({ card: lot.card, studioId: buyer, price: lot.high?.amount ?? 0 });
  r.lot = null;
  if (castingClosed(g)) g.phase = 'reveal';
  return g;
}

/** Plays a lot out with only the house studios bidding. */
export function settleLotWithHouses(input: Game): Game {
  let g = input.reel.lot ? input : drawLot(input);
  for (let guard = 0; guard < 200; guard++) {
    const move = nextHouseBid(g);
    if (!move) break;
    g = placeBid(g, move.studioId, move.amount);
  }
  return closeLot(g);
}

/** Once every human has five stars, the house studios finish casting on their own. */
export function fastForward(input: Game): Game {
  if (!humansFull(input)) throw new RuleError('You still have empty slots to fill.');
  let g = input;
  for (let guard = 0; guard < 600 && g.phase === 'auction'; guard++) g = settleLotWithHouses(g);
  if (g.phase === 'auction') throw new Error('House studios could not finish casting.');
  return g;
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

export interface Line {
  text: string;
  pts: number;
}

export function fitOf(card: Card, genre: Genre): Line[] {
  const out: Line[] = [];
  if (card.oscar) out.push({ text: `Oscar winner: ${card.name}`, pts: RULES.oscarClout });
  for (const t of card.traits) {
    if (genre.wants.includes(t)) out.push({ text: `${t}: ${card.name}`, pts: 2 });
    else if (genre.bonus === t) out.push({ text: `${t}: ${card.name}`, pts: 1 });
    else if (genre.clash === t) out.push({ text: `${t}: ${card.name}`, pts: -1 });
  }
  return out;
}

export function castingStamps(fit: number): number {
  if (fit >= 17) return 5;
  if (fit >= 14) return 4;
  if (fit >= 10) return 3;
  if (fit >= 7) return 2;
  if (fit >= 4) return 1;
  return 0;
}

export function budgetStamps(spentM: number): number {
  if (spentM <= 12) return 5;
  if (spentM <= 14) return 4;
  if (spentM <= 16) return 3;
  if (spentM <= 18) return 2;
  if (spentM <= 19) return 1;
  return 0;
}

const clampStamps = (n: number) => Math.max(0, Math.min(RULES.stamps, n));

/**
 * The Plot: cast your five stars into the genre's five roles, one star per role.
 * Each role played by a star with the right trait earns a stamp. Finds the best possible casting.
 */
export function rolesVerdict(g: Game, studioId: string): { stamps: number; lines: Line[]; parts: { role: string; trait: string; star: string | null }[] } {
  const genre = genreOf(g);
  const cast = g.reel.studios[studioId].cast.map((m) => m.card);
  const fits = (star: Card | undefined, role: RoleKey) => !!star && star.traits.includes(genre.roles[role]);
  let best: number[] = [];
  let bestScore = -1;
  const idx = cast.map((_, i) => i);
  const permute = (left: number[], chosen: number[]) => {
    if (bestScore === ROLES.length) return;
    if (chosen.length === ROLES.length || left.length === 0) {
      const score = chosen.reduce((a, ci, ri) => a + (fits(cast[ci], ROLES[ri].key) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = chosen;
      }
      return;
    }
    for (const i of left) permute(left.filter((x) => x !== i), [...chosen, i]);
  };
  permute(idx, []);
  const parts = ROLES.map((r, ri) => {
    const star = cast[best[ri]];
    return { role: r.label, trait: genre.roles[r.key], star: fits(star, r.key) ? star!.name : null };
  });
  const lines = parts.map((p) => ({ text: p.star ? `${p.role}: ${p.star} (${p.trait})` : `${p.role}: nobody with ${p.trait}`, pts: p.star ? 1 : 0 }));
  return { stamps: Math.max(0, bestScore), lines, parts };
}

/** The critic is flavour now: a rave for a strong film, a pan for a weak one. */
export function criticLine(g: Game, total: number): string {
  const c = criticOf(g);
  return total >= 10 ? c.review : c.pan;
}

export interface Scorecard {
  casting: number;
  budget: number;
  plot: number;
  total: number;
  fit: number;
  fitLines: Line[];
  plotLines: Line[];
  plotByPlayer: boolean;
  quote: string;
  spent: number;
}

export function scorecard(g: Game, studioId: string): Scorecard {
  const genre = genreOf(g);
  const rs = g.reel.studios[studioId];
  const fitLines = rs.cast.flatMap((m) => fitOf(m.card, genre));
  const fit = fitLines.reduce((a, l) => a + l.pts, 0);
  const verdict = rolesVerdict(g, studioId);
  const byPlayer = g.mode === 'two' && isHuman(studioById(g, studioId)) && g.reel.plotGiven[studioId] !== undefined;
  const plot = byPlayer ? clampStamps(g.reel.plotGiven[studioId]) : verdict.stamps;
  const casting = castingStamps(fit);
  const budget = budgetStamps(spent(rs));
  const quote = criticLine(g, casting + budget + plot);
  return {
    casting,
    budget,
    plot,
    total: casting + budget + plot,
    fit,
    fitLines,
    plotLines: verdict.lines,
    plotByPlayer: byPlayer,
    quote,
    spent: spent(rs),
  };
}

/** Best total wins; ties go to the better casting fit, then the smaller spend, then seating order. */
export function reelRanking(g: Game): { studio: Studio; card: Scorecard }[] {
  return g.studios
    .map((studio, seat) => ({ studio, card: scorecard(g, studio.id), seat }))
    .sort((a, b) => b.card.total - a.card.total || b.card.fit - a.card.fit || a.card.spent - b.card.spent || a.seat - b.seat)
    .map(({ studio, card }) => ({ studio, card }));
}

/* ------------------------------------------------------------------ */
/*  Titles, Two-Hander plot scores, the Oscar                          */
/* ------------------------------------------------------------------ */

export function setTitle(input: Game, studioId: string, title: string, logline = ''): Game {
  const g = clone(input);
  g.reel.studios[studioId].title = title.slice(0, 60);
  g.reel.studios[studioId].logline = logline.slice(0, 120);
  return g;
}

export const filmTitle = (g: Game, studioId: string) => g.reel.studios[studioId].title.trim() || `Untitled ${genreOf(g).name}`;

/** Two-Hander: the other player's secret Plot stamps for this studio's film. */
export function givePlot(input: Game, studioId: string, stamps: number): Game {
  if (input.mode !== 'two') throw new RuleError('Plot is scored by the critic in this mode.');
  const g = clone(input);
  g.reel.plotGiven[studioId] = clampStamps(Math.round(stamps));
  return g;
}

/** The other human in a Two-Hander. */
export const rivalOf = (g: Game, studioId: string) => humans(g).find((s) => s.id !== studioId)!;

/**
 * Close the reel: bank stamps as points, award the greenlight stub, archive each human's film,
 * and (Two-Hander) pay the Honest Critic bonus. Then the Oscar.
 */
export function finishReel(input: Game): Game {
  if (input.mode === 'two' && humans(input).some((s) => input.reel.plotGiven[s.id] === undefined)) {
    throw new RuleError('Both players need to score the other film first.');
  }
  const g = clone(input);
  const ranking = reelRanking(g);
  const winner = ranking[0].studio;
  const totals: Record<string, number> = {};
  for (const { studio, card } of ranking) {
    totals[studio.id] = card.total;
    g.points[studio.id] += card.total;
  }
  if (g.mode === 'two') {
    for (const s of humans(g)) {
      const given = g.reel.plotGiven[s.id];
      const fair = rolesVerdict(g, s.id).stamps;
      const judge = rivalOf(g, s.id);
      if (Math.abs(given - fair) <= 1) {
        g.honest[judge.id] += 1;
        g.points[judge.id] += 1;
      }
    }
  }
  g.stubs[winner.id] += 1;
  const genre = genreOf(g);
  for (const s of humans(g)) {
    const rs = g.reel.studios[s.id];
    const card = scorecard(g, s.id);
    const film: Film = {
      id: `${g.id}:r${g.reel.number}:${s.id}`,
      gameId: g.id,
      date: Date.now(),
      mode: g.mode,
      puzzle: g.puzzle,
      reel: g.reel.number,
      studioName: s.name,
      studioColour: s.colour,
      title: filmTitle(g, s.id),
      logline: rs.logline,
      genre: genre.name,
      critic: criticOf(g).name,
      cast: rs.cast.map((m) => ({ name: m.card.name, legacy: m.card.deck === 'legacy', price: m.price })),
      stamps: { casting: card.casting, budget: card.budget, plot: card.plot },
    };
    g.films.push(film);
  }
  g.results.push({ reel: g.reel.number, genre: genre.name, critic: criticOf(g).name, winnerId: winner.id, totals });
  g.phase = 'oscar';
  return g;
}

export const isLastReel = (g: Game) => g.reel.number >= g.totalReels;

/** Two-Hander standings: points, then greenlight stubs. */
export function matchLeader(g: Game): { leader: Studio | null; tied: boolean } {
  const hs = humans(g);
  const [a, b] = hs;
  if (!b) return { leader: a, tied: false };
  const diff = g.points[a.id] - g.points[b.id] || g.stubs[a.id] - g.stubs[b.id];
  if (diff === 0) return { leader: null, tied: true };
  return { leader: diff > 0 ? a : b, tied: false };
}

/** After the result screen: the next reel, a sudden-death reel, or the final credits. */
export function nextReel(input: Game): Game {
  if (!isLastReel(input)) return setUpReel(input, input.reel.number + 1);
  if (input.mode === 'two' && matchLeader(input).tied) {
    const g = clone(input);
    g.totalReels += 1;
    return setUpReel(g, g.reel.number + 1);
  }
  return setPhase(input, 'final');
}

/* ------------------------------------------------------------------ */
/*  Share text                                                         */
/* ------------------------------------------------------------------ */

export function shareText(g: Game, url: string): string {
  const me = humans(g)[0];
  const card = scorecard(g, me.id);
  const bar = (n: number) => '■'.repeat(n) + '□'.repeat(RULES.stamps - n);
  const ranking = reelRanking(g);
  const beat = ranking.slice(ranking.findIndex((r) => r.studio.id === me.id) + 1).map((r) => r.studio.name);
  const verdict =
    ranking[0].studio.id === me.id ? 'Took the Oscar' : beat.length ? `Beat ${beat.join(' & ')}` : 'Bottom of the bill';
  const head = g.mode === 'dailies' ? `GREENLIT (B-MOVIE) · DAILIES #${g.puzzle}` : 'GREENLIT (B-MOVIE) · FREE PLAY';
  return [
    head,
    `CASTING  ${bar(card.casting)}`,
    `BUDGET   ${bar(card.budget)}`,
    `PLOT     ${bar(card.plot)}`,
    `${card.total}/15 · ${verdict}`,
    `play: ${url}`,
  ].join('\n');
}
