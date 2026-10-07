import type {CSSProperties} from 'react';
import type {LinksFunction} from 'react-router';
import {BUTTON_VARIANTS, METRIC_RANGE, metricsFrom, type ButtonVariant, type Palette} from '@unigrid/core';
import {DISPLAY_SERIF, ThemeFont, metricVars, pageVars} from '@unigrid/blocks';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import specimenStyles from '~/styles/unigrid-styles.css?url';
import snapshot from '~/blocks/playground.json';

// a style sheet in the print sense: the theme's buttons and type on one page.
// built from the grid's own classes, so a change to unigrid.css shows up here.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: specimenStyles},
];

const PALETTE = snapshot.palette as Palette;
const METRICS = metricsFrom(snapshot.metrics);
// the theme's own corner if it has one, else the most the control allows
const ROUND = METRICS.buttonRadius || METRIC_RANGE.buttonRadius[1];

const LABEL: Record<ButtonVariant, string> = {
  primary: 'Primary',
  outline: 'Outline',
  glass: 'Glass',
};

const HEADINGS = [
  {level: 1, token: '--t-h1', u: 5.2, sample: 'Unigrid'},
  {level: 2, token: '--t-h2', u: 3.4, sample: 'Form follows grid'},
  {level: 3, token: '--t-h3', u: 2.4, sample: 'One scalar governs everything'},
] as const;

const SCALE = [
  {name: 'H4', className: 'u-hl u-hl-4', token: '--t-h4', u: 1.7},
  {name: 'H5', className: 'u-hl u-hl-5', token: '--t-h5', u: 1.25},
  {name: 'Large', className: 'u-text-lg', token: '--t-lg', u: 1.7},
  {name: 'Body', className: '', token: '--t-body', u: 1.15},
  {name: 'Micro', className: 'u-micro', token: '--t-micro', u: 0.85},
] as const;

// widths are each band's share of the desktop grid, so the three read as the
// same page at three sizes rather than three diagrams
const BANDS = [
  {name: 'Desktop', cols: 12, bound: 'grid ≥ 60rem', share: 100, gutter: 'var(--gutter-u, 1.5)'},
  {name: 'Tablet', cols: 8, bound: '36–60rem', share: 54, gutter: 'var(--gutter-u, 1.5)'},
  {name: 'Mobile', cols: 4, bound: 'grid < 36rem', share: 26, gutter: 'var(--gutter-narrow-u, 2)'},
] as const;

function Bands() {
  return (
    <div className="sb-bands">
      {BANDS.map((b) => (
        <figure key={b.name} className="sb-band">
          <figcaption className="sb-row-label">
            <span className="u-micro">{b.name}</span>
            <code>
              {b.cols} columns · {b.bound}
            </code>
          </figcaption>
          <div
            className="sb-band-frame"
            style={{inlineSize: `${b.share}%`} as CSSProperties}
          >
            <div
              className="sb-cols"
              style={{'--cols': b.cols, '--g': b.gutter} as CSSProperties}
            >
              {Array.from({length: b.cols}, (_, i) => (
                <i key={i}>{i + 1}</i>
              ))}
            </div>
          </div>
        </figure>
      ))}
    </div>
  );
}

function Buttons({radius, title}: {radius: number; title: string}) {
  return (
    <div className="sb-row" style={{'--btn-radius-u': radius} as CSSProperties}>
      <p className="sb-row-label">
        <span className="u-micro">{title}</span>
        <code>--btn-radius-u: {radius}</code>
      </p>
      {BUTTON_VARIANTS.map((v) => (
        <figure key={v} className="sb-card" data-variant={v}>
          <div className="sb-swatch">
            <button type="button" className="u-btn" data-variant={v}>
              Shop now
            </button>
          </div>
          <figcaption>
            <span>{LABEL[v]}</span>
            <code>data-variant="{v}"</code>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Typeface({name, spec, serif}: {name: string; spec: string; serif?: boolean}) {
  const style = serif
    ? ({'--font-display': DISPLAY_SERIF, '--display-weight': '400'} as CSSProperties)
    : undefined;
  return (
    <div className="sb-face" style={style}>
      <header className="sb-face-head">
        <span className="sb-glyph u-hl u-hl-1">Aa</span>
        <div>
          <p className="u-micro">{name}</p>
          <p className="sb-dim">{spec}</p>
        </div>
      </header>
      {HEADINGS.map((h) => (
        <div key={h.level} className="sb-spec">
          <p className="sb-spec-meta">
            <span className="u-micro">H{h.level}</span>
            <code>
              {h.token} · {h.u}u
            </code>
          </p>
          <p className={`u-hl u-hl-${h.level}`}>{h.sample}</p>
        </div>
      ))}
    </div>
  );
}

export default function Styles() {
  return (
    <div
      className="sb u-page"
      style={{...pageVars(PALETTE), ...metricVars(METRICS)} as CSSProperties}
    >
      <ThemeFont settings={{headingFont: 'serif'}} />
      <div className="u-stack">
        <div className="u-frame">
          <div className="u-grid sb-grid">
            <header className="sb-mast">
              <p className="u-micro">Unigrid — design system</p>
              <h1 className="u-hl u-hl-1">Styles</h1>
              <dl className="sb-meta">
                <div>
                  <dt className="u-micro">Contents</dt>
                  <dd>01 Grid · 02 Buttons · 03 Type</dd>
                </div>
                <div>
                  <dt className="u-micro">Unit</dt>
                  <dd>1u = 1% of the grid</dd>
                </div>
                <div>
                  <dt className="u-micro">Source</dt>
                  <dd>unigrid.css</dd>
                </div>
              </dl>
            </header>

            <section className="sb-section">
              <h2 className="sb-section-head">
                <span className="sb-num">01</span>
                <span className="u-hl u-hl-2">Grid</span>
              </h2>
              <p className="sb-note">
                Three bands, one row each. Inside a band nothing moves, the whole page
                zooms. Crossing a bound swaps to the next composition. A cell is
                always three quarters as tall as it is wide.
              </p>
              <Bands />
            </section>

            <section className="sb-section">
              <h2 className="sb-section-head">
                <span className="sb-num">02</span>
                <span className="u-hl u-hl-2">Buttons</span>
              </h2>
              <p className="sb-note">
                Three variants, one box. Glass needs something behind it, so it sits on a
                fill.
              </p>
              <Buttons radius={0} title="Square" />
              <Buttons radius={ROUND} title="Rounded" />
            </section>

            <section className="sb-section">
              <h2 className="sb-section-head">
                <span className="sb-num">03</span>
                <span className="u-hl u-hl-2">Type</span>
              </h2>
              <p className="sb-note">
                Two display faces for H1–H3. Every size is a multiple of the grid unit, so
                type scales with the page.
              </p>
              <div className="sb-faces">
                <Typeface name="Sans" spec="Helvetica Neue · Bold 700" />
                <Typeface name="Serif" spec="Instrument Serif · Regular 400" serif />
              </div>
              <div className="sb-scale">
                <p className="sb-row-label">
                  <span className="u-micro">Text scale</span>
                  <code>sans in both themes</code>
                </p>
                {SCALE.map((s) => (
                  <div key={s.name} className="sb-scale-item">
                    <p className="sb-spec-meta">
                      <span className="u-micro">{s.name}</span>
                      <code>
                        {s.token} · {s.u}u
                      </code>
                    </p>
                    <p className={s.className}>The quick brown fox</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
