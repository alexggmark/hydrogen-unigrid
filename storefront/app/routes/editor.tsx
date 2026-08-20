import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {LinksFunction} from 'react-router';
import {DragDropProvider} from '@dnd-kit/react';
import type {DragDropManager} from '@dnd-kit/dom';
import {
  add,
  addNode,
  cellIn,
  commit,
  canRedo,
  canUndo,
  emptyBlock,
  encode,
  findBlock,
  findNode,
  history,
  insertAfter,
  isBand,
  moveNode,
  overlaps,
  patchBlock,
  patchNode,
  place,
  placeNode,
  redo,
  remove,
  removeNode,
  resetToDerived,
  setFlex,
  undo,
  WIDEST,
  type Band,
  type Cell,
  type ElementKind,
  type Node,
} from '@unigrid/core';
import {Grid, gridDevLinks} from '~/blocks/Grid';
import {Block} from '~/blocks/Block';
import {HARNESS} from '~/blocks/harness';
import {deriveAll} from '~/blocks/placement';
import {overflowing, sameOverflow} from '~/blocks/overflow';
import {DragHandles} from '~/editor/DragHandles';
import {NEW_SPAN} from '~/editor/Palette';
import {cellAt, gridUnits, moved, resized, snap, type Edge} from '~/editor/geometry';
import {dropTarget, type NodeDrag} from '~/editor/Tree';
import {Rail} from '~/editor/Rail';
import unigridStyles from '~/styles/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';
import editorStyles from '~/styles/unigrid-editor.css?url';

// editing is in memory: a save button commits, dragging never writes

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
  | {kind: 'new'}
  | NodeDrag;

type Drag =
  | {kind: 'move'; block: string; from: Cell}
  | {kind: 'resize'; block: string; edge: Edge; from: Cell}
  | {kind: 'new'};

type Preview = {cell: Cell; ok: boolean; reason?: string};

const nextId = (taken: (id: string) => boolean, prefix: string): string => {
  let n = 1;
  while (taken(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
};

const NEW_NODE: Record<ElementKind | 'group', (id: string) => Node> = {
  headline: (id) => ({id, kind: 'headline', level: 2, value: 'Headline'}),
  text: (id) => ({id, kind: 'text', size: 'sm', value: 'Body text.'}),
  richText: (id) => ({id, kind: 'richText', size: 'sm', value: 'First line.\nSecond line.'}),
  button: (id) => ({id, kind: 'button', variant: 'primary', label: 'Button', href: '#'}),
  group: (id) => ({
    id,
    kind: 'group',
    flex: {direction: 'row', justify: 'start', align: 'center', gap: 1},
    children: [],
  }),
};

export default function Editor() {
  const hostRef = useRef<HTMLDivElement>(null);
  const afterDrag = useRef(false);
  const [hist, setHist] = useState(() => history(HARNESS));
  const [band, setBand] = useState<Band>(WIDEST);
  const [selected, setSelected] = useState<string | null>(null);
  const [node, setNode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [clipped, setClipped] = useState<Record<string, number>>({});
  // rail-tree drags are their own gesture: no ghost, no cell, no placement
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);

  const layout = hist.present;
  const at = useMemo(() => deriveAll(layout), [layout]);
  const json = useMemo(() => encode(layout), [layout]);
  const bytes = useMemo(() => new TextEncoder().encode(json).length, [json]);

  const cellOf = useCallback(
    (id: string): Cell | undefined => {
      const p = at.get(id);
      return p ? (p[band] ?? p.a) : undefined;
    },
    [at, band],
  );

  const picked = node ? findNode(layout, node) : undefined;
  const block = selected ? findBlock(layout, selected) : undefined;
  // absent in a narrow band means derived; editing is what writes the override
  const authored = block ? cellIn(block, band) : undefined;
  const editable = authored ?? (selected ? cellOf(selected) : undefined);

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

  // re-read on every layout edit: a span change is what starts or stops clipping
  useEffect(() => {
    const grid = gridEl();
    if (!grid) return;

    const read = () => {
      const u = gridUnits(grid);
      if (!u) return;
      const next = overflowing(grid, u);
      setClipped((prev) => (sameOverflow(prev, next) ? prev : next));
    };

    read();
    // the badge is absolutely positioned, so this cannot feed itself
    const observer = new ResizeObserver(read);
    observer.observe(grid);
    // webfonts land after first paint and change every wrap
    void document.fonts?.ready.then(read);
    return () => observer.disconnect();
  }, [layout, band]);

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

  const previewOf = useCallback(
    (candidate: Cell, id: string | null): Preview => {
      if (!id) {
        const clash = layout.blocks.find((b) => {
          const c = cellOf(b.id);
          return c && overlaps(candidate, c);
        });
        return {
          cell: candidate,
          ok: !clash,
          reason: clash ? `${REASON.overlap} — ${clash.id}` : undefined,
        };
      }
      const result = place(layout, id, band, candidate);
      return result.ok
        ? {cell: candidate, ok: true}
        : {cell: candidate, ok: false, reason: reasonOf(result)};
    },
    [band, cellOf, layout],
  );

  const addAt = (cell: Cell) => {
    const id = nextId((x) => layout.blocks.some((b) => b.id === x), 'block');

    if (band === WIDEST) {
      const result = add(layout, emptyBlock(id, {a: cell}));
      if (!result.ok) return setError(reasonOf(result));
      setError(null);
      setHist((h) => commit(h, result.value));
      setSelected(id);
      return;
    }

    // core decides the wide-band slot; this decides only the dragged override
    const before = [...layout.blocks]
      .map((b) => ({id: b.id, c: cellOf(b.id)}))
      .filter((b): b is {id: string; c: Cell} => Boolean(b.c))
      .filter((b) => b.c.row < cell.row || (b.c.row === cell.row && b.c.col < cell.col))
      .sort((x, y) => x.c.row - y.c.row || x.c.col - y.c.col)
      .at(-1);

    const seeded = insertAfter(layout, {id, rowSpan: cell.rowSpan}, before?.id ?? '');
    const result = place(seeded, id, band, cell);
    setError(result.ok ? null : reasonOf(result));
    setHist((h) => commit(h, result.ok ? result.value : seeded));
    setSelected(id);
  };

  // content edits never touch placement, so they cannot fail the way a drop can
  const edit = useCallback(
    (next: typeof layout) => {
      setError(null);
      setHist((h) => commit(h, next));
    },
    [],
  );

  const addChild = (kind: ElementKind | 'group', parentId: string | null) => {
    if (!selected) return;
    const id = nextId((x) => Boolean(findNode(layout, x)), kind);
    edit(addNode(layout, selected, parentId, NEW_NODE[kind](id)));
    setNode(id);
  };

  // read off the manager, not the event: the event's transform is a snapshot,
  // refreshed only when the live getter is read, and feedback is off here
  const onDragStart = (_event: unknown, manager: DragDropManager) => {
    const data = manager.dragOperation.source?.data as DragData | undefined;
    if (!data) return;
    if (data.kind === 'node') return setNodeDrag(data);
    if (data.kind === 'new') return setDrag({kind: 'new'});

    const from = cellOf(data.block);
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
      const spot = cellAt(grid, x, y, u, NEW_SPAN.colSpan);
      setPreview(previewOf({...spot, ...NEW_SPAN}, null));
      return;
    }

    const {dCol, dRow} = snap(operation.transform.x, operation.transform.y, u);
    const target =
      drag.kind === 'resize'
        ? resized(drag.from, drag.edge, dCol, dRow, u.cols)
        : moved(drag.from, dCol, dRow, u.cols);
    setPreview(previewOf(target, drag.block));
  };

  const onDragEnd = (event: {canceled: boolean}, manager: DragDropManager) => {
    const current = drag;
    const target = preview;
    const node = nodeDrag;
    afterDrag.current = true;
    setDrag(null);
    setPreview(null);
    setNodeDrag(null);

    if (node) {
      if (event.canceled) return;
      const to = dropTarget(manager);
      if (!to) return;
      // the tree shows this as invalid while dragging; core refuses it too
      if (node.group && to.parent) {
        return setError('a group cannot go inside a group');
      }
      setError(null);
      edit(placeNode(layout, node.node, to.parent, to.index));
      return;
    }

    if (event.canceled || !current || !target) return;
    if (!target.ok) return setError(target.reason ?? 'that move is not allowed');
    if (current.kind === 'new') addAt(target.cell);
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

  // a drag released outside the block fires its click on a common ancestor, so
  // selecting from that would clear the selection the drag was acting on.
  // cleared on pointerdown too, or a keyboard drag would strand the flag.
  useEffect(() => {
    const stage = hostRef.current;
    if (!stage) return;
    const onDown = () => {
      afterDrag.current = false;
    };
    const onClick = (e: MouseEvent) => {
      if (afterDrag.current) {
        afterDrag.current = false;
        return;
      }
      const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-block]');
      setSelected(hit?.dataset.block ?? null);
    };
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('click', onClick);
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('click', onClick);
    };
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
                return (
                  <Block
                    key={b.id}
                    block={b}
                    at={p}
                    blockId={b.id}
                    selected={b.id === selected}
                    chrome={
                      <>
                        {clipped[b.id] ? (
                          <p className="e-clip">
                            needs {clipped[b.id]} more row
                            {clipped[b.id] === 1 ? '' : 's'}
                          </p>
                        ) : null}
                        <DragHandles id={b.id} selected={b.id === selected} />
                      </>
                    }
                  />
                );
              })}
              {preview ? (
                <div
                  className="e-ghost"
                  aria-hidden
                  data-invalid={preview.ok ? undefined : ''}
                  style={{
                    gridColumn: `${preview.cell.col} / span ${preview.cell.colSpan}`,
                    gridRow: `${preview.cell.row} / span ${preview.cell.rowSpan}`,
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
          editable={editable}
          clipped={selected ? (clipped[selected] ?? 0) : 0}
          block={block}
          node={picked}
          dragging={nodeDrag}
          error={error}
          dirty={saved !== json}
          bytes={bytes}
          canUndo={canUndo(hist)}
          canRedo={canRedo(hist)}
          onBand={setBand}
          onSelect={(id) => {
            setSelected(id);
            setNode(null);
          }}
          onCell={move}
          onPickNode={setNode}
          onAddChild={addChild}
          onPatchNode={(id, patch) => edit(patchNode(layout, id, patch))}
          onMoveNode={(id, delta) => edit(moveNode(layout, id, delta))}
          onRemoveNode={(id) => {
            edit(removeNode(layout, id));
            if (node === id) setNode(null);
          }}
          onPatchBlock={(patch) => {
            if (selected) edit(patchBlock(layout, selected, patch));
          }}
          onFlex={(id, patch) => edit(setFlex(layout, id, patch))}
          onFit={() => {
            if (!selected || !editable) return;
            const short = clipped[selected] ?? 0;
            if (short > 0) move({rowSpan: editable.rowSpan + short});
          }}
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
            setNode(null);
          }}
          onUndo={() => setHist(undo)}
          onRedo={() => setHist(redo)}
          onSave={onSave}
        />
      </div>
    </DragDropProvider>
  );
}
