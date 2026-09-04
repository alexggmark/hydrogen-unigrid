// the theme's numbers. every one is a multiple of --u rather than a length,
// because --u is what makes a band one composition at any width — a fixed unit
// in the grid layer would stop the page zooming and start it reflowing.
//
// at the grid's max width 1u is exactly 1rem (--grid-max is 100rem, --u is
// 1cqw), so these read as rem at the design size and scale down from there.
export type Metrics = {
  // page boundaries. rem and vw on purpose: a boundary is not composition, and
  // this is the one exception the grid layer already made for itself.
  pageMax: number;
  pageMargin: number;

  gutterX: number;
  gutterY: number;

  blockPadX: number;
  blockPadY: number;
  // band c only. 1u is 1% of the grid whatever the screen, so padding that
  // reads as generous on a desktop is a few px on a phone.
  blockPadXNarrow: number;
  blockPadYNarrow: number;
  blockRadius: number;

  buttonPadX: number;
  buttonPadY: number;
  buttonRadius: number;
};

// exactly what the stylesheet did before any of this existed, so an untouched
// theme renders identically rather than approximately
export const DEFAULT_METRICS: Metrics = {
  pageMax: 100,
  pageMargin: 6,
  gutterX: 1.5,
  gutterY: 1.5,
  blockPadX: 1,
  blockPadY: 1,
  blockPadXNarrow: 1,
  blockPadYNarrow: 1,
  blockRadius: 0,
  buttonPadX: 1.4,
  buttonPadY: 0.7,
  buttonRadius: 0,
};

// what each control may hold: [min, max, step]. the editor builds its sliders
// from this, so a bound lives in one place rather than in the ui.
export const METRIC_RANGE: Record<keyof Metrics, [number, number, number]> = {
  pageMax: [60, 140, 2],
  pageMargin: [0, 12, 0.5],
  gutterX: [0, 4, 0.1],
  gutterY: [0, 4, 0.1],
  blockPadX: [0, 6, 0.2],
  blockPadY: [0, 6, 0.2],
  blockPadXNarrow: [0, 6, 0.2],
  blockPadYNarrow: [0, 6, 0.2],
  blockRadius: [0, 3, 0.2],
  buttonPadX: [0, 4, 0.2],
  buttonPadY: [0, 4, 0.2],
  buttonRadius: [0, 2, 0.2],
};

export const METRIC_KEYS = Object.keys(METRIC_RANGE) as (keyof Metrics)[];

const clamp = (value: number, [min, max]: [number, number, number]): number =>
  Math.min(max, Math.max(min, value));

// unknown in, valid Metrics out. a stored theme is merged onto the defaults, so
// a knob added later is simply absent in an older entry rather than fatal.
export function metricsFrom(value: unknown): Metrics {
  const out = {...DEFAULT_METRICS};
  if (!value || typeof value !== 'object') return out;
  const raw = value as Record<string, unknown>;
  for (const key of METRIC_KEYS) {
    const n = raw[key];
    if (typeof n === 'number' && Number.isFinite(n)) {
      out[key] = clamp(n, METRIC_RANGE[key]);
    }
  }
  return out;
}

// only what differs from the default is worth storing, for the same reason the
// layout wire drops defaults
export function metricsDiff(metrics: Metrics): Partial<Metrics> {
  const out: Partial<Metrics> = {};
  for (const key of METRIC_KEYS) {
    if (metrics[key] !== DEFAULT_METRICS[key]) out[key] = metrics[key];
  }
  return out;
}
