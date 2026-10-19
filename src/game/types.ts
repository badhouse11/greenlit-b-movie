export type Gender = 'f' | 'm';
export type DeckKind = 'talent' | 'legacy';
export type Mode = 'dailies' | 'free' | 'two';

export interface StarCard {
  id: string;
  name: string;
  gender: Gender;
  traits: string[];
  oscar?: boolean; // won a competitive Academy Award: always on show, +2 Casting
}

export interface Card extends StarCard {
  deck: DeckKind;
}

export type RoleKey = 'protagonist' | 'antagonist' | 'loveInterest' | 'supporting' | 'lightRelief';

export interface Genre {
  id: string;
  name: string;
  wants: string[];
  bonus: string;
  clash: string;
  /** The Plot: each role wants one trait, and each star can play one role. */
  roles: Record<RoleKey, string>;
}

export type CriticEffect =
  | { kind: 'perLegend'; pts: number }
  | { kind: 'noLegend'; pts: number }
  | { kind: 'anyPriceAtLeast'; price: number; pts: number }
  | { kind: 'allPriceAtMost'; price: number; pts: number }
  | { kind: 'allPriceBetween'; min: number; max: number; pts: number }
  | { kind: 'sharedTrait'; count: number; pts: number }
  | { kind: 'perTrait'; trait: string; pts: number }
  | { kind: 'perPrice'; price: number; pts: number }
  | { kind: 'variety'; over: number; pts: number }
  | { kind: 'noClash'; pts: number }
  | { kind: 'perClash'; pts: number }
  | { kind: 'perWant'; pts: number }
  | { kind: 'flat'; pts: number }
  | { kind: 'spentLeast'; pts: number };

export interface Critic {
  id: string;
  name: string;
  paper: string;
  taste: string;
  rule: string;
  review: string;
  pan: string;
  effects: CriticEffect[];
}

/** Ceiling options by how many favourite traits the star has (0, 1, 2, 3); one is flipped at random per lot. */
export interface HouseCeiling {
  kind: 'pick';
  byMatches: number[][];
  legend?: number[];
}

export interface HouseRules {
  id: string;
  name: string;
  colour: string;
  blurb: string;
  likes: string[];
  likesLegends?: boolean;
  pace: number; // never bids more than pace × (budget left ÷ empty slots)
  ceiling: HouseCeiling;
  legendBonus: number;
}

export interface Studio {
  id: string;
  name: string;
  colour: string;
  house?: string; // HouseRules id when the app bids for this studio
}

export interface CastMember {
  card: Card;
  price: number;
}

export interface ReelStudio {
  studioId: string;
  budget: number;
  cast: CastMember[];
  dry: number; // lots in a row this studio has missed (drives "last orders")
  title: string;
  logline: string;
}

export interface Bid {
  studioId: string;
  amount: number;
}

export interface Lot {
  card: Card;
  drawNo: number;
  high: Bid | null;
  bids: Bid[];
  ceilings: Record<string, number>; // house studio id -> most it will pay for this lot
}

export interface Sale {
  card: Card;
  studioId: string | null; // null = binned
  price: number;
}

export interface Reel {
  number: number;
  seed: string;
  genreId: string;
  criticId: string;
  talent: Card[]; // draw piles, top = index 0
  legacy: Card[];
  binned: Card[];
  legacySlots: number[]; // draw numbers where a vault legend surfaces
  nextGender: Gender;
  drawCount: number;
  lot: Lot | null;
  sales: Sale[];
  studios: Record<string, ReelStudio>;
  /** Two-Hander only: plot stamps given by the other player, keyed by the studio being scored. */
  plotGiven: Record<string, number>;
}

export type Phase = 'commission' | 'auction' | 'reveal' | 'critic' | 'title' | 'pitch' | 'scoring' | 'oscar' | 'result' | 'final';

export interface Film {
  id: string;
  gameId: string;
  date: number;
  mode: Mode;
  puzzle?: number;
  reel: number;
  studioName: string;
  studioColour: string;
  title: string;
  logline: string;
  genre: string;
  critic: string;
  cast: { name: string; legacy: boolean; price: number }[];
  stamps: { casting: number; budget: number; plot: number };
}

export interface Game {
  id: string;
  mode: Mode;
  seed: string;
  puzzle?: number; // Dailies number
  dateKey?: string; // Dailies UTC date, YYYY-MM-DD
  totalReels: number;
  studios: Studio[];
  reel: Reel;
  phase: Phase;
  genresUsed: string[];
  points: Record<string, number>;
  stubs: Record<string, number>;
  honest: Record<string, number>; // Two-Hander Honest Critic bonus points
  films: Film[];
  results: ReelResult[];
}

export interface ReelResult {
  reel: number;
  genre: string;
  critic: string;
  winnerId: string;
  totals: Record<string, number>;
}
