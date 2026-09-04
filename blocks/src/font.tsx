import type {Settings} from '@unigrid/core';

// the one serif on offer. a stack rather than a name, so a blocked or slow
// stylesheet degrades to something with the same shape rather than to sans.
export const DISPLAY_SERIF =
  "'Instrument Serif', Georgia, 'Times New Roman', serif";

const HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap';

// rendered only when the theme asks for it, so a sans page fetches nothing.
// react 18 leaves it where it is, which browsers honour — the alternative is a
// static links() that cannot see the theme.
export function ThemeFont({settings}: {settings?: Settings}) {
  if (settings?.headingFont !== 'serif') return null;
  return <link rel="stylesheet" href={HREF} />;
}
