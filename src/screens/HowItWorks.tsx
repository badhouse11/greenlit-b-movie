import { GENRES, HOUSES } from '../game/engine';
import { CrossSell, GenreCard, Trait } from '../components/Cards';
import { Ticket } from '../components/Ticket';
import { stock } from '../lib/palette';
import traits from '../data/traits.json';

const STEPS = [
  { head: 'Get your commission', body: 'Today’s genre is on the envelope. Heist, Musical, Film Noir…' },
  { head: 'Cast from instinct', body: 'Bid on five stars with $20M. Their trait stamps are sealed.' },
  { head: 'The premiere', body: 'The traits are revealed against what the genre wants.' },
  { head: 'Punch the card', body: 'Up to 5 stamps each for Casting, Budget and Plot.' },
];

export function HowItWorks({ onBack }: { onBack: () => void }) {
  const example = GENRES.find((g) => g.name === 'Horror') ?? GENRES[0];
  return (
    <main className="page page--narrow bhow">
      <button className="link-btn" onClick={onBack}>
        Back
      </button>
      <div className="t-wide">How it works</div>
      <h1 className="page-title t-ticket">The support feature</h1>
      <p className="lede">You’ve got $20 million and a genre. You need five stars. You have no idea what they’re really made of.</p>

      <ol className="bhow__steps">
        {STEPS.map((s, i) => (
          <li key={s.head}>
            <Ticket serrated bg="#F4E7CE" className="bhow__step">
              <span className="bhow__num t-mono">{i + 1}</span>
              <strong className="t-ticket">{s.head}</strong>
              <span>{s.body}</span>
            </Ticket>
          </li>
        ))}
      </ol>

      <section className="bhow__section">
        <h2 className="t-ticket">The ten traits</h2>
        <p>Living stars carry two. Vault legends carry three, and surface three or four times a reel at hidden moments. In Dailies and Free Play the stamps stay sealed until the premiere, so you’re casting on instinct: who feels right for a Western?</p>
        <div className="bhow__traits">
          {traits.traits.map((t) => (
            <Trait key={t} name={t} />
          ))}
        </div>
      </section>

      <section className="bhow__section">
        <h2 className="t-ticket">The genre card</h2>
        <p>Each of the 24 genres wants two traits (+2 for every star that has one), gives a bonus for one (+1) and clashes with one (−1). That’s your Casting fit score.</p>
        <p>It also has five roles: Protagonist, Antagonist, Love Interest, Supporting Cast and Light Relief. Each role needs a trait, and each star can play one role. That’s your Plot.</p>
        <div className="bhow__genre">
          <GenreCard genre={example} number={1} roles />
        </div>
      </section>

      <section className="bhow__section">
        <h2 className="t-ticket">The auction</h2>
        <ul>
          <li>$20M budget, five stars, $1M minimum bid in $1M steps.</li>
          <li>You must keep $1M for every empty slot, so your top bid is always shown.</li>
          <li>The lot sells 8 seconds after the last bid (15 seconds to open). No bids and it’s binned.</li>
          <li>Draws alternate actress, actor, actress, actor. The stars come up in a fresh random order every game.</li>
          <li>Tap Pass when you’re out. If everyone’s out, the hammer falls sooner.</li>
        </ul>
      </section>

      <section className="bhow__section">
        <h2 className="t-ticket">The rival studios</h2>
        <p>The app bids for them by simple rules. In Dailies and Free Play they know the genre too and chase the stars it wants. In a Two-Hander nobody knows it.</p>
        <div className="bhow__rivals">
          {HOUSES.map((h) => (
            <div key={h.id} className="brival-card" style={{ ['--r-bg' as string]: stock(h.colour).bg, ['--r-ink' as string]: stock(h.colour).ink }}>
              <strong className="t-ticket">{h.name}</strong>
              <span>{h.blurb}</span>
            </div>
          ))}
        </div>
        <p className="muted">Each rival flips a secret price limit for every star, so no bid is ever safe. They pace their money across the reel and never get more than two stars ahead of you. Last orders: a rival that misses three lots in a row bids $1M on the next one, whoever it is.</p>
      </section>

      <section className="bhow__section">
        <h2 className="t-ticket">The stamps</h2>
        <dl className="bhow__ledger">
          <dt>Casting</dt>
          <dd>Fit score 2–3: 1 stamp · 4–6: 2 · 7–9: 3 · 10–12: 4 · 13+: 5</dd>
          <dt>Budget</dt>
          <dd>Spent $12M or less: 5 · $14M: 4 · $16M: 3 · $18M: 2 · $19M: 1 · all $20M: 0</dd>
          <dt>Plot</dt>
          <dd>One stamp for every role played by a star with the right trait, one star per role. The app finds the best way to cast your five.</dd>
        </dl>
        <p>The highest total takes the Oscar. Ties go to the better fit score, then the smaller spend.</p>
      </section>

      <section className="bhow__section">
        <h2 className="t-ticket">Dailies</h2>
        <p>One puzzle a day, the same for everyone in the world: same genre, same stars in the same order, same rivals. One go each. Share your stamps without spoiling anything. A new Dailies drops at midnight UTC.</p>
      </section>

      <section className="bhow__section">
        <h2 className="t-ticket">Two-Hander</h2>
        <p>Two players, one phone lying flat between you, best of three reels. Here the genre stays sealed until casting closes, and the trait stamps are on show. Each of you bids from your own half of the screen against Autoplay+.</p>
        <p>After casting, each of you pitches your film in 60 seconds, and the other scores its Plot in secret. Land within one stamp of the real Roles score and you bank an Honest Critic bonus point. Most points after three reels wins; greenlight stubs break a tie, then a sudden-death reel.</p>
      </section>

      <CrossSell variant="rules" />
    </main>
  );
}
