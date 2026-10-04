import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {ContextMenu, Theme} from '@radix-ui/themes';
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
  COLUMNS,
  commit,
  canRedo,
  canUndo,
  emptyBlock,
  encode,
  findBlock,
  findNode,
  DEFAULT_COLUMNS,
  DEFAULT_COUNT,
  DEFAULT_LOGO_NARROW,
  DEFAULT_LOGO_WIDTH,
  DEFAULT_METRICS,
  DEFAULT_STARS,
  duplicate,
  history,
  metricsDiff,
  metricsFrom,
  insertAfter,
  insertRow,
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
  resetFlex,
  setFlex,
  undo,
  WIDEST,
  type Band,
  type Cell,
  type History as LayoutHistory,
  type Metrics,
  type Node,
  type Settings,
} from '@unigrid/core';
import {
  Block,
  Grid,
  deriveAll,
  ThemeFont,
  metricVars,
  pageIsDark,
  pageVars,
  overflowing,
  sameOverflow,
  type MenuLink,
  type Menus,
  type CollectionData,
  type Collections,
  type MediaUrls,
  type ProductData,
  type Products,
} from '@unigrid/blocks';
import {DragHandles} from './DragHandles';
import {InertLink} from './link';
import {NEW_SPAN} from './Palette';
import {cellAt, gridUnits, moved, resized, snap, type Edge} from './geometry';
import {dropTarget, type NodeDrag} from './Tree';
import {
  Rail,
  type AddKey,
  type PageEntry,
  type PickedMedia,
  type Tab,
  RAIL_THEME,
} from './Rail';
import {DEFAULT_PALETTE, type Layout, type Palette} from '@unigrid/core';
import {readSnapshot, regionFor, type Snapshot} from './snapshot';


const REASON: Record<string, string> = {
  'out-of-bounds': 'outside the grid at this breakpoint',
  'bad-span': 'spans must be whole numbers, 1 or more',
  overlap: 'that cell is occupied',
  'no-such-block': 'block no longer exists',
};

type DragData =
  | {kind: 'move'; block: string}
  | {kind: 'resize'; block: string; edge: Edge}
  | {kind: 'new'}
  | NodeDrag;

// origin is the pointer's position within the grid when the drag began, so the
// delta can be taken against the grid's current box rather than the pointer's
// own transform — the two differ by however far the stage has scrolled.
type Origin = {x: number; y: number};

type Drag =
  | {kind: 'move'; block: string; from: Cell; origin: Origin}
  | {kind: 'resize'; block: string; edge: Edge; from: Cell; origin: Origin}
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

const NEW_NODE: Record<AddKey, (id: string) => Node> = {
  headline: (id) => ({id, kind: 'headline', level: 2, value: 'Headline'}),
  text: (id) => ({id, kind: 'text', size: 'sm', value: 'Body text.'}),
  richText: (id) => ({id, kind: 'richText', size: 'sm', value: 'First line.\nSecond line.'}),
  // no href until one is typed: a new button is a label, not a link to nowhere
  button: (id) => ({id, kind: 'button', variant: 'primary', label: 'Button', href: ''}),
  // no handle until one is picked: the rail lists what the store actually has
  menu: (id) => ({id, kind: 'menu', handle: '', direction: 'row', collapse: false}),
  // one kind, two entries in the palette. bound to the route's own product by
  // default, which is what makes a single template serve the catalogue.
  productMedia: (id) => ({
    id,
    kind: 'product',
    view: 'media',
    source: 'context',
    variant: 'primary',
  }),
  productDetails: (id) => ({
    id,
    kind: 'product',
    view: 'details',
    source: 'context',
    variant: 'primary',
  }),
  // contextual for the same reason: a collection template binds to whatever
  // collection is being browsed
  collection: (id) => ({
    id,
    kind: 'collection',
    source: 'context',
    columns: DEFAULT_COLUMNS,
    narrow: DEFAULT_COLUMNS,
    count: DEFAULT_COUNT,
    variant: 'outline',
  }),
  rating: (id) => ({
    id,
    kind: 'rating',
    stars: DEFAULT_STARS,
    label: '15 Reviews',
  }),
  logo: (id) => ({
    id,
    kind: 'logo',
    width: DEFAULT_LOGO_WIDTH,
    narrow: DEFAULT_LOGO_NARROW,
  }),
  cart: (id) => ({id, kind: 'cart', label: 'Cart'}),
  account: (id) => ({id, kind: 'account', label: 'Account'}),
  group: (id) => ({
    id,
    kind: 'group',
    flex: {direction: 'row', justify: 'start', align: 'center', text: 'start', gap: 1},
    children: [],
  }),
};

export type Region = {target: string; label: string; layout: Layout};

// the store's navigation menus, resolved by the shell. the playground has none.
export type StoreMenu = {handle: string; title: string; items: MenuLink[]};

// a page-level a/b test as the shell sees it. the editor only shows it and
// reports intent; which arm is open, and every write, belong to the shell.
export type AbTest = {
  arm: 'a' | 'b';
  hasB: boolean;
  // b has been published, so the storefront can serve it
  bLive: boolean;
  flag: string;
  // a's saved draft, so b can be reset to it without leaving b
  a: Layout | null;
};

export type EditorProps = {
  initial: Layout;
  // every region on the canvas, in render order. one is active, the rest are
  // shown but inert — clicking one activates it.
  regions?: Region[];
  activeTarget?: string;
  // absent means this shell has no code path to a store at all
  // every region with changes, so switching region cannot lose work
  onSave?: (changed: {target: string; layout: Layout}[]) => void;
  onPublish?: () => void;
  busy?: boolean;
  version?: number;
  initialPalette?: Palette;
  // the theme's measurements. absent is the default, which is what the
  // stylesheet does on its own.
  initialMetrics?: Metrics;
  // the theme's non-numeric settings: the logo image and the page colour
  initialSettings?: Settings;
  onSaveTheme?: (
    palette: Palette,
    metrics: Metrics,
    settings: Settings,
  ) => void;
  menus?: StoreMenu[];
  // the store's products. one hydrates a contextual element so the template can
  // be seen against something; the rest are what a pinned element picks from.
  products?: ProductData[];
  // and the same for collections: one hydrates a contextual repeater, the rest
  // are what a pinned one picks from
  collections?: CollectionData[];
  // gid to url for every file the layout already references, resolved by the
  // shell. absent means a block with a file fill renders nothing, not a broken
  // image.
  media?: MediaUrls;
  // the shell's file picker. the admin app has one through app bridge; the
  // playground has none, and the rail falls back to a url.
  pickMedia?: () => Promise<PickedMedia | null>;
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
  // everything that decides how the page looks, handed to the shell to keep.
  // the playground downloads it; the admin app has save instead.
  onExport?: (snapshot: Snapshot) => void;
  test?: AbTest;
  onTest?: (intent: 'create' | 'arm' | 'flag' | 'rollout', value?: string) => void;
  // the playground has no store, so its test lives in memory, here
  memoryTest?: boolean;
};

export type {Snapshot};

export function Editor({
  initial,
  regions,
  activeTarget,
  onSave,
  onPublish,
  busy,
  version,
  initialPalette,
  initialMetrics,
  initialSettings,
  onSaveTheme,
  menus,
  products,
  collections,
  media,
  pickMedia,
  pages,
  target,
  missing,
  onPages,
  onOpen,
  onSavePalette,
  unpublished,
  error: outerError,
  onExport,
  test: shellTest,
  onTest: shellOnTest,
  memoryTest,
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
  // which product or collection hydrates a contextual element. url state, never
  const [viewAs, setViewAs] = useState<string | null>(null);
  // a file picked during this session is not in the loader's map yet, so its url
  // is kept here until the next save reloads one
  const [pickedMedia, setPickedMedia] = useState<MediaUrls>({});
  const [tab, setTab] = useState<Tab>('editor');
  const [palette, setPalette] = useState(initialPalette ?? DEFAULT_PALETTE);
  const [metrics, setMetrics] = useState(initialMetrics ?? DEFAULT_METRICS);
  const [settings, setSettings] = useState<Settings>(initialSettings ?? {});
  const resolved: Menus = useMemo(
    () => Object.fromEntries((menus ?? []).map((m) => [m.handle, m.items])),
    [menus],
  );
  const byHandle: Products = useMemo(
    () => Object.fromEntries((products ?? []).map((p) => [p.handle, p])),
    [products],
  );
  const byCollection: Collections = useMemo(
    () => Object.fromEntries((collections ?? []).map((c) => [c.handle, c])),
    [collections],
  );
  // the preview never reaches the layout, so falling back to the first is safe
  const previewProduct =
    products?.find((p) => p.handle === viewAs) ?? products?.[0];
  const previewCollection =
    collections?.find((c) => c.handle === viewAs) ?? collections?.[0];
  const mediaUrls = useMemo(
    () => ({...media, ...pickedMedia}),
    [media, pickedMedia],
  );
  // the theme's mark, resolved from the same map a block fill uses. picking a
  // new one puts its url in there, so the stage updates before any save.
  const themeLogo = useMemo(() => {
    const url = settings.logo ? mediaUrls[settings.logo] : undefined;
    return url ? {url} : undefined;
  }, [settings.logo, mediaUrls]);
  // the shell resolves the url; remembering it is the editor's job
  const onPickMedia = pickMedia
    ? async () => {
        const file = await pickMedia();
        if (file) setPickedMedia((m) => ({...m, [file.id]: file.url}));
        return file;
      }
    : undefined;
  // rail-tree drags are their own gesture: no ghost, no cell, no placement
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);
  // dnd-kit reorders the dom mid-drag and does not undo it across groups, so a
  // refused drop needs the tree rebuilt from the model
  const [resync, setResync] = useState(0);

  const layout = hist.present;

  // against what the shell last loaded, not against undo history: a save
  // reloads the regions but keeps the history, so past alone would stay dirty
  const unsaved = useMemo(
    () =>
      (regions ?? []).some(
        (r) => encode(hists[r.target]?.present ?? r.layout) !== encode(r.layout),
      ),
    [regions, hists],
  );

  // the arm not on screen, parked whole so its undo history survives a switch
  const [memo, setMemo] = useState<{
    arm: 'a' | 'b';
    parked: LayoutHistory | null;
    flag: string;
  }>({arm: 'a', parked: null, flag: ''});
  const page = target ?? activeTarget ?? active;
  const test: AbTest | undefined = memoryTest
    ? {
        arm: memo.arm,
        hasB: memo.parked !== null,
        bLive: true,
        flag: memo.flag,
        a: memo.arm === 'b' ? (memo.parked?.present ?? null) : null,
      }
    : shellTest;
  const onTest: EditorProps['onTest'] = memoryTest
    ? (intent, value = '') => {
        const here = hists[page] ?? history(initial);
        if (intent === 'create') setMemo((m) => ({...m, parked: history(here.present)}));
        if (intent === 'flag') setMemo((m) => ({...m, flag: value}));
        // the open arm is kept either way, so roll out only forgets the other
        if (intent === 'rollout') setMemo({arm: 'a', parked: null, flag: ''});
        if (intent === 'arm' && value !== memo.arm && memo.parked) {
          const parked = memo.parked;
          setHists((all) => ({...all, [page]: parked}));
          setMemo((m) => ({...m, arm: value as 'a' | 'b', parked: here}));
          activate(page);
        }
      }
    : shellOnTest;

  // one commit on the page's own region, so it is a single undo away
  const copyA = () => {
    const into = page;
    if (!test?.a) return;
    const from = test.a;
    setHists((all) => ({...all, [into]: commit(all[into] ?? history(initial), from)}));
    activate(into);
    setError(null);
  };
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
    const as = params.get('as');
    if (isBand(b)) setBand(b);
    if (s) setSelected(s);
    if (as) setViewAs(as);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('band', band);
    if (selected) params.set('sel', selected);
    else params.delete('sel');
    if (viewAs) params.set('as', viewAs);
    else params.delete('as');
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [band, selected, viewAs]);

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

  // a commit per region, so the import is one undo away and save sees it as a
  // change. the theme is replaced in memory only; save theme is what keeps it.
  const importFile = async (file: File) => {
    const snapshot = readSnapshot(await file.text());
    if (!snapshot) {
      setError('That file is not a unigrid export');
      return;
    }
    setHists((all) =>
      Object.fromEntries(
        Object.entries(all).map(([t, h]) => {
          const next = regionFor(snapshot, t);
          return [t, next ? commit(h, next) : h];
        }),
      ),
    );
    setPalette(snapshot.palette);
    setMetrics(metricsFrom(snapshot.metrics));
    // a mockup rarely carries the store's logo, and losing it would be silent
    setSettings((s) => ({
      ...snapshot.settings,
      ...(!snapshot.settings.logo && s.logo ? {logo: s.logo} : {}),
    }));
    setSelected(null);
    setNode(null);
    setError(null);
  };

  const addChild = (key: AddKey, parentId: string | null) => {
    if (!selected) return;
    const id = nextId((x) => Boolean(findNode(layout, x)), key);
    edit(addNode(layout, selected, parentId, NEW_NODE[key](id)));
    setNode(id);
  };

  const duplicateBlock = (id: string) => {
    const out = duplicate(layout, id);
    if (!out) return;
    setError(null);
    setHist((h) => commit(h, out.layout));
    setSelected(out.id);
    setNode(null);
  };

  const deleteBlock = (id: string) => {
    setError(null);
    setHist((h) => commit(h, remove(layout, id)));
    setSelected(null);
    setNode(null);
  };

  const addRow = (row: number) => {
    setError(null);
    setHist((h) => commit(h, insertRow(layout, row)));
  };

  // the palette's size where it fits, shrunk where it does not: refusing a
  // click on visibly empty space would read as broken
  const addFitted = (spot: {col: number; row: number}) => {
    const cols = COLUMNS[band];
    let best: Cell | null = null;
    for (let colSpan = Math.min(NEW_SPAN.colSpan, cols); colSpan >= 1; colSpan--) {
      for (let rowSpan = NEW_SPAN.rowSpan; rowSpan >= 1; rowSpan--) {
        if (best && best.colSpan * best.rowSpan >= colSpan * rowSpan) continue;
        const c = {col: Math.min(spot.col, cols - colSpan + 1), row: spot.row, colSpan, rowSpan};
        const free = layout.blocks.every((b) => {
          const other = cellOf(b.id);
          return !other || !overlaps(c, other);
        });
        if (free) best = c;
      }
    }
    if (!best) return setError(REASON.overlap ?? null);
    addAt(best);
  };

  // what was under the pointer when the menu opened. a block, or an empty cell
  const [menu, setMenu] = useState<{block: string | null; col: number; row: number} | null>(
    null,
  );
  const onContextMenu = (e: ReactMouseEvent) => {
    const hit =
      (e.target as HTMLElement).closest<HTMLElement>('[data-block]')?.dataset.block ?? null;
    if (hit) setSelected(hit);
    const grid = gridEl();
    const u = grid ? gridUnits(grid) : null;
    const spot = grid && u ? cellAt(grid, e.clientX, e.clientY, u, 1) : {col: 1, row: 1};
    setMenu({block: hit, ...spot});
  };
  const menuBlock = menu?.block ? findBlock(layout, menu.block) : undefined;
  // rows are inserted in the wide band only: the narrow ones derive from it and
  // hold no gaps of their own to insert into
  const rowLine = menuBlock
    ? menuBlock.at.a.row + menuBlock.at.a.rowSpan
    : menu
      ? menu.row + 1
      : 1;

  // read off the manager, not the event: the event's transform is a snapshot,
  // refreshed only when the live getter is read, and feedback is off here
  const onDragStart = (_event: unknown, manager: DragDropManager) => {
    const data = manager.dragOperation.source?.data as DragData | undefined;
    if (!data) return;
    if (data.kind === 'node') return setNodeDrag(data);
    if (data.kind === 'new') return setDrag({kind: 'new'});

    const from = cellOf(data.block);
    if (!from) return;
    const grid = gridEl();
    if (!grid) return;
    const box = grid.getBoundingClientRect();
    const at = manager.dragOperation.position.current;
    const origin = {x: at.x - box.left, y: at.y - box.top};
    setSelected(data.block);
    setError(null);
    setDrag(
      data.kind === 'move'
        ? {kind: 'move', block: data.block, from, origin}
        : {kind: 'resize', block: data.block, edge: data.edge, from, origin},
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

    // against the grid's box now, not the pointer's transform: scrolling the
    // stage moves the grid under a pointer that has not moved, and a transform
    // cannot see that — the block stopped following the cursor mid-scroll
    const box = grid.getBoundingClientRect();
    const at = operation.position.current;
    const {dCol, dRow} = snap(
      at.x - box.left - drag.origin.x,
      at.y - box.top - drag.origin.y,
      u,
    );
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
      // an open menu owns its arrows too
      if (el?.closest('.e-rail, input, textarea, select, [contenteditable], [role="menu"]')) return;
      if (e.key === 'Escape') return setSelected(null);
      // dnd-kit owns the arrows once a keyboard drag is up
      if (drag || !selected || !editable) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        return duplicateBlock(selected);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        return deleteBlock(selected);
      }

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
    // the handlers close over the layout, so they are rebound with it
  }, [drag, editable, move, selected, layout]);

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
        <div
          className="e-stage u-page"
          ref={hostRef}
          data-band={band}
          data-page-dark={pageIsDark(palette, settings) ? '' : undefined}
          style={
            {
              ...metricVars(metrics),
              ...pageVars(palette, settings),
            } as CSSProperties
          }
        >
          <ThemeFont settings={settings} />
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
                    <Grid
                      link={InertLink}
                      menus={resolved}
                      product={previewProduct}
                      products={byHandle}
                      collection={previewCollection}
                      collections={byCollection}
                      media={mediaUrls}
                      logo={themeLogo}
                      palette={palette}
                      metrics={metrics}
                    >
                      {blocks.map((b) => {
                        const cell = deriveAll(layoutOf).get(b.id);
                        return cell ? <Block key={b.id} block={b} at={cell} /> : null;
                      })}
                    </Grid>
                  ) : null}
                </div>
              );
            })}
            <ContextMenu.Root>
            <ContextMenu.Trigger onContextMenu={onContextMenu}>
            <div
              className="e-region e-region-active"
              data-label={regions?.find((r) => r.target === active)?.label}
              style={{order: regions?.findIndex((r) => r.target === active)}}
            >
            <Grid
              probes
              link={InertLink}
              menus={resolved}
              product={previewProduct}
              products={byHandle}
              collection={previewCollection}
              collections={byCollection}
              media={mediaUrls}
              logo={themeLogo}
              palette={palette}
              metrics={metrics}
            >
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
            </ContextMenu.Trigger>
            {/* the stage has no theme on purpose, so its reset cannot reach a
                block. the menu brings its own. */}
            <Theme asChild {...RAIL_THEME}>
            {/* focus returning to the clicked block would reselect it over a copy */}
            <ContextMenu.Content
              size="1"
              className="e-menu"
              onCloseAutoFocus={(e) => e.preventDefault()}>
              {menuBlock ? (
                <>
                  <ContextMenu.Item shortcut="⌘ D" onSelect={() => duplicateBlock(menuBlock.id)}>
                    Duplicate
                  </ContextMenu.Item>
                  <ContextMenu.Item disabled={band !== WIDEST} onSelect={() => addRow(rowLine)}>
                    Add row below
                  </ContextMenu.Item>
                  <ContextMenu.Separator />
                  <ContextMenu.Item
                    color="red"
                    shortcut="⌫"
                    onSelect={() => deleteBlock(menuBlock.id)}
                  >
                    Delete
                  </ContextMenu.Item>
                </>
              ) : (
                <>
                  <ContextMenu.Item onSelect={() => menu && addFitted(menu)}>
                    Add block
                  </ContextMenu.Item>
                  <ContextMenu.Item disabled={band !== WIDEST} onSelect={() => addRow(rowLine)}>
                    Add row below
                  </ContextMenu.Item>
                </>
              )}
            </ContextMenu.Content>
            </Theme>
            </ContextMenu.Root>
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
          menus={menus}
          products={products}
          collections={collections}
          viewAs={viewAs ?? undefined}
          onViewAs={setViewAs}
          media={mediaUrls}
          onPickMedia={onPickMedia}
          pages={pages}
          target={target}
          missing={missing}
          onPages={onPages}
          onOpen={onOpen}
          tab={tab}
          onTab={setTab}
          metrics={metrics}
          onMetrics={setMetrics}
          settings={settings}
          onSettings={setSettings}
          onPalette={setPalette}
          onSavePalette={
            onSaveTheme
              ? () => onSaveTheme(palette, metrics, settings)
              : onSavePalette
                ? () => onSavePalette(palette)
                : undefined
          }
          error={outerError ?? error}
          bytes={bytes}
          onExport={
            onExport
              ? () =>
                  onExport({
                    regions: Object.fromEntries(
                      Object.entries(hists).map(([t, h]) => [t, h.present]),
                    ),
                    palette,
                    metrics: metricsDiff(metrics),
                    settings,
                  })
              : undefined
          }
          onImport={onExport ? importFile : undefined}
          test={test}
          onTest={onTest}
          onCopyA={test?.arm === 'b' && test.a ? copyA : undefined}
          // nothing in memory is ever saved, so nothing waits on a save
          unsaved={memoryTest ? false : unsaved}
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
          onFlex={(id, patch) => edit(setFlex(layout, id, patch, band))}
          onResetFlex={(id) => edit(resetFlex(layout, id))}
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
            if (selected) deleteBlock(selected);
          }}
          onUndo={() => setHist(undo)}
          onRedo={() => setHist(redo)}
        />
      </div>
    </DragDropProvider>
  );
}
