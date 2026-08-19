import {useEffect, useRef, useState} from 'react';
import '~/styles/unigrid-dev.css';

// dev instrumentation. surfaces --u so the readability floor of each band can
// be found by dragging the window, and flags text blocks that already exceed
// their authored span — the case the resolver will own.

const COLUMNS = 12;
const TYPE_FLOOR_PX = 14;

type Readout = {
  band: string;
  width: number;
  u: number;
  col: number;
  row: number;
  type: number;
};

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

export function GridDev() {
  const ref = useRef<HTMLDivElement>(null);
  const [readout, setReadout] = useState<Readout | null>(null);

  useEffect(() => {
    const grid = ref.current?.closest('.unigrid');
    if (!(grid instanceof HTMLElement)) return;

    const report = () => {
      const cs = getComputedStyle(grid);
      const width = grid.getBoundingClientRect().width;
      const cols = Number(cs.getPropertyValue('--cols').trim());
      const gutter = parseFloat(cs.getPropertyValue('--gutter'));
      const col = (width - (cols - 1) * gutter) / cols;
      const row = col * 0.75;

      setReadout({
        band: cols === 12 ? 'A' : cols === 8 ? 'B' : 'C',
        width,
        u: width / 100,
        col,
        row,
        type: parseFloat(cs.fontSize),
      });

      for (const block of grid.querySelectorAll<HTMLElement>(
        '.block[data-text]',
      )) {
        const needed = Math.ceil((block.scrollHeight + gutter) / (row + gutter));
        block.classList.toggle(
          'is-over',
          block.scrollHeight > block.clientHeight + 1,
        );
        block.dataset.rows = String(needed);
      }
    };

    const observer = new ResizeObserver(report);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'g') document.body.classList.toggle('show-grid');
      if (e.key === 'h') document.body.classList.toggle('hide-hud');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="overlay" aria-hidden ref={ref}>
        {Array.from({length: COLUMNS}, (_, i) => (
          <i key={i} />
        ))}
      </div>
      {readout ? (
        <div className="hud">
          <span>
            band <b>{readout.band}</b>
          </span>
          <span>
            grid <b>{px(readout.width)}</b>
          </span>
          <span>
            --u <b>{px(readout.u)}</b>
          </span>
          <span>
            col <b>{px(readout.col)}</b>
          </span>
          <span>
            row <b>{px(readout.row)}</b>
          </span>
          <span>
            body <b>{px(readout.type)}</b>
          </span>
          {readout.type < TYPE_FLOOR_PX ? (
            <span className="warn">type below floor — band bound too low</span>
          ) : null}
          <button
            type="button"
            onClick={() => document.body.classList.toggle('show-grid')}
          >
            grid (g)
          </button>
          <button
            type="button"
            onClick={() => document.body.classList.toggle('hide-hud')}
          >
            hide (h)
          </button>
        </div>
      ) : null}
    </>
  );
}
