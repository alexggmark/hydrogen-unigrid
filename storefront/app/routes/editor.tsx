import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {LinksFunction} from 'react-router';
import {DragDropProvider} from '@dnd-kit/react';
import type {DragDropManager} from '@dnd-kit/dom';
import {
  add,
  cellIn,
  commit,
  canRedo,
  canUndo,
  encode,
  findBlock,
  history,
  insertAfter,
  isBand,
  overlaps,
  place,
  redo,
  remove,
  resetToDerived,
  resolve,
  undo,
  WIDEST,
  type Band,
  type BlockType,
  type Cell,
  type Measurements,
} from '@unigrid/core';
import {Grid, gridDevLinks} from '~/blocks/Grid';
import {Block} from '~/blocks/Block';
import {CHROME, CONTENT} from '~/blocks/demo';
import {HARNESS} from '~/blocks/harness';
import {resolveAll} from '~/blocks/placement';
import {DragHandles} from '~/editor/DragHandles';
import {measureBands, sameMeasurements} from '~/editor/measure';
import {NEW_SPAN} from '~/editor/Palette';
import {cellAt, gridUnits, moved, resized, snap, type Edge} from '~/editor/geometry';
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

type DragData =
  | {kind: 'move'; block: string}
  | {kind: 'resize'; block: string; edge: Edge}
  | {kind: 'new'; type: BlockType};

type Drag =
  | {kind: 'move'; block: string; from: Cell}
  | {kind: 'resize'; block: string; edge: Edge; from: Cell}
  | {kind: 'new'; type: BlockType};

// authored cell, ghost cell. they differ whenever something above is growing:
// the drag edits authored, the ghost shows where the resolver will put it.
type Preview = {cell: Cell; shown: Cell; ok: boolean; reason?: string};

const nextId = (blocks: {id: string}[], type: BlockType): string => {
  let n = 1;
  while (blocks.some((b) => b.id === `${type}-${n}`)) n += 1;
  return `${type}-${n}`;
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
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const layout = hist.present;
  const at = useMemo(
    () => resolveAll(layout, measurements ?? {}),
    [layout, measurements],
  );
  const json = useMemo(() => encode(layout), [layout]);
  const bytes = useMemo(() => new TextEncoder().encode(json).length, [json]);

  const cellOf = useCallback(
    (id: string): Cell | undefined => {
      const p = at.get(id);
      return p ? (p[band] ?? p.a) : undefined;
    },
    [at, band],
  );

  const block = selected ? findBlock(layout, selected) : undefined;
  const authored = block ? cellIn(block, band) : undefined;
  const resolved = selected ? cellOf(selected) : undefined;
  // what an edit acts on. never the resolved cell: that carries growth and push,
  // and writing it back would author the displacement, then displace it again.
  const editable = authored ?? resolved;
  const grown =
    resolved && authored ? Math.max(0, resolved.rowSpan - authored.rowSpan) : 0;

  const gridEl = () =>
    hostRef.current?.querySelector<HTMLElement>('.u-grid') ?? null;

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
    const grid = gridEl();
    if (!host || !grid) return;
    const next = measureBands(host, grid);
    setMeasurements((prev) => (sameMeasurements(prev, next) ? prev : next));
  }, [layout]);

  // webfonts land after first paint and change every height
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => {
      const host = hostRef.current;
      const grid = gridEl();
      if (!live || !host || !grid) return;
      const next = measureBands(host, grid);
      setMeasurements((prev) => (sameMeasurements(prev, next) ? prev : next));
    });
    return () => {
      live = false;
    };
  }, []);

  const reasonOf = (r: {reason: string; with?: string}) =>
    r.reason === 'overlap'
      ? `${REASON.overlap} — ${r.with}`
      : (REASON[r.reason] ?? r.reason);

  const commitCell = useCallback(
    (id: string, cell: Cell) => {
      const result = place(layout, id, band, cell);
      if (result.ok) {
        setError(null);
        setHist((h) => commit(h, result.value));
      } else {
        setError(reasonOf(result));
      }
    },
    [band, layout],
  );

  const move = useCallback(
    (patch: Partial<Cell>) => {
      if (!selected || !editable) return;
      commitCell(selected, {...editable, ...patch});
    },
    [commitCell, editable, selected],
  );

  // the ghost is the resolver's answer, not the pointer's. dragging edits the
  // authored cell and the engine decides where that actually lands.
  const previewOf = useCallback(
    (candidate: Cell, id: string | null): Preview => {
      if (!id) {
        const clash = layout.blocks.find((b) => {
          const c = cellOf(b.id);
          return c && overlaps(candidate, c);
        });
        return {
          cell: candidate,
          shown: candidate,
          ok: !clash,
          reason: clash ? `${REASON.overlap} — ${clash.id}` : undefined,
        };
      }
      const result = place(layout, id, band, candidate);
      if (!result.ok) {
        return {
          cell: candidate,
          shown: candidate,
          ok: false,
          reason: reasonOf(result),
        };
      }
      const cells = resolve(result.value, band, measurements?.[band] ?? {});
      return {cell: candidate, shown: cells.get(id) ?? candidate, ok: true};
    },
    [band, cellOf, layout, measurements],
  );

  const addAt = (type: BlockType, cell: Cell) => {
    const id = nextId(layout.blocks, type);
    const made = {id, type, content: {kind: 'none'} as const};

    if (band === WIDEST) {
      const result = add(layout, {...made, at: {a: cell}});
      if (!result.ok) return setError(reasonOf(result));
      setError(null);
      setHist((h) => commit(h, result.value));
      setSelected(id);
      return;
    }

    // added from a narrow band: core decides the wide-band slot, this decides
    // only the override that was actually dragged
    const before = [...layout.blocks]
      .map((b) => ({id: b.id, c: cellOf(b.id)}))
      .filter((b): b is {id: string; c: Cell} => Boolean(b.c))
      .filter((b) => b.c.row < cell.row || (b.c.row === cell.row && b.c.col < cell.col))
      .sort((x, y) => x.c.row - y.c.row || x.c.col - y.c.col)
      .at(-1);

    const seeded = insertAfter(
      layout,
      {...made, rowSpan: cell.rowSpan},
      before?.id ?? '',
    );
    const result = place(seeded, id, band, cell);
    setError(result.ok ? null : reasonOf(result));
    setHist((h) => commit(h, result.ok ? result.value : seeded));
    setSelected(id);
  };

  // read off the manager, not the event: the event carries a snapshot whose
  // transform is only refreshed when the live getter is read, and drag feedback
  // is off here, so nothing else would read it.
  const onDragStart = (_event: unknown, manager: DragDropManager) => {
    const data = manager.dragOperation.source?.data as DragData | undefined;
    if (!data) return;
    if (data.kind === 'new') return setDrag({kind: 'new', type: data.type});

    const b = findBlock(layout, data.block);
    const from = b ? (cellIn(b, band) ?? cellOf(data.block)) : undefined;
    if (!from) return;
    setSelected(data.block);
    setError(null);
    setDrag(
      data.kind === 'move'
        ? {kind: 'move', block: data.block, from}
        : {kind: 'resize', block: data.block, edge: data.edge, from},
    );
  };

  const onDragMove = (_event: unknown, manager: DragDropManager) => {
    const grid = gridEl();
    if (!grid || !drag) return;
    const u = gridUnits(grid);
    if (!u) return;
    const operation = manager.dragOperation;

    if (drag.kind === 'new') {
      const {x, y} = operation.position.current;
      const span = NEW_SPAN[drag.type];
      const spot = cellAt(grid, x, y, u, span.colSpan);
      setPreview(previewOf({...spot, ...span}, null));
      return;
    }

    const {dCol, dRow} = snap(operation.transform.x, operation.transform.y, u);
    const candidate =
      drag.kind === 'move'
        ? moved(drag.from, dCol, dRow, u.cols)
        : resized(drag.from, drag.edge, dCol, dRow, u.cols);
    setPreview(previewOf(candidate, drag.block));
  };

  const onDragEnd = (event: {canceled: boolean}) => {
    const current = drag;
    const target = preview;
    setDrag(null);
    setPreview(null);
    if (event.canceled || !current || !target) return;
    if (!target.ok) return setError(target.reason ?? 'that move is not allowed');
    if (current.kind === 'new') addAt(current.type, target.cell);
    else commitCell(current.block, target.cell);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.matches('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') return setSelected(null);
      // dnd-kit owns the arrows once a keyboard drag is up
      if (drag || !selected || !editable) return;

      const grow = e.shiftKey;
      const patch =
        e.key === 'ArrowLeft'
          ? grow
            ? {colSpan: editable.colSpan - 1}
            : {col: editable.col - 1}
          : e.key === 'ArrowRight'
            ? grow
              ? {colSpan: editable.colSpan + 1}
              : {col: editable.col + 1}
            : e.key === 'ArrowUp'
              ? grow
                ? {rowSpan: editable.rowSpan - 1}
                : {row: editable.row - 1}
              : e.key === 'ArrowDown'
                ? grow
                  ? {rowSpan: editable.rowSpan + 1}
                  : {row: editable.row + 1}
                : null;
      if (!patch) return;
      e.preventDefault();
      move(patch);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag, editable, move, selected]);

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
    <DragDropProvider
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <div className="e-shell">
        <div className="e-stage" ref={hostRef} data-band={band}>
          <div className="unigrid-demo">
            <Grid probes>
              {layout.blocks.map((b) => {
                const p = at.get(b.id);
                if (!p) return null;
                const chrome = CHROME[b.id] ?? {className: 'b-plain b-rule'};
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
                    {CONTENT[b.id] ?? <p className="u-micro">{b.type}</p>}
                    <DragHandles id={b.id} selected={b.id === selected} />
                  </Block>
                );
              })}
              {/* a block pushed down by growing text is drawn where it lands,
                  but it still collides where it was authored. during a drag
                  that authored footprint is the only thing that explains a
                  refusal, so show it rather than let it read as a phantom. */}
              {drag
                ? layout.blocks.map((b) => {
                    const a = cellIn(b, band);
                    const r = cellOf(b.id);
                    if (!a || !r) return null;
                    if (
                      a.col === r.col &&
                      a.row === r.row &&
                      a.colSpan === r.colSpan &&
                      a.rowSpan === r.rowSpan
                    ) {
                      return null;
                    }
                    return (
                      <div
                        key={`authored-${b.id}`}
                        className="e-authored"
                        aria-hidden
                        style={{
                          gridColumn: `${a.col} / span ${a.colSpan}`,
                          gridRow: `${a.row} / span ${a.rowSpan}`,
                        }}
                      />
                    );
                  })
                : null}
              {preview ? (
                <div
                  className="e-ghost"
                  aria-hidden
                  data-invalid={preview.ok ? undefined : ''}
                  style={{
                    gridColumn: `${preview.shown.col} / span ${preview.shown.colSpan}`,
                    gridRow: `${preview.shown.row} / span ${preview.shown.rowSpan}`,
                  }}
                />
              ) : null}
            </Grid>
          </div>
        </div>

        <Rail
          layout={layout}
          band={band}
          selected={selected}
          authored={authored}
          resolved={resolved}
          editable={editable}
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
    </DragDropProvider>
  );
}
