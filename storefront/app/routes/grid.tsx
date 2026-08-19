import type {ReactNode} from 'react';
import type {LinksFunction} from 'react-router';
import {BANDS, resolve, type Measurements} from '@unigrid/core';
import {Grid, gridDevLinks} from '~/blocks/Grid';
import {Block} from '~/blocks/Block';
import {HARNESS} from '~/blocks/harness';
import type {Placement} from '~/blocks/placement';
import unigridStyles from '~/styles/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

// scaling harness. positions come from core; only the contents are authored here

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
  ...gridDevLinks(),
];

type Chrome = {
  as?: 'header' | 'footer' | 'article' | 'aside' | 'figure';
  className: string;
};

const CHROME: Record<string, Chrome> = {
  masthead: {as: 'header', className: 'b-plain'},
  index: {as: 'aside', className: 'b-plain b-rule'},
  figure: {as: 'figure', className: 'b-red'},
  essay: {as: 'article', className: 'b-paper'},
  fig02: {className: 'b-yellow'},
  sparse: {className: 'b-plain b-rule'},
  fig03: {className: 'b-blue'},
  note: {className: 'b-paper'},
  product: {className: 'b-ink'},
  strip: {className: 'b-plain b-rule'},
  footer: {as: 'footer', className: 'b-ink'},
};

const CONTENT: Record<string, ReactNode> = {
  masthead: (
    <h1 className="u-mega">
      UNI
      <br />
      GRID
    </h1>
  ),
  index: (
    <>
      <p className="u-micro">Scaling harness</p>
      <p className="u-micro u-dim">
        Three bands · one block set · positions per band
      </p>
    </>
  ),
  figure: (
    <>
      <p className="u-micro">Fig. 01</p>
      <p className="u-h2">Media keeps its span.</p>
    </>
  ),
  essay: (
    <>
      <p className="u-micro">Essay</p>
      <h2 className="u-h1">Zoom, not reflow.</h2>
      <p>
        Within a band the composition is fixed. Column count, positions and
        spans do not change — only size. A screenshot at 1600px and one at
        1400px are the same image at two magnifications.
      </p>
      <p>
        Everything derives from a single scalar taken from the grid container,
        not the viewport. Gutters, cell size, type and spacing are multiples of
        it. Above the cap the grid stops growing and the margins absorb the
        surplus; that is the one deliberate break from pure zoom.
      </p>
      <p className="u-micro u-dim">
        Drag the window. Watch --u in the bar above.
      </p>
    </>
  ),
  fig02: <p className="u-micro">Fig. 02</p>,
  sparse: (
    <>
      <p className="u-micro">Occupancy is sparse</p>
      <p className="u-dim">
        A block alone in an empty region is a valid layout. Gaps are authored,
        not accidental.
      </p>
    </>
  ),
  fig03: <p className="u-micro">Fig. 03</p>,
  note: (
    <>
      <p className="u-micro">Note</p>
      <p>
        Text is the exception: measured, rounded up to whole rows, grown
        downward, pushing only the columns it intersects.
      </p>
    </>
  ),
  product: (
    <>
      <p className="u-micro">Product</p>
      <p className="u-h2">
        Reference,
        <br />
        not payload.
      </p>
      <p className="u-micro u-dim">{`{ kind: 'product', handle }`}</p>
    </>
  ),
  strip: (
    <p className="u-micro u-dim">
      01 grid · 02 blocks · 03 resolver · 04 editor
    </p>
  ),
  footer: (
    <p className="u-micro">Row lines stay global — one CSS Grid, not masonry</p>
  ),
};

// every band resolved up front; the container queries pick which one applies
function placements(measurements: Measurements): Map<string, Placement> {
  const byBand = BANDS.map(
    (band) => [band, resolve(HARNESS, band, measurements)] as const,
  );
  const out = new Map<string, Placement>();
  for (const block of HARNESS.blocks) {
    const a = byBand[0]?.[1].get(block.id);
    if (!a) continue;
    const at: Placement = {a};
    for (const [band, cells] of byBand) {
      if (band === 'a') continue;
      const cell = cells.get(block.id);
      if (cell) at[band] = cell;
    }
    out.set(block.id, at);
  }
  return out;
}

export default function GridHarness() {
  const at = placements({});

  return (
    <div className="unigrid-demo">
      <Grid>
        {HARNESS.blocks.map((block) => {
          const placement = at.get(block.id);
          const chrome = CHROME[block.id];
          if (!placement || !chrome) return null;
          return (
            <Block
              key={block.id}
              at={placement}
              as={chrome.as}
              className={chrome.className}
              text={block.type === 'text'}
            >
              {CONTENT[block.id]}
            </Block>
          );
        })}
      </Grid>
    </div>
  );
}
