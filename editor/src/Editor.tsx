import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {DragDropProvider} from '@dnd-kit/react';
import {
  Accessibility,
  AutoScroller,
  Cursor,
  Feedback,
  PreventSelection,
  type DragDropManager,
} from '@dnd-kit/dom';
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
  type History as LayoutHistory,
  type ElementKind,
  type Node,
} from '@unigrid/core';
import {Block, Grid, deriveAll, overflowing, sameOverflow} from '@unigrid/blocks';
import {DragHandles} from './DragHandles';
import {NEW_SPAN} from './Palette';
import {cellAt, gridUnits, moved, resized, snap, type Edge} from './geometry';
import {dropTarget, type NodeDrag} from './Tree';
import {Rail, type PageEntry, type Tab} from './Rail';
import {DEFAULT_PALETTE, type Layout, type Palette} from '@unigrid/core';


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

// `move` transforms the element itself. every other mode inserts a placeholder
// clone and reparents the original, outside react's knowledge.
const PLUGINS = [
  Accessibility,
  AutoScroller,
  Cursor,
  PreventSelection,
  Feedback.configure({feedback: 'move'}),
];

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
    flex: {direction: 'row', justify: 'start', align: 'center', text: 'start', gap: 1},
    children: [],
  }),
};

export type Region = {target: string; label: string; layout: Layout};

export type EditorProps = {
  initial: Layout;
  // every region on the canvas, in render order. one is active, the rest are
  // shown but inert — clicking one activates it.
  regions?: Region[];
  activeTarget?: string;
  dev?: boolean;
  // absent means this shell has no code path to a store at all
  // every region with changes, so switching region cannot lose work
  onSave?: (changed: {target: string; layout: Layout}[]) => void;
  onPublish?: () => void;
  busy?: boolean;
  version?: number;
  initialPalette?: Palette;
  // the shell owns pages; the editor only shows them and reports intent
  pages?: PageEntry[];
  target?: string;
  missing?: boolean;
  onPages?: (intent: string, fields?: Record<string, string>) => void;
  onOpen?: (target: string) => void;
  onSavePalette?: (palette: Palette) => void;
  // draft differs from published. the editor cannot work this out for itself:
  // what it holds is the last save, not what is live.
  unpublished?: boolean;
  error?: string;
};

export function Editor({
  initial,
  regions,
  activeTarget,
  dev,
  onSave,
  onPublish,
  busy,
  version,
  initialPalette,
  pages,
  target,
  missing,
  onPages,
  onOpen,
  onSavePalette,
  unpublished,
  error: outerError,
}: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const afterDrag = useRef(false);
  // a history per region. only one is ever editable, so nothing spans them —
  // that is what keeps this from being three editors in a trenchcoat.
  const [hists, setHists] = useState<Record<string, LayoutHistory>>(() =>
    Object.fromEntries(
      (regions ?? [{target: 'page', layout: initial}]).map((r) => [
        r.target,
        history(r.layout),
      ]),
    ),
  );
  const [active, setActive] = useState(
    () => activeTarget ?? regions?.[0]?.target ?? 'page',
  );

  const hist = hists[active] ?? history(initial);
  const activate = useCallback((target: string) => {
    setActive(target);
    setSelected(null);
    setNode(null);
  }, []);
  const setHist = useCallback(
    (fn: (h: LayoutHistory) => LayoutHistory) =>
      setHists((all) => ({...all, [active]: fn(all[active] ?? history(initial))})),
    [active, initial],
  );
  const [band, setBand] = useState<Band>(WIDEST);
  const [selected, setSelected] = useState<string | null>(null);
  const [node, setNode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [clipped, setClipped] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('editor');
  const [palette, setPalette] = useState(initialPalette ?? DEFAULT_PALETTE);
  // rail-tree drags are their own gesture: no ghost, no cell, no placement
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);
  // dnd-kit reorders the dom mid-drag and does not undo it across groups, so a
  // refused drop needs the tree rebuilt from the model
  const [resync, setResync] = useState(0);

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

  // the active region's grid. `.u-grid` alone would find the header's, and
  // every drag delta and clip measurement would silently use its geometry.
  const gridEl = () =>
    hostRef.current?.querySelector<HTMLElement>('.e-region-active .u-grid') ??
    null;

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
    [band, layout, setHist],
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

  // setHist is rebound on every region switch; an empty dep list here would pin
  // every content edit to whichever region was active on mount
  const edit = useCallback(
    (next: typeof layout) => {
      setError(null);
      setHist((h) => commit(h, next));
    },
    [setHist],
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
      // a pointer over an inert region would otherwise be clamped into the
      // active grid, dropping the block somewhere the pointer never was
      const box = grid.getBoundingClientRect();
      const inside =
        x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      if (!inside) return setPreview(null);

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
      setResync((n) => n + 1);
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
      // the whole rail, not just form elements — a radix slider is a span with
      // a role, so arrows would move the control and the block at once
      if (el?.closest('.e-rail, input, textarea, select, [contenteditable]')) return;
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

  // a drag released outside the block fires its click on a common ancestor,
  // which would clear the selection the drag just acted on
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
      const el = e.target as HTMLElement;
      // an inert region handles its own click by activating itself
      if (!el.closest('.e-region-active')) return;
      const hit = el.closest<HTMLElement>('[data-block]');
      setSelected(hit?.dataset.block ?? null);
    };
    // tabbing onto a block selects it, or its resize handles — which only
    // render for the selection — could never be reached without a mouse
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('.e-region-active')) return;
      const hit = el.closest<HTMLElement>('[data-block]');
      if (hit?.dataset.block) setSelected(hit.dataset.block);
    };

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('click', onClick);
    stage.addEventListener('focusin', onFocusIn);
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('click', onClick);
      stage.removeEventListener('focusin', onFocusIn);
    };
  }, []);


  return (
    <DragDropProvider
      plugins={PLUGINS}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <div className="e-shell">
        <div className="e-stage u-page" ref={hostRef} data-band={band}>
          <div className="e-canvas u-stack">
            {/* inert regions: rendered so the page reads whole, but no chrome,
                no selection and no drag. clicking one makes it the active one. */}
            {(regions ?? []).map((region) => {
              if (region.target === active) return null;
              const layoutOf = hists[region.target]?.present;
              const blocks = layoutOf?.blocks ?? [];
              // an empty region still renders. the storefront hides one, but
              // here it is the only thing there is to click to start writing it.
              return (
                <div
                  key={region.target}
                  className="e-region"
                  data-label={region.label}
                  data-empty={blocks.length ? undefined : ''}
                  role="button"
                  tabIndex={0}
                  onClick={() => activate(region.target)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') activate(region.target);
                  }}
                  style={{order: regions?.indexOf(region)}}
                >
                  {blocks.length && layoutOf ? (
                    <Grid dev={false} palette={palette}>
                      {blocks.map((b) => {
                        const cell = deriveAll(layoutOf).get(b.id);
                        return cell ? <Block key={b.id} block={b} at={cell} /> : null;
                      })}
                    </Grid>
                  ) : null}
                </div>
              );
            })}
            <div
              className="e-region e-region-active"
              data-label={regions?.find((r) => r.target === active)?.label}
              style={{order: regions?.findIndex((r) => r.target === active)}}
            >
            <Grid probes dev={dev} palette={palette}>
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
          onSave={
            onSave
              ? () =>
                  onSave(
                    Object.entries(hists)
                      .filter(([, h]) => h.past.length > 0)
                      .map(([target, h]) => ({target, layout: h.present})),
                  )
              : undefined
          }
          dirty={Object.values(hists).some((h) => h.past.length > 0)}
          regions={regions}
          active={active}
          onActivate={activate}
          onPublish={onPublish}
          busy={busy}
          version={version}
          unpublished={unpublished}
          resync={resync}
          palette={palette}
          pages={pages}
          target={target}
          missing={missing}
          onPages={onPages}
          onOpen={onOpen}
          tab={tab}
          onTab={setTab}
          onPalette={setPalette}
          onSavePalette={onSavePalette ? () => onSavePalette(palette) : undefined}
          error={outerError ?? error}
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
        />
      </div>
    </DragDropProvider>
  );
}
