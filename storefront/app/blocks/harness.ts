import type {Layout} from '@unigrid/core';

// the grid.html composition as real layout data. every band is authored here,
// so what renders is the engine's output rather than css fallback.
export const HARNESS: Layout = {
  version: 1,
  blocks: [
    {
      id: 'masthead',
      type: 'text',
      content: {kind: 'none'},
      at: {
        a: {col: 1, colSpan: 8, row: 1, rowSpan: 2},
        b: {col: 1, colSpan: 8, row: 1, rowSpan: 2},
        c: {col: 1, colSpan: 4, row: 1, rowSpan: 3},
      },
    },
    {
      id: 'index',
      type: 'text',
      content: {kind: 'none'},
      at: {
        a: {col: 10, colSpan: 3, row: 1, rowSpan: 2},
        b: {col: 1, colSpan: 4, row: 3, rowSpan: 1},
        c: {col: 1, colSpan: 4, row: 4, rowSpan: 2},
      },
    },
    {
      id: 'figure',
      type: 'image',
      content: {kind: 'none'},
      at: {
        a: {col: 1, colSpan: 4, row: 4, rowSpan: 3},
        b: {col: 1, colSpan: 4, row: 4, rowSpan: 3},
        c: {col: 1, colSpan: 4, row: 6, rowSpan: 4},
      },
    },
    {
      id: 'essay',
      type: 'text',
      content: {kind: 'none'},
      at: {
        a: {col: 5, colSpan: 5, row: 4, rowSpan: 5},
        b: {col: 5, colSpan: 4, row: 4, rowSpan: 6},
        c: {col: 1, colSpan: 4, row: 10, rowSpan: 10},
      },
    },
    {
      id: 'fig02',
      type: 'rule',
      content: {kind: 'none'},
      at: {
        a: {col: 10, colSpan: 3, row: 4, rowSpan: 2},
        b: {col: 1, colSpan: 4, row: 7, rowSpan: 2},
        c: {col: 1, colSpan: 4, row: 20, rowSpan: 3},
      },
    },
    {
      id: 'sparse',
      type: 'text',
      content: {kind: 'none'},
      at: {
        a: {col: 10, colSpan: 3, row: 7, rowSpan: 2},
        b: {col: 1, colSpan: 4, row: 10, rowSpan: 2},
        c: {col: 1, colSpan: 4, row: 23, rowSpan: 3},
      },
    },
    {
      id: 'fig03',
      type: 'rule',
      content: {kind: 'none'},
      at: {
        a: {col: 1, colSpan: 4, row: 8, rowSpan: 2},
        b: {col: 5, colSpan: 4, row: 10, rowSpan: 2},
        c: {col: 1, colSpan: 4, row: 26, rowSpan: 3},
      },
    },
    {
      id: 'note',
      type: 'text',
      content: {kind: 'none'},
      at: {
        a: {col: 5, colSpan: 3, row: 10, rowSpan: 2},
        b: {col: 5, colSpan: 4, row: 13, rowSpan: 2},
        c: {col: 1, colSpan: 4, row: 29, rowSpan: 3},
      },
    },
    {
      id: 'product',
      type: 'product',
      content: {kind: 'product', handle: 'reference-not-payload'},
      at: {
        a: {col: 1, colSpan: 3, row: 11, rowSpan: 3},
        b: {col: 1, colSpan: 4, row: 13, rowSpan: 3},
        c: {col: 1, colSpan: 4, row: 32, rowSpan: 5},
      },
    },
    {
      id: 'strip',
      type: 'rule',
      content: {kind: 'none'},
      at: {
        a: {col: 5, colSpan: 8, row: 13, rowSpan: 1},
        b: {col: 1, colSpan: 8, row: 16, rowSpan: 1},
        c: {col: 1, colSpan: 4, row: 37, rowSpan: 2},
      },
    },
    {
      id: 'footer',
      type: 'text',
      content: {kind: 'none'},
      at: {
        a: {col: 1, colSpan: 12, row: 15, rowSpan: 2},
        b: {col: 1, colSpan: 8, row: 17, rowSpan: 2},
        c: {col: 1, colSpan: 4, row: 39, rowSpan: 3},
      },
    },
  ],
};
