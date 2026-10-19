import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRITICS,
  GENRES,
  LEGACY,
  RULES,
  TALENT,
  budgetStamps,
  castingStamps,
  closeLot,
  criticVerdict,
  dailySeed,
  drawLot,
  fastForward,
  finishReel,
  givePlot,
  humans,
  humansFull,
  maxBid,
  newGame,
  nextHouseBid,
  nextReel,
  placeBid,
  puzzleNumber,
  scorecard,
  setPhase,
  slotsLeft,
} from './engine';
import traits from '../data/traits.json';
import type { Game } from './types';

const solo = (seed = 'test-seed') =>
  setPhase(newGame({ mode: 'dailies', seed, humans: [{ name: 'Me', colour: 'darlington' }] }), 'auction');

/** A scripted human: bids the minimum on every lot while it has room, then lets the houses finish. */
function playScripted(start: Game, strategy: (g: Game) => number | null = () => 1): Game {
  let g = start;
  for (let guard = 0; guard < 2000 && g.phase === 'auction'; guard++) {
    if (humansFull(g)) {
      g = fastForward(g);
      break;
    }
    g = drawLot(g);
    const want = strategy(g);
    if (want !== null) {
      try {
        g = placeBid(g, 'p1', want);
      } catch {
        /* couldn't afford it: sit this one out */
      }
    }
    for (let i = 0; i < 300; i++) {
      const move = nextHouseBid(g);
      if (!move) break;
      g = placeBid(g, move.studioId, move.amount);
    }
    g = closeLot(g);
  }
  return g;
}

/** Checks the money and slot rules hold for every studio after every sale. */
function assertLegal(g: Game) {
  for (const rs of Object.values(g.reel.studios)) {
    assert.ok(rs.cast.length <= RULES.castSize);
    assert.ok(rs.budget >= slotsLeft(rs), `${rs.studioId} broke the reserve rule`);
    assert.equal(rs.budget, RULES.startingBudget - rs.cast.reduce((a, m) => a + m.price, 0));
  }
}

test('decks are well formed: 172 stars, 94 legends, known traits only', () => {
  assert.equal(TALENT.length, 172);
  assert.equal(LEGACY.length, 94);
  const known = new Set(traits.traits);
  for (const c of TALENT) assert.equal(c.traits.length, 2, c.name);
  for (const c of LEGACY) assert.equal(c.traits.length, 3, c.name);
  for (const c of [...TALENT, ...LEGACY]) for (const t of c.traits) assert.ok(known.has(t), `${c.name}: ${t}`);
  for (const gnr of GENRES) for (const t of [...gnr.wants, gnr.bonus, gnr.clash]) assert.ok(known.has(t), `${gnr.name}: ${t}`);
  assert.equal(GENRES.length, 24);
  assert.equal(CRITICS.length, 20);
  assert.equal(new Set([...TALENT, ...LEGACY].map((c) => c.id)).size, 266);
});

test('the same seed always plays the same reel', () => {
  const a = playScripted(solo('same'));
  const b = playScripted(solo('same'));
  assert.deepEqual(a.reel.sales, b.reel.sales);
  assert.equal(a.reel.genreId, b.reel.genreId);
  assert.equal(a.reel.criticId, b.reel.criticId);
  const c = playScripted(solo('different'));
  assert.notDeepEqual(
    a.reel.sales.map((s) => s.card.id),
    c.reel.sales.map((s) => s.card.id),
  );
});

test('Dailies seed and puzzle number come from the UTC date', () => {
  assert.equal(puzzleNumber('2026-10-19'), 1);
  assert.equal(puzzleNumber('2026-10-30'), 12);
  const a = newGame({ mode: 'dailies', seed: dailySeed('2026-11-01'), humans: [{ name: 'A', colour: 'beeswax' }] });
  const b = newGame({ mode: 'dailies', seed: dailySeed('2026-11-01'), humans: [{ name: 'B', colour: 'latte' }] });
  assert.deepEqual(a.reel.talent.map((c) => c.id), b.reel.talent.map((c) => c.id));
  assert.equal(a.reel.genreId, b.reel.genreId);
});

test('full solo reels finish legally across many seeds', () => {
  for (let i = 0; i < 60; i++) {
    const g = playScripted(solo(`seed-${i}`), (x) => (x.reel.lot!.card.deck === 'legacy' ? 6 : 1));
    assert.equal(g.phase, 'reveal');
    assertLegal(g);
    for (const rs of Object.values(g.reel.studios)) assert.equal(rs.cast.length, 5);
  }
});

test('house studios never break the budget rules, even when the human bids nothing', () => {
  let g = solo('houses-only');
  for (let guard = 0; guard < 400 && Object.values(g.reel.studios).some((rs) => rs.studioId !== 'p1' && slotsLeft(rs) > 0); guard++) {
    g = drawLot(g);
    for (let i = 0; i < 300; i++) {
      const move = nextHouseBid(g);
      if (!move) break;
      assert.ok(move.amount <= maxBid(g.reel.studios[move.studioId]));
      g = placeBid(g, move.studioId, move.amount);
    }
    g = closeLot(g);
    assertLegal(g);
  }
  for (const id of ['autoplay', 'b48', 'tlc']) assert.equal(g.reel.studios[id].cast.length, 5, id);
});

test('the reserve rule: you must keep $1M for each empty slot', () => {
  let g = drawLot(solo('reserve'));
  assert.throws(() => placeBid(g, 'p1', 17), /at most \$16M/);
  g = placeBid(g, 'p1', 16);
  assert.equal(g.reel.lot!.high!.amount, 16);
});

test('talent draws alternate actress and actor', () => {
  const g = playScripted(solo('alternate'));
  const talent = g.reel.sales.filter((s) => s.card.deck === 'talent').map((s) => s.card.gender);
  for (let i = 1; i < talent.length; i++) assert.notEqual(talent[i], talent[i - 1], `draw ${i}`);
});

test('one or two vault legends surface every reel', () => {
  for (let i = 0; i < 30; i++) {
    const g = playScripted(solo(`legend-${i}`));
    const n = g.reel.sales.filter((s) => s.card.deck === 'legacy').length;
    assert.ok(n >= 1 && n <= 2, `seed ${i}: ${n} legends`);
  }
});

test('stamp bands', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6, 7, 9, 10, 12, 13, 20].map(castingStamps), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.deepEqual([5, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(budgetStamps), [5, 5, 4, 4, 3, 3, 2, 2, 1, 0]);
});

test('scoring maths add up and stay in range', () => {
  for (let i = 0; i < 40; i++) {
    const g = playScripted(solo(`score-${i}`), () => 2);
    for (const s of g.studios) {
      const c = scorecard(g, s.id);
      for (const v of [c.casting, c.budget, c.plot]) assert.ok(v >= 0 && v <= 5);
      assert.equal(c.total, c.casting + c.budget + c.plot);
      assert.equal(c.fit, c.fitLines.reduce((a, l) => a + l.pts, 0));
      assert.equal(c.casting, castingStamps(c.fit));
      const v = criticVerdict(g, s.id);
      assert.equal(v.stamps, Math.max(0, Math.min(5, v.lines.reduce((a, l) => a + l.pts, 0))));
    }
  }
});

test('a solo reel banks points and archives one film', () => {
  let g = playScripted(solo('bank'));
  g = finishReel(g);
  assert.equal(g.phase, 'oscar');
  assert.equal(g.films.length, 1);
  assert.equal(g.points.p1, scorecard(g, 'p1').total);
  g = nextReel(setPhase(g, 'result'));
  assert.equal(g.phase, 'final');
});

test('Two-Hander: three reels, honest critic bonus, never the same genre twice', () => {
  let g = newGame({
    mode: 'two',
    seed: 'pair',
    humans: [
      { name: 'Ann', colour: 'darlington' },
      { name: 'Bo', colour: 'beeswax' },
    ],
  });
  assert.deepEqual(
    g.studios.map((s) => s.id),
    ['p1', 'p2', 'autoplay'],
  );
  const genres: string[] = [];
  for (let reel = 1; reel <= 3; reel++) {
    g = setPhase(g, 'auction');
    let guard = 0;
    while (g.phase === 'auction' && guard++ < 2000) {
      if (humansFull(g)) {
        g = fastForward(g);
        break;
      }
      g = drawLot(g);
      for (const p of humans(g)) {
        try {
          g = placeBid(g, p.id, g.reel.lot!.high ? g.reel.lot!.high.amount + 1 : 1);
        } catch {
          /* sit out */
        }
      }
      for (let i = 0; i < 300; i++) {
        const move = nextHouseBid(g);
        if (!move) break;
        g = placeBid(g, move.studioId, move.amount);
      }
      g = closeLot(g);
    }
    assertLegal(g);
    genres.push(g.reel.genreId);
    assert.throws(() => finishReel(g), /score the other film/);
    const fair = criticVerdict(g, 'p2').stamps;
    g = givePlot(g, 'p2', fair); // Ann is honest about Bo's film
    g = givePlot(g, 'p1', 0); // Bo low-balls Ann
    const before = { ...g.honest };
    g = finishReel(g);
    assert.equal(g.honest.p1, before.p1 + 1);
    if (criticVerdict(g, 'p1').stamps > 1) assert.equal(g.honest.p2, before.p2);
    g = nextReel(setPhase(g, 'result'));
    if (reel < 3) assert.equal(g.phase, 'commission');
  }
  assert.equal(new Set(genres).size, 3);
  assert.ok(g.phase === 'final' || g.totalReels === 4);
});
