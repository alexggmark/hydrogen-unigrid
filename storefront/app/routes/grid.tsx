import type {LinksFunction} from 'react-router';
import {Grid} from '~/blocks/Grid';
import {Block} from '~/blocks/Block';
import unigridStyles from '~/styles/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

// scaling harness. the composition from grid.html, rendered through the real
// primitives, so the promotion can be diffed by eye. no data, no editing.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
];

export default function GridHarness() {
  return (
    <div className="unigrid-demo">
      <Grid>
        <Block
          as="header"
          className="b-plain"
          at={{
            a: {col: 1, colSpan: 8, row: 1, rowSpan: 2},
            b: {col: 1, colSpan: 8, row: 1, rowSpan: 2},
            c: {col: 1, colSpan: 4, row: 1, rowSpan: 3},
          }}
        >
          <h1 className="mega">
            UNI
            <br />
            GRID
          </h1>
        </Block>

        <Block
          as="aside"
          className="b-plain b-rule"
          at={{
            a: {col: 10, colSpan: 3, row: 1, rowSpan: 2},
            b: {col: 1, colSpan: 4, row: 3, rowSpan: 1},
            c: {col: 1, colSpan: 4, row: 4, rowSpan: 2},
          }}
        >
          <p className="micro">Scaling harness</p>
          <p className="micro dim">
            Three bands · one block set · positions per band
          </p>
        </Block>

        <Block
          as="figure"
          className="b-red"
          at={{
            a: {col: 1, colSpan: 4, row: 4, rowSpan: 3},
            b: {col: 1, colSpan: 4, row: 4, rowSpan: 3},
            c: {col: 1, colSpan: 4, row: 6, rowSpan: 4},
          }}
        >
          <p className="micro">Fig. 01</p>
          <p className="h2">Media keeps its span.</p>
        </Block>

        <Block
          as="article"
          className="b-paper"
          text
          at={{
            a: {col: 5, colSpan: 5, row: 4, rowSpan: 5},
            b: {col: 5, colSpan: 4, row: 4, rowSpan: 6},
            c: {col: 1, colSpan: 4, row: 10, rowSpan: 10},
          }}
        >
          <p className="micro">Essay</p>
          <h2 className="h1">Zoom, not reflow.</h2>
          <p>
            Within a band the composition is fixed. Column count, positions and
            spans do not change — only size. A screenshot at 1600px and one at
            1400px are the same image at two magnifications.
          </p>
          <p>
            Everything derives from a single scalar taken from the grid
            container, not the viewport. Gutters, cell size, type and spacing
            are multiples of it. Above the cap the grid stops growing and the
            margins absorb the surplus; that is the one deliberate break from
            pure zoom.
          </p>
          <p className="micro dim">Drag the window. Watch --u in the bar above.</p>
        </Block>

        <Block
          className="b-yellow"
          at={{
            a: {col: 10, colSpan: 3, row: 4, rowSpan: 2},
            b: {col: 1, colSpan: 4, row: 7, rowSpan: 2},
            c: {col: 1, colSpan: 4, row: 20, rowSpan: 3},
          }}
        >
          <p className="micro">Fig. 02</p>
        </Block>

        {/* deliberate air above the blue block below — never repack */}
        <Block
          className="b-plain b-rule"
          at={{
            a: {col: 10, colSpan: 3, row: 7, rowSpan: 2},
            b: {col: 1, colSpan: 4, row: 10, rowSpan: 2},
            c: {col: 1, colSpan: 4, row: 23, rowSpan: 3},
          }}
        >
          <p className="micro">Occupancy is sparse</p>
          <p className="dim">
            A block alone in an empty region is a valid layout. Gaps are
            authored, not accidental.
          </p>
        </Block>

        <Block
          className="b-blue"
          at={{
            a: {col: 1, colSpan: 4, row: 8, rowSpan: 2},
            b: {col: 5, colSpan: 4, row: 10, rowSpan: 2},
            c: {col: 1, colSpan: 4, row: 26, rowSpan: 3},
          }}
        >
          <p className="micro">Fig. 03</p>
        </Block>

        <Block
          className="b-paper"
          text
          at={{
            a: {col: 5, colSpan: 3, row: 10, rowSpan: 2},
            b: {col: 5, colSpan: 4, row: 13, rowSpan: 2},
            c: {col: 1, colSpan: 4, row: 29, rowSpan: 3},
          }}
        >
          <p className="micro">Note</p>
          <p>
            Text is the exception: measured, rounded up to whole rows, grown
            downward, pushing only the columns it intersects.
          </p>
        </Block>

        <Block
          className="b-ink"
          at={{
            a: {col: 1, colSpan: 3, row: 11, rowSpan: 3},
            b: {col: 1, colSpan: 4, row: 13, rowSpan: 3},
            c: {col: 1, colSpan: 4, row: 32, rowSpan: 5},
          }}
        >
          <p className="micro">Product</p>
          <p className="h2">
            Reference,
            <br />
            not payload.
          </p>
          <p className="micro dim">{`{ kind: 'product', handle }`}</p>
        </Block>

        <Block
          className="b-plain b-rule"
          at={{
            a: {col: 5, colSpan: 8, row: 13, rowSpan: 1},
            b: {col: 1, colSpan: 8, row: 16, rowSpan: 1},
            c: {col: 1, colSpan: 4, row: 37, rowSpan: 2},
          }}
        >
          <p className="micro dim">
            01 grid · 02 blocks · 03 resolver · 04 editor
          </p>
        </Block>

        <Block
          as="footer"
          className="b-ink"
          at={{
            a: {col: 1, colSpan: 12, row: 15, rowSpan: 2},
            b: {col: 1, colSpan: 8, row: 17, rowSpan: 2},
            c: {col: 1, colSpan: 4, row: 39, rowSpan: 3},
          }}
        >
          <p className="micro">
            Row lines stay global — one CSS Grid, not masonry
          </p>
        </Block>
      </Grid>
    </div>
  );
}
