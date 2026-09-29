import {
  DEFAULT_PALETTE,
  SLOTS,
  decode,
  encode,
  metricsDiff,
  metricsFrom,
  settingsFrom,
  type Layout,
  type Metrics,
  type Palette,
  type Settings,
} from '@unigrid/core';

// every region by target, not just the one being edited, so a header arranged
// in the playground can become a default too
export type Snapshot = {
  regions: Record<string, Layout>;
  palette: Palette;
  metrics: Partial<Metrics>;
  settings: Settings;
};

// a file, not storage: nothing persists here, and a snapshot is something to
// read, diff and hand back later
export function downloadSnapshot(snapshot: Snapshot, name: string) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// through the wire and back, because decode is what actually checks a layout.
// a region that fails is dropped rather than failing the whole file.
function layoutFrom(value: unknown): Layout | undefined {
  try {
    return decode(encode(value as Layout));
  } catch {
    return undefined;
  }
}

const HEX = /^#[0-9a-f]{6}$/i;

export function readSnapshot(text: string): Snapshot | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const regions: Record<string, Layout> = {};
  if (o.regions && typeof o.regions === 'object') {
    for (const [target, value] of Object.entries(o.regions)) {
      const layout = layoutFrom(value);
      if (layout) regions[target] = layout;
    }
  }
  if (!Object.keys(regions).length) return null;
  const p = (o.palette ?? {}) as Record<string, unknown>;
  const palette = Object.fromEntries(
    SLOTS.map((slot) => {
      const hex = p[slot];
      return [slot, typeof hex === 'string' && HEX.test(hex) ? hex : DEFAULT_PALETTE[slot]];
    }),
  ) as Palette;
  return {
    regions,
    palette,
    metrics: metricsDiff(metricsFrom(o.metrics)),
    settings: settingsFrom(o.settings),
  };
}

const shared = (target: string) => target === 'header' || target === 'footer';

// header and footer by name. the body is whatever else the file holds, so a
// homepage mockup can land on the page open now, whichever template that is.
export function regionFor(
  snapshot: Snapshot,
  target: string,
): Layout | undefined {
  if (snapshot.regions[target]) return snapshot.regions[target];
  if (shared(target)) return undefined;
  return Object.entries(snapshot.regions).find(([t]) => !shared(t))?.[1];
}
