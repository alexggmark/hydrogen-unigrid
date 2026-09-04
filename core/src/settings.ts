import {SLOTS, type Colour, type Slot} from './types';

// the theme's non-numeric settings. one json field beside metrics, so a setting
// added later needs no metaobject definition change — the same reason the
// numbers went in one.
export type Settings = {
  // a MediaImage gid. the route resolves it, exactly as it does a block's fill.
  logo?: string;
  // a slot or a literal, the same shape a block fill uses, so the palette stays
  // reachable: change a slot and every page using it moves.
  background?: Colour;
};

const colourFrom = (value: unknown): Colour | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (SLOTS.includes(raw.slot as Slot)) return {slot: raw.slot as Slot};
  if (typeof raw.hex === 'string' && /^#[0-9a-f]{6}$/i.test(raw.hex)) {
    return {hex: raw.hex};
  }
  return undefined;
};

export function settingsFrom(value: unknown): Settings {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const background = colourFrom(raw.background);
  return {
    ...(typeof raw.logo === 'string' && raw.logo ? {logo: raw.logo} : {}),
    ...(background ? {background} : {}),
  };
}
