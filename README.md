# GREENLIT (B-MOVIE)

The cheap double-bill support feature to [GREENLIT](https://fancy-lily-73a6e5.netlify.app). For 1 to 2 players.

> You've got $20 million. You need five stars. You have absolutely no idea what film you're making.

- **DAILIES**: one puzzle a day, the same for everyone (seeded from the UTC date). One go, a shareable result, a streak.
- **Free Play**: a random seed, unlimited goes, with Undo.
- **TWO-HANDER**: two players, one phone flat on the table, best of three reels against Autoplay+.

No server. Everything runs in the browser and saves to `localStorage`.

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # rules engine tests (node:test via tsx)
npm run build    # production build into dist/
```

## Where things live

| Path | What |
| --- | --- |
| `src/game/engine.ts` | The whole rulebook as pure functions. The UI never changes game state any other way. |
| `src/game/engine.test.ts` | Seed determinism, full simulated reels, reserve rule, gender alternation, house bidders, scoring maths. |
| `src/data/talent.json` | 172 living stars, two traits each. |
| `src/data/legacy.json` | 94 vault legends, three traits each. |
| `src/data/traits.json` | The ten traits. |
| `src/data/genres.json` | 24 genres with `wants`, `bonus` and `clash`. |
| `src/data/critics.json` | 20 critics: taste, rule, review and pan lines, and machine-readable `effects`. |
| `src/data/house.json` | The rival studios: Autoplay+, B48 and TLC Corp. |

The decks are plain JSON: edit them freely. Traits must come from `traits.json` (the tests check).

## Settings (Netlify environment variables)

| Variable | Default | What |
| --- | --- | --- |
| `VITE_GREENLIT_URL` | `https://fancy-lily-73a6e5.netlify.app` | Where the "Play the full GREENLIT" buttons go. |
| `VITE_SHOP_URL` | none | Where the running shop strip links (the printed card edition). |

## Deploy

Netlify builds from `main` using `netlify.toml` (`npm run build`, publish `dist`, Node 22).

This repo borrows look, components and decks from `badhouse11/greenlit` by copying. It never links to or changes that repo.
