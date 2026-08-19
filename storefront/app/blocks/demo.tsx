import type {ReactNode} from 'react';

// harness content. shared so /grid and /editor cannot drift apart.

export type Chrome = {
  as?: 'header' | 'footer' | 'article' | 'aside' | 'figure';
  className: string;
};

export const CHROME: Record<string, Chrome> = {
  masthead: {as: 'header', className: 'b-plain'},
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

export const CONTENT: Record<string, ReactNode> = {
  masthead: (
    <h1 className="u-mega">
      UNI
      <br />
      GRID
    </h1>
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
