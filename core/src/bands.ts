export const BANDS = ['a', 'b', 'c'] as const;

export type Band = (typeof BANDS)[number];

// column count per band. band a is the widest and is always authoritative.
export const COLUMNS: Record<Band, number> = {a: 12, b: 8, c: 4};

export const WIDEST: Band = 'a';

export function isBand(value: unknown): value is Band {
  return BANDS.includes(value as Band);
}
