import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {gridUnits} from './units';

// dev instrumentation: surfaces --u, flags text blocks past their authored span

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
    const grid = ref.current?.closest('.u-grid');
    if (!(grid instanceof HTMLElement)) return;

    const report = () => {
      const units = gridUnits(grid);
      if (!units) return;
      const {col, row, gutter, cols} = units;
      const width = grid.getBoundingClientRect().width;

      setReadout({
        band: cols === 12 ? 'A' : cols === 8 ? 'B' : 'C',
        width,
        u: width / 100,
        col,
        row,
        type: parseFloat(getComputedStyle(grid).fontSize),
      });

      for (const block of grid.querySelectorAll<HTMLElement>(
        '.u-block[data-text]',
      )) {
        const needed = Math.ceil(
          (block.scrollHeight + gutter) / (row + gutter),
        );
        block.classList.toggle(
          'u-over',
          block.scrollHeight > block.clientHeight + 1,
        );
        block.dataset.rows = String(needed);
      }
    };

    const observer = new ResizeObserver(report);
    observer.observe(grid);

    // a forced band changes --cols without changing width, so resize never fires
    const host = grid.closest('[data-band]');
    const attrs = new MutationObserver(report);
    if (host) attrs.observe(host, {attributes: true, attributeFilter: ['data-band']});

    return () => {
      observer.disconnect();
      attrs.disconnect();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.matches('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'g') document.body.classList.toggle('u-show-grid');
      if (e.key === 'h') document.body.classList.toggle('u-hide-hud');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div className="u-overlay" aria-hidden ref={ref}>
        {Array.from({length: COLUMNS}, (_, i) => (
          <i key={i} />
        ))}
      </div>
      {/* .u-frame sets container-type, making it the containing block for fixed
          descendants — the hud has to leave the subtree to pin to the viewport */}
      {readout
        ? createPortal(
            <div className="u-hud">
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
                <span className="warn">
                  type below floor — band bound too low
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => document.body.classList.toggle('u-show-grid')}
              >
                grid (g)
              </button>
              <button
                type="button"
                onClick={() => document.body.classList.toggle('u-hide-hud')}
              >
                hide (h)
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
