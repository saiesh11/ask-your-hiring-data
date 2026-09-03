/**
 * Deterministic PRNG so the synthetic dataset is byte-for-byte reproducible on
 * every machine and every CI run. Eval expectations are computed from these
 * fixtures, so any drift here would silently invalidate the quality gate.
 *
 * mulberry32: tiny, well-distributed, zero dependencies.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;

/** Small deterministic random helper built on {@link mulberry32}. */
export class Rng {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Pick one element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) {
      throw new Error("Rng.pick: array is empty or has an undefined slot");
    }
    return item;
  }

  /** True with probability `p` (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** A YYYY-MM-DD date uniformly in [fromISO, toISO], day-granular, inclusive. */
  dateBetween(fromISO: string, toISO: string): string {
    const from = Date.parse(`${fromISO}T00:00:00Z`);
    const to = Date.parse(`${toISO}T00:00:00Z`);
    const spanDays = Math.round((to - from) / DAY_MS);
    const offset = this.int(0, spanDays);
    return new Date(from + offset * DAY_MS).toISOString().slice(0, 10);
  }
}

/** Add `days` to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
