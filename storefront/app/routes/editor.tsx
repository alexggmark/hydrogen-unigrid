import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {LinksFunction} from 'react-router';
import {
  cellIn,
  commit,
  canRedo,
  canUndo,
  encode,
  findBlock,
  history,
  isBand,
  place,
  redo,
  remove,
  resetToDerived,
  undo,
  WIDEST,
  type Band,
  type Cell,
  type Measurements,
} from '@unigrid/core';
import {Grid, gridDevLinks} from '~/blocks/Grid';
import {Block} from '~/blocks/Block';
import {CHROME, CONTENT} from '~/blocks/demo';
import {HARNESS} from '~/blocks/harness';
import {resolveAll} from '~/blocks/placement';
import {measureBands, sameMeasurements} from '~/editor/measure';
import {Rail} from '~/editor/Rail';
import unigridStyles from '~/styles/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';
import editorStyles from '~/styles/unigrid-editor.css?url';

// editing is in memory and save is a stub, which is the shape the real editor
// has anyway — a save button commits, dragging never writes.

// measurement is client-only by nature, so the server never wants the layout pass
const useMeasureEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
  {rel: 'stylesheet', href: editorStyles},
  ...gridDevLinks(),
];

const REASON: Record<string, string> = {
  'out-of-bounds': 'outside the grid for this band',
  'bad-span': 'spans must be whole numbers, 1 or more',
  overlap: 'that cell is occupied',
  'no-such-block': 'block no longer exists',
};

export default function Editor() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hist, setHist] = useState(() => history(HARNESS));
  const [band, setBand] = useState<Band>(WIDEST);
  const [selected, setSelected] = useState<string | null>(null);
  const [measurements, setMeasurements] =
    useState<Record<Band, Measurements> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const layout = hist.present;
  const at = useMemo(
    () => resolveAll(layout, measurements ?? {}),
    [layout, measurements],
  );
  const json = useMemo(() => encode(layout), [layout]);
  const bytes = useMemo(() => new TextEncoder().encode(json).length, [json]);

  const block = selected ? findBlock(layout, selected) : undefined;
  const authored = block ? cellIn(block, band) : undefined;
  const placement = selected ? at.get(selected) : undefined;
  const resolved = placement ? (placement[band] ?? placement.a) : undefined;
  const grown =
    resolved && authored ? Math.max(0, resolved.rowSpan - authored.rowSpan) : 0;

  // url is the editor's state store. plain searchparams, no router hooks.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const b = params.get('band');
    const s = params.get('sel');
    if (isBand(b)) setBand(b);
    if (s) setSelected(s);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('band', band);
    if (selected) params.set('sel', selected);
    else params.delete('sel');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [band, selected]);

  // measure after paint, then feed core. converges in one pass: a grown block
  // reports its grown height, which is the number that grew it.
  useMeasureEffect(() => {
    const host = hostRef.current;
    const grid = host?.querySelector<HTMLElement>('.u-grid');
    if (!host || !grid) return;
    const next = measureBands(host, grid);
    setMeasurements((prev) => (sameMeasurements(prev, next) ? prev : next));
  }, [layout]);

  // webfonts land after first paint and change every height
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => {
      const host = hostRef.current;
      const grid = host?.querySelector<HTMLElement>('.u-grid');
      if (!live || !host || !grid) return;
      const next = measureBands(host, grid);
      setMeasurements((prev) => (sameMeasurements(prev, next) ? prev : next));
    });
    return () => {
      live = false;
    };
  }, []);

  const move = useCallback(
    (patch: Partial<Cell>) => {
      if (!selected || !resolved) return;
      const next = {...resolved, ...patch};
      const result = place(layout, selected, band, next);
      if (result.ok) {
        setError(null);
        setHist((h) => commit(h, result.value));
      } else {
        setError(
          result.reason === 'overlap'
            ? `${REASON.overlap} — ${result.with}`
            : (REASON[result.reason] ?? result.reason),
        );
      }
    },
    [band, layout, resolved, selected],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.matches('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') return setSelected(null);
      if (!selected || !resolved) return;

      const step = e.shiftKey ? 'span' : 'move';
      const patch =
        e.key === 'ArrowLeft'
          ? step === 'move'
            ? {col: resolved.col - 1}
            : {colSpan: resolved.colSpan - 1}
          : e.key === 'ArrowRight'
            ? step === 'move'
              ? {col: resolved.col + 1}
              : {colSpan: resolved.colSpan + 1}
            : e.key === 'ArrowUp'
              ? step === 'move'
                ? {row: resolved.row - 1}
                : {rowSpan: resolved.rowSpan - 1}
              : e.key === 'ArrowDown'
                ? step === 'move'
                  ? {row: resolved.row + 1}
                  : {rowSpan: resolved.rowSpan + 1}
                : null;
      if (!patch) return;
      e.preventDefault();
      move(patch);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, resolved, selected]);

  useEffect(() => {
    const stage = hostRef.current;
    if (!stage) return;
    const onClick = (e: MouseEvent) => {
      const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-block]');
      setSelected(hit?.dataset.block ?? null);
    };
    stage.addEventListener('click', onClick);
    return () => stage.removeEventListener('click', onClick);
  }, []);

  const onSave = () => {
    setSaved(json);
    // stub: the seam exists so the wire format is exercised from day one
    const url = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unigrid-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="e-shell">
      <div className="e-stage" ref={hostRef} data-band={band}>
        <div className="unigrid-demo">
          <Grid>
            {layout.blocks.map((b) => {
              const p = at.get(b.id);
              const chrome = CHROME[b.id];
              if (!p || !chrome) return null;
              return (
                <Block
                  key={b.id}
                  at={p}
                  as={chrome.as}
                  className={chrome.className}
                  text={b.type === 'text'}
                  blockId={b.id}
                  selected={b.id === selected}
                >
                  {CONTENT[b.id]}
                </Block>
              );
            })}
          </Grid>
        </div>
      </div>

      <Rail
        layout={layout}
        band={band}
        selected={selected}
        authored={authored}
        resolved={resolved}
        grown={grown}
        error={error}
        dirty={saved !== json}
        bytes={bytes}
        canUndo={canUndo(hist)}
        canRedo={canRedo(hist)}
        onBand={setBand}
        onSelect={setSelected}
        onCell={move}
        onReset={() => {
          if (!selected) return;
          setError(null);
          setHist((h) => commit(h, resetToDerived(layout, selected, band)));
        }}
        onDelete={() => {
          if (!selected) return;
          setError(null);
          setHist((h) => commit(h, remove(layout, selected)));
          setSelected(null);
        }}
        onUndo={() => setHist(undo)}
        onRedo={() => setHist(redo)}
        onSave={onSave}
      />
    </div>
  );
}
