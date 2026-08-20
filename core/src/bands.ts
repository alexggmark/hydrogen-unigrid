export const BANDS = ['a', 'b', 'c'] as const;

export type Band = (typeof BANDS)[number];

export const COLUMNS: Record<Band, number> = {a: 12, b: 8, c: 4};

export const WIDEST: Band = 'a';

// how many blocks a derived band puts side by side. b is a tablet composition,
// c is a stack — the same layout twice would not be worth a second band.
export const TRACKS: Record<Band, number> = {a: 1, b: 2, c: 1};

export function isBand(value: unknown): value is Band {
  return BANDS.includes(value as Band);
}
