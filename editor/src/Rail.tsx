import {
  Badge,
  Box,
  Button,
  Callout,
  Flex,
  Grid,
  Heading,
  Select,
  Slider,
  Switch,
  Text,
  TextArea,
  TextField,
  SegmentedControl,
  Tabs,
  Separator,
  Theme,
} from '@radix-ui/themes';
import {
  BANDS,
  DEFAULT_METRICS,
  LOGO_RANGE,
  METRIC_RANGE,
  divisorsOf,
  isMediaRef,
  fitCount,
  fitNarrow,
  isSlot,
  SLOTS,
  isGroup,
  WIDEST,
  type Band,
  type Block,
  type Cell,
  type Colour,
  type Columns,
  type Element,
  type ElementKind,
  type Fill,
  type Flex as FlexModel,
  type Found,
  type Group,
  type Layout,
  type MediaKind,
  type Metrics,
  type Palette as ThemePalette,
  type Settings,
} from '@unigrid/core';
import {useState} from 'react';
import {Palette} from './Palette';
import {Tree, type NodeDrag} from './Tree';

const AXES = [
  {key: 'col', label: 'Col'},
  {key: 'colSpan', label: 'Span'},
  {key: 'row', label: 'Row'},
  {key: 'rowSpan', label: 'Rows'},
] as const;

const DIRECTION = ['column', 'row'] as const;
const JUSTIFY = ['start', 'center', 'end', 'between'] as const;
const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const LEVELS = ['1', '2', '3', '4', '5'] as const;
const SIZES = ['sm', 'lg'] as const;
const VARIANTS = ['primary', 'outline', 'glass'] as const;
const MENU_DIRECTIONS = ['row', 'column'] as const;
const PRODUCT_VIEWS = ['media', 'details'] as const;
const COLUMN_CHOICES = ['1', '2', '3', '4', '5', '6'] as const;
// eight rows is already more than any block on screen can show
const PAGE_ROWS = [1, 2, 3, 4, 5, 6, 8, 10];

// a key, not a kind: product is two entries here and one kind in the model
export type AddKey =
  | Exclude<ElementKind, 'product'>
  | 'group'
  | 'productMedia'
  | 'productDetails'
  | 'collection';

const ADDABLE: AddKey[] = [
  'headline',
  'text',
  'richText',
  'button',
  'menu',
  'productMedia',
  'productDetails',
  'collection',
  'logo',
  'cart',
  'account',
  'group',
];

export const LABEL: Record<string, string> = {
  headline: 'Headline',
  text: 'Text',
  richText: 'Rich text',
  button: 'Button',
  menu: 'Menu',
  product: 'Product',
  productMedia: 'Product carousel',
  productDetails: 'Product details',
  collection: 'Collection',
  logo: 'Logo',
  cart: 'Cart',
  account: 'Account',
  group: 'Group',
};

export type MenuEntry = {handle: string; title: string};
export type ProductEntry = {handle: string; title: string};
export type CollectionEntry = {handle: string; title: string};

// what the shell's file picker hands back. the editor is shared with the
// playground, which has no app bridge, so the picker is injected or absent.
export type PickedMedia = {id: string; url: string; kind: MediaKind};

export type RailProps = {
  layout: Layout;
  band: Band;
  selected: string | null;
  authored: Cell | undefined;
  editable: Cell | undefined;
  clipped: number;
  block: Block | undefined;
  node: Found | undefined;
  dragging: NodeDrag | null;
  resync: number;
  palette: ThemePalette;
  // the store's navigation menus, for the menu element's picker
  menus?: MenuEntry[];
  // the store's products, for pinning one to a product element
  products?: ProductEntry[];
  // the store's collections, for pinning one to a repeater
  collections?: CollectionEntry[];
  // which one hydrates the preview. url state on the editor's side, so it can
  // never reach a block.
  viewAs?: string;
  onViewAs?: (handle: string) => void;
  // gid to url, for the thumbnail beside the picker
  media?: Record<string, string>;
  onPickMedia?: () => Promise<PickedMedia | null>;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onPalette?: (palette: ThemePalette) => void;
  metrics: Metrics;
  onMetrics?: (metrics: Metrics) => void;
  settings: Settings;
  onSettings?: (settings: Settings) => void;
  pages?: PageEntry[];
  target?: string;
  missing?: boolean;
  onPages?: (intent: string, fields?: Record<string, string>) => void;
  // injected, because this package must not reach for a router
  onOpen?: (target: string) => void;
  dirty?: boolean;
  regions?: {target: string; label: string}[];
  active?: string;
  onActivate?: (target: string) => void;
  onSavePalette?: () => void;
  // absent in the playground, present in the admin app
  onSave?: () => void;
  onPublish?: () => void;
  busy?: boolean;
  version?: number;
  unpublished?: boolean;
  error: string | null;
  bytes: number;
  canUndo: boolean;
  canRedo: boolean;
  onBand: (band: Band) => void;
  onSelect: (id: string | null) => void;
  onCell: (patch: Partial<Cell>) => void;
  onFit: () => void;
  onReset: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPickNode: (id: string | null) => void;
  onAddChild: (key: AddKey, parentId: string | null) => void;
  onPatchNode: (id: string, patch: Partial<Element> | Partial<Group>) => void;
  onMoveNode: (id: string, delta: number) => void;
  onRemoveNode: (id: string) => void;
  onPatchBlock: (
    patch: Partial<Pick<Block, 'fill' | 'flex' | 'invert'>>,
  ) => void;
  onFlex: (id: string, patch: Partial<FlexModel>) => void;
};

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <Box>
      <Text as="label" size="1" color="gray" mb="1" style={{display: 'block'}}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box p="3">
      <Heading
        as="h3"
        size="1"
        mb="2"
        color="gray"
        style={{letterSpacing: '0.08em'}}
      >
        {title.toUpperCase()}
      </Heading>
      <Flex direction="column" gap="3">
        {children}
      </Flex>
      <Separator size="4" mt="3" />
    </Box>
  );
}

function Segment<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onPick: (next: T) => void;
}) {
  return (
    <Field label={label}>
      <SegmentedControl.Root
        size="1"
        value={value}
        onValueChange={(v) => onPick(v as T)}
        style={{width: '100%'}}
      >
        {options.map((o) => (
          <SegmentedControl.Item key={o} value={o}>
            {o}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </Field>
  );
}

function FlexFields({
  flex,
  onChange,
}: {
  flex: FlexModel;
  onChange: (patch: Partial<FlexModel>) => void;
}) {
  return (
    <>
      <Segment
        label="Direction"
        value={flex.direction}
        options={DIRECTION}
        onPick={(direction) => onChange({direction})}
      />
      <Segment
        label="Justify"
        value={flex.justify}
        options={JUSTIFY}
        onPick={(justify) => onChange({justify})}
      />
      <Segment
        label="Align"
        value={flex.align}
        options={ALIGN}
        onPick={(align) => onChange({align})}
      />
      <Field label={`Gap — ${flex.gap}`}>
        <Slider
          size="1"
          min={0}
          max={8}
          step={1}
          value={[flex.gap]}
          onValueChange={([gap]) => onChange({gap: gap ?? 0})}
        />
      </Field>
    </>
  );
}

function AddMenu({
  parentId,
  onAdd,
}: {
  parentId: string | null;
  onAdd: (key: AddKey, parentId: string | null) => void;
}) {
  // a group takes elements only, so it is never offered inside one
  const offer = parentId ? ADDABLE.filter((k) => k !== 'group') : ADDABLE;
  return (
    <Flex gap="1" wrap="wrap">
      {offer.map((key) => (
        <Button
          key={key}
          size="1"
          variant="soft"
          onClick={() => onAdd(key, parentId)}
        >
          + {LABEL[key]}
        </Button>
      ))}
    </Flex>
  );
}

function Inspector({found, props}: {found: Found; props: RailProps}) {
  const {node} = found;

  if (isGroup(node)) {
    return (
      <>
        <FlexFields
          flex={node.flex}
          onChange={(p) => props.onFlex(node.id, p)}
        />
        <AddMenu parentId={node.id} onAdd={props.onAddChild} />
      </>
    );
  }

  const patch = (p: Partial<Element>) => props.onPatchNode(node.id, p);

  if (node.kind === 'menu') {
    const menus = props.menus ?? [];
    return (
      <>
        <Field label="Menu">
          <Select.Root
            size="1"
            value={node.handle || undefined}
            onValueChange={(handle) => patch({handle})}
          >
            <Select.Trigger
              placeholder="Choose a menu"
              style={{width: '100%'}}
            />
            <Select.Content>
              {menus.map((m) => (
                <Select.Item key={m.handle} value={m.handle}>
                  {m.title}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field>
        <Segment
          label="Direction"
          value={node.direction}
          options={MENU_DIRECTIONS}
          onPick={(direction) => patch({direction})}
        />
        <Field label="Collapse on mobile">
          <Switch
            size="1"
            checked={node.collapse}
            onCheckedChange={(collapse) => patch({collapse})}
          />
        </Field>
        {node.handle && !menus.some((m) => m.handle === node.handle) ? (
          <Text size="1" color="orange">
            no menu called “{node.handle}” in this store
          </Text>
        ) : null}
      </>
    );
  }

  if (node.kind === 'product') {
    const products = props.products ?? [];
    const handle = node.source === 'context' ? '' : node.source.handle;
    const pinned = node.source !== 'context';
    // only a product template renders a product of its own; anywhere else a
    // contextual element has nothing to bind to
    const contextual = props.target === 'product';
    return (
      <>
        <Segment
          label="Shows"
          value={node.view}
          options={PRODUCT_VIEWS}
          onPick={(view) => patch({view})}
        />
        {node.view === 'details' ? (
          <Segment
            label="Buy button"
            value={node.variant}
            options={VARIANTS}
            onPick={(variant) => patch({variant})}
          />
        ) : null}
        <Field label="Product">
          <SegmentedControl.Root
            size="1"
            value={pinned ? 'pick' : 'context'}
            onValueChange={(v) =>
              patch({source: v === 'pick' ? {handle: ''} : 'context'})
            }
            style={{width: '100%'}}
          >
            <SegmentedControl.Item value="context">
              On this page
            </SegmentedControl.Item>
            <SegmentedControl.Item value="pick">Pick one</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Field>
        {pinned ? (
          <Select.Root
            size="1"
            value={handle || undefined}
            onValueChange={(h) => patch({source: {handle: h}})}
          >
            <Select.Trigger
              placeholder="Choose a product"
              style={{width: '100%'}}
            />
            <Select.Content>
              {products.map((p) => (
                <Select.Item key={p.handle} value={p.handle}>
                  {p.title}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        ) : null}
        {!pinned && !contextual ? (
          <Text size="1" color="orange">
            this page has no product of its own — showing a preview
          </Text>
        ) : null}
        {pinned && handle && !products.some((p) => p.handle === handle) ? (
          <Text size="1" color="orange">
            no product called “{handle}” in this store
          </Text>
        ) : null}
      </>
    );
  }

  if (node.kind === 'logo') {
    return (
      <>
        <Text size="1" color="gray">
          The image is set under Theme, so one logo serves every page.
        </Text>
        <Field label={`Max width — ${node.width}u`}>
          <Slider
            size="1"
            min={LOGO_RANGE[0]}
            max={LOGO_RANGE[1]}
            step={LOGO_RANGE[2]}
            value={[node.width]}
            onValueChange={([width]) => patch({width: width ?? node.width})}
          />
        </Field>
        <Field label={`Max width on mobile — ${node.narrow}u`}>
          <Slider
            size="1"
            min={LOGO_RANGE[0]}
            max={LOGO_RANGE[1]}
            step={LOGO_RANGE[2]}
            value={[node.narrow]}
            onValueChange={([narrow]) => patch({narrow: narrow ?? node.narrow})}
          />
        </Field>
      </>
    );
  }

  if (node.kind === 'collection') {
    const rows = node.count / node.columns;
    const collections = props.collections ?? [];
    const handle = node.source === 'context' ? '' : node.source.handle;
    const pinned = node.source !== 'context';
    // only a collection template browses one of its own
    const contextual = props.target === 'collection';
    return (
      <>
        <Field label="Collection">
          <SegmentedControl.Root
            size="1"
            value={pinned ? 'pick' : 'context'}
            onValueChange={(v) =>
              patch({source: v === 'pick' ? {handle: ''} : 'context'})
            }
            style={{width: '100%'}}
          >
            <SegmentedControl.Item value="context">
              On this page
            </SegmentedControl.Item>
            <SegmentedControl.Item value="pick">Pick one</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Field>
        {pinned ? (
          <Select.Root
            size="1"
            value={handle || undefined}
            onValueChange={(h) => patch({source: {handle: h}})}
          >
            <Select.Trigger
              placeholder="Choose a collection"
              style={{width: '100%'}}
            />
            <Select.Content>
              {collections.map((c) => (
                <Select.Item key={c.handle} value={c.handle}>
                  {c.title}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        ) : null}
        {!pinned && !contextual ? (
          <Text size="1" color="orange">
            this page browses no collection of its own — showing a preview
          </Text>
        ) : null}
        {pinned && handle && !collections.some((c) => c.handle === handle) ? (
          <Text size="1" color="orange">
            no collection called “{handle}” in this store
          </Text>
        ) : null}
        <Segment
          label="Columns"
          value={String(node.columns) as (typeof COLUMN_CHOICES)[number]}
          options={COLUMN_CHOICES}
          onPick={(c) => {
            const columns = Number(c) as Columns;
            // the count is a whole number of rows, so a new grid re-fits it
            // rather than leaving every page ragged. the narrow band goes with
            // it: it has to keep dividing the wide one.
            patch({
              columns,
              narrow: fitNarrow(node.narrow, columns),
              count: fitCount(node.count, columns),
            });
          }}
        />
        {divisorsOf(node.columns).length > 1 ? (
          <Segment
            label="Columns on mobile"
            value={String(node.narrow)}
            options={divisorsOf(node.columns).map(String)}
            onPick={(c) => patch({narrow: Number(c) as Columns})}
          />
        ) : null}
        <Segment
          label="Pager buttons"
          value={node.variant}
          options={VARIANTS}
          onPick={(variant) => patch({variant})}
        />
        <Field label="Rows per page">
          <Select.Root
            size="1"
            value={String(rows)}
            onValueChange={(r) => patch({count: Number(r) * node.columns})}
          >
            <Select.Trigger placeholder="Rows" style={{width: '100%'}} />
            <Select.Content>
              {PAGE_ROWS.map((r) => (
                <Select.Item key={r} value={String(r)}>
                  {r}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field>
      </>
    );
  }

  return (
    <>
      {node.kind === 'headline' ? (
        <Segment
          label="Level"
          value={String(node.level) as (typeof LEVELS)[number]}
          options={LEVELS}
          onPick={(l) => patch({level: Number(l) as 1 | 2 | 3 | 4 | 5})}
        />
      ) : null}
      {node.kind === 'text' || node.kind === 'richText' ? (
        <Segment
          label="Size"
          value={node.size}
          options={SIZES}
          onPick={(size) => patch({size})}
        />
      ) : null}
      {node.kind === 'button' ? (
        <Segment
          label="Style"
          value={node.variant}
          options={VARIANTS}
          onPick={(variant) => patch({variant})}
        />
      ) : null}

      <Field label={'label' in node ? 'Label' : 'Content'}>
        {node.kind === 'richText' ? (
          <TextArea
            size="1"
            rows={5}
            value={node.value}
            onChange={(e) => patch({value: e.target.value})}
          />
        ) : (
          <TextField.Root
            size="1"
            value={'label' in node ? node.label : node.value}
            onChange={(e) =>
              patch(
                'label' in node
                  ? {label: e.target.value}
                  : {value: e.target.value},
              )
            }
          />
        )}
      </Field>

      {node.kind === 'button' ? (
        <Field label="Link">
          <Flex direction="column" gap="1">
            <TextField.Root
              size="1"
              placeholder="https://… or /pages/…"
              value={node.href}
              onChange={(e) => patch({href: e.target.value})}
            />
            <LinkPicker
              props={props}
              href={node.href}
              onPick={(href) => patch({href})}
            />
          </Flex>
        </Field>
      ) : null}
    </>
  );
}

// the picker when the shell has one, a url when it does not. the playground is
// the second case: no app bridge, so nothing can open the store's files.
// the store's own destinations, written into the href as a path. a reference
// would survive a handle change, but shopify writes a redirect when a handle
// changes, so the path does not rot — and this needs no model, no wire and no
// resolution on the storefront.
function LinkPicker({
  props,
  href,
  onPick,
}: {
  props: RailProps;
  href: string;
  onPick: (href: string) => void;
}) {
  const groups: {label: string; items: {path: string; title: string}[]}[] = [
    {
      label: 'Pages',
      items: [
        ...(props.pages ?? [])
          .filter((page) => page.target === 'home')
          .map((page) => ({path: '/', title: page.title})),
        ...(props.pages ?? [])
          .filter((page) => page.handle)
          .map((page) => ({path: `/pages/${page.handle}`, title: page.title})),
      ],
    },
    {
      label: 'Products',
      items: (props.products ?? []).map((p) => ({
        path: `/products/${p.handle}`,
        title: p.title,
      })),
    },
    {
      label: 'Collections',
      items: (props.collections ?? []).map((c) => ({
        path: `/collections/${c.handle}`,
        title: c.title,
      })),
    },
  ].filter((group) => group.items.length);

  if (!groups.length) return null;
  // the path is the value, so a hand-typed href that happens to match shows as
  // chosen rather than the two disagreeing
  const known = groups.some((g) => g.items.some((i) => i.path === href));

  return (
    <Select.Root
      size="1"
      value={known ? href : ''}
      onValueChange={(path) => onPick(path)}
    >
      <Select.Trigger placeholder="or choose one…" style={{width: '100%'}} />
      <Select.Content>
        {groups.map((group) => (
          <Select.Group key={group.label}>
            <Select.Label>{group.label}</Select.Label>
            {group.items.map((item) => (
              <Select.Item key={item.path} value={item.path}>
                {item.title}
              </Select.Item>
            ))}
          </Select.Group>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

function MediaField({
  props,
  fill,
  setFill,
}: {
  props: RailProps;
  fill: Fill;
  setFill: (patch: Partial<Fill>) => void;
}) {
  const {media} = fill;
  const src = media
    ? isMediaRef(media)
      ? props.media?.[media.id]
      : media.src
    : undefined;

  const preview = (
    <>
      {src ? (
        <img
          src={src}
          alt=""
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 9',
            objectFit: 'cover',
            borderRadius: 'var(--radius-2)',
          }}
        />
      ) : null}
      {media && isMediaRef(media) && !src ? (
        <Text size="1" color="orange">
          this file is no longer in the store
        </Text>
      ) : null}
    </>
  );

  if (!props.onPickMedia) {
    return (
      <>
        <TextField.Root
          size="1"
          placeholder="https://…"
          value={media && !isMediaRef(media) ? media.src : ''}
          onChange={(e) => {
            const value = e.target.value;
            setFill({
              media: value
                ? {
                    kind: /\.(mp4|webm|mov)(\?|$)/i.test(value)
                      ? 'video'
                      : 'image',
                    src: value,
                  }
                : undefined,
            });
          }}
        />
        {/* a reference cannot be typed, so without this there is no way to
            remove one from a shell that has no picker */}
        {media && isMediaRef(media) ? (
          <Button
            size="1"
            variant="ghost"
            onClick={() => setFill({media: undefined})}
          >
            Clear file
          </Button>
        ) : null}
        {preview}
      </>
    );
  }

  return (
    <>
      <Flex gap="2" align="center" wrap="wrap">
        <Button
          size="1"
          variant="soft"
          onClick={async () => {
            const picked = await props.onPickMedia?.();
            if (picked) setFill({media: {kind: picked.kind, id: picked.id}});
          }}
        >
          {media ? 'Replace' : 'Choose file'}
        </Button>
        {media ? (
          <Button
            size="1"
            variant="ghost"
            onClick={() => setFill({media: undefined})}
          >
            Clear
          </Button>
        ) : null}
      </Flex>
      {preview}
    </>
  );
}

function Swatches({
  value,
  palette,
  onPick,
}: {
  value: Colour | undefined;
  palette: ThemePalette;
  onPick: (next: Colour) => void;
}) {
  return (
    <Flex gap="2" align="center" wrap="wrap">
      {SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          className="e-roundel"
          aria-label={`Theme colour ${slot}`}
          aria-pressed={value && isSlot(value) && value.slot === slot}
          style={{background: palette[slot]}}
          onClick={() => onPick({slot})}
        />
      ))}
      {/* typing a hex leaves the palette behind, which is the point of having
          both — the roundel is a link to the theme, the field is a one-off */}
      <input
        className="e-swatch"
        type="color"
        aria-label="Custom colour"
        value={value && !isSlot(value) ? value.hex : '#ffffff'}
        onChange={(e) => onPick({hex: e.target.value})}
      />
    </Flex>
  );
}

function Appearance({block, props}: {block: Block; props: RailProps}) {
  const fill = block.fill;
  const setFill = (patch: Partial<Fill>) =>
    props.onPatchBlock({fill: {...fill, ...patch}});

  return (
    <>
      <Field label="Background">
        <Flex gap="2" align="center" wrap="wrap">
          <Swatches
            value={fill.color}
            palette={props.palette}
            onPick={(color) => setFill({color})}
          />
          <Button
            size="1"
            variant="soft"
            onClick={() => setFill({color: undefined})}
          >
            Clear
          </Button>
        </Flex>
      </Field>

      <Field label="Background file">
        <MediaField props={props} fill={fill} setFill={setFill} />
      </Field>

      <Field label="Overlay">
        <Flex gap="2" align="center" wrap="wrap">
          <Swatches
            value={fill.overlay?.color}
            palette={props.palette}
            onPick={(color) =>
              setFill({overlay: {color, opacity: fill.overlay?.opacity ?? 0.4}})
            }
          />
          <Button
            size="1"
            variant="soft"
            onClick={() => setFill({overlay: undefined})}
          >
            Clear
          </Button>
        </Flex>
      </Field>

      {fill.overlay ? (
        <Field label={`Opacity — ${Math.round(fill.overlay.opacity * 100)}%`}>
          <Slider
            size="1"
            min={0}
            max={100}
            step={1}
            value={[Math.round(fill.overlay.opacity * 100)]}
            onValueChange={([v]) =>
              setFill({
                overlay: {
                  color: fill.overlay?.color ?? {hex: '#000000'},
                  opacity: (v ?? 0) / 100,
                },
              })
            }
          />
        </Field>
      ) : null}

      <Flex gap="2" align="center">
        <Switch
          size="1"
          id="invert"
          checked={block.invert}
          onCheckedChange={(invert) => props.onPatchBlock({invert})}
        />
        <Text as="label" htmlFor="invert" size="2">
          Invert colour
        </Text>
      </Flex>
    </>
  );
}

const TABS = [
  {key: 'editor', label: 'Editor'},
  {key: 'pages', label: 'Pages'},
  {key: 'theme', label: 'Theme'},
] as const;

export type Tab = (typeof TABS)[number]['key'];

export type PageEntry = {
  target: string;
  title: string;
  handle: string;
  hasLayout: boolean;
  layoutId?: string;
};

// grouped the way a merchant thinks about them rather than the way they are
// stored. every value is a multiple of --u, which is 1rem at the grid's design
// width, so the numbers read as rem and still scale.
const METRIC_GROUPS: {title: string; note?: string; keys: (keyof Metrics)[]}[] =
  [
    {
      title: 'Page',
      note: 'Margins are a rate, so they already scale — the mobile value is for when proportional is too tight.',
      keys: [
      'pageMax',
      'pageMargin',
      'pageMarginNarrow',
      'pagePadY',
      'pagePadYNarrow',
    ],
    },
    {title: 'Gutter', keys: ['gutter']},
    {
      title: 'Block padding',
      note: 'A unit is 1% of the grid, so a phone needs its own value where a desktop does not.',
      keys: ['blockPadX', 'blockPadY', 'blockPadXNarrow', 'blockPadYNarrow'],
    },
    {title: 'Corners', keys: ['blockRadius', 'imageRadius', 'buttonRadius']},
    {
    title: 'Buttons',
    note: 'Buttons scale with their own text, so these are the desktop values and narrower bands follow.',
    keys: ['buttonPadX', 'buttonPadY'],
  },
  ];

const METRIC_LABEL: Record<keyof Metrics, string> = {
  pageMax: 'Max width',
  pageMargin: 'Side margin',
  pageMarginNarrow: 'Side margin, mobile',
  pagePadY: 'Top and bottom space',
  pagePadYNarrow: 'Top and bottom space, mobile',
  gutter: 'Between blocks',
  blockPadX: 'Horizontal',
  blockPadY: 'Vertical',
  blockPadXNarrow: 'Horizontal, mobile',
  blockPadYNarrow: 'Vertical, mobile',
  blockRadius: 'Blocks',
  imageRadius: 'Images',
  buttonRadius: 'Buttons',
  buttonPadX: 'Horizontal',
  buttonPadY: 'Vertical',
};

// rem for the two page lengths, u for everything else — and at the design width
// they are the same number, which is why the sliders can read in rem
const unitOf = (key: keyof Metrics) => {
  if (key === 'pageMax') return 'rem';
  if (key === 'pagePadY' || key === 'pagePadYNarrow') return 'u';
  if (key === 'pageMargin' || key === 'pageMarginNarrow') return 'vw';
  return 'u';
};

function MetricSlider({
  metrics,
  name,
  onMetrics,
}: {
  metrics: Metrics;
  name: keyof Metrics;
  onMetrics?: (metrics: Metrics) => void;
}) {
  const [min, max, step] = METRIC_RANGE[name];
  const value = metrics[name];
  return (
    <Box>
      <Flex justify="between" align="baseline" mb="1">
        <Text as="label" size="1" color="gray">
          {METRIC_LABEL[name]}
        </Text>
        <Text
          size="1"
          color={value === DEFAULT_METRICS[name] ? 'gray' : undefined}
        >
          {value}
          {unitOf(name)}
        </Text>
      </Flex>
      <Slider
        size="1"
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={!onMetrics}
        onValueChange={([next]) =>
          onMetrics?.({...metrics, [name]: next ?? value})
        }
      />
    </Box>
  );
}

// the two theme settings that are not numbers: the mark every logo element
// renders, and the colour behind every page.
function SettingsPanel({props}: {props: RailProps}) {
  const {settings, onSettings, onPickMedia} = props;
  const logoUrl = settings.logo ? props.media?.[settings.logo] : undefined;

  return (
    <>
      <Section title="Logo">
        <Text size="1" color="gray">
          One image for every logo element. Each element sets its own width.
        </Text>
        {onPickMedia ? (
          <Flex gap="2" align="center" wrap="wrap">
            <Button
              size="1"
              variant="soft"
              onClick={async () => {
                const picked = await onPickMedia();
                if (picked) onSettings?.({...settings, logo: picked.id});
              }}
            >
              {settings.logo ? 'Replace' : 'Choose file'}
            </Button>
            {settings.logo ? (
              <Button
                size="1"
                variant="ghost"
                onClick={() =>
                  onSettings?.({...settings, logo: undefined})
                }
              >
                Clear
              </Button>
            ) : null}
          </Flex>
        ) : (
          <Callout.Root size="1" color="gray">
            <Callout.Text>
              Choosing a file needs the admin app — this playground has no store.
            </Callout.Text>
          </Callout.Root>
        )}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            style={{display: 'block', maxWidth: '100%'}}
          />
        ) : null}
        {settings.logo && !logoUrl ? (
          <Text size="1" color="orange">
            this file is no longer in the store
          </Text>
        ) : null}
      </Section>

      <Section title="Page background">
        <Text size="1" color="gray">
          A slot follows the palette; a hex is a one-off.
        </Text>
        <Swatches
          value={settings.background}
          palette={props.palette}
          onPick={(background) => onSettings?.({...settings, background})}
        />
        <Button
          size="1"
          variant="soft"
          disabled={!onSettings || !settings.background}
          onClick={() => onSettings?.({...settings, background: undefined})}
        >
          Clear
        </Button>
      </Section>
    </>
  );
}

function MetricsPanel({props}: {props: RailProps}) {
  const {metrics, onMetrics} = props;
  const touched = METRIC_KEYS_LOCAL.some(
    (k) => metrics[k] !== DEFAULT_METRICS[k],
  );
  return (
    <>
      {METRIC_GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          {group.note ? (
            <Text size="1" color="gray">
              {group.note}
            </Text>
          ) : null}
          {group.keys.map((key) => (
            <MetricSlider
              key={key}
              metrics={metrics}
              name={key}
              onMetrics={onMetrics}
            />
          ))}
        </Section>
      ))}
      <Section title="Defaults">
        <Button
          size="1"
          variant="soft"
          disabled={!onMetrics || !touched}
          onClick={() => onMetrics?.({...DEFAULT_METRICS})}
        >
          Reset every measurement
        </Button>
      </Section>
    </>
  );
}

const METRIC_KEYS_LOCAL = Object.keys(DEFAULT_METRICS) as (keyof Metrics)[];

function ThemePanel({props}: {props: RailProps}) {
  return (
    <>
      <Section title="Theme colours">
        <Text size="1" color="gray">
          Blocks store which colour, not the colour itself — change one here and
          every block using it moves, published pages included.
        </Text>
        {SLOTS.map((slot) => (
          <Flex key={slot} gap="3" align="center">
            <input
              className="e-swatch"
              type="color"
              aria-label={`Theme colour ${slot}`}
              value={props.palette[slot]}
              disabled={!props.onPalette}
              onChange={(e) =>
                props.onPalette?.({...props.palette, [slot]: e.target.value})
              }
            />
            <Text size="2">Colour {slot}</Text>
            <Text size="1" color="gray">
              {props.palette[slot]}
            </Text>
          </Flex>
        ))}
      </Section>
      <SettingsPanel props={props} />
      <MetricsPanel props={props} />
      <Section title="Save">
        {props.onSavePalette ? (
          <Button size="1" onClick={props.onSavePalette} loading={props.busy}>
            Save theme
          </Button>
        ) : (
          <Callout.Root size="1" color="gray">
            <Callout.Text>Changes are local to this playground.</Callout.Text>
          </Callout.Root>
        )}
      </Section>
    </>
  );
}

function PagesPanel({props}: {props: RailProps}) {
  const pages = props.pages ?? [];

  if (!props.onPages) {
    return (
      <Section title="Pages">
        <Callout.Root size="1" color="gray">
          <Callout.Text>
            Pages live in the admin app. The playground edits one fixed layout.
          </Callout.Text>
        </Callout.Root>
      </Section>
    );
  }

  return (
    <Section title="Pages">
      <Flex direction="column" gap="2">
        {pages.map((page) => (
          <Flex key={page.target} direction="column" gap="1" className="e-page">
            <Flex gap="2" align="center">
              <Button
                size="1"
                variant={page.target === props.target ? 'solid' : 'soft'}
                onClick={() => {
                  // already on the canvas: switch locally rather than reloading
                  const here = props.regions?.some(
                    (r) => r.target === page.target,
                  );
                  if (here) props.onActivate?.(page.target);
                  else props.onOpen?.(page.target);
                }}
                style={{flex: '1 1 auto', justifyContent: 'flex-start'}}
              >
                <Text truncate>{page.title}</Text>
              </Button>
              {page.hasLayout ? null : (
                <Badge size="1" color="gray">
                  no layout
                </Badge>
              )}
            </Flex>

            {page.hasLayout ? null : (
              <Button
                size="1"
                variant="soft"
                onClick={() => props.onPages?.('attach', {target: page.target})}
              >
                Add a layout
              </Button>
            )}
          </Flex>
        ))}
      </Flex>

      <NewPage onCreate={(title) => props.onPages?.('newPage', {title})} />
    </Section>
  );
}

function NewPage({onCreate}: {onCreate: (title: string) => void}) {
  const [title, setTitle] = useState('');
  return (
    <Flex gap="2" align="end">
      <Field label="New page">
        <TextField.Root
          size="1"
          value={title}
          placeholder="Title"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Button
        size="1"
        disabled={!title.trim()}
        onClick={() => onCreate(title.trim())}
      >
        Create
      </Button>
    </Flex>
  );
}

function RegionPicker({props}: {props: RailProps}) {
  if (!props.regions || props.regions.length < 2) return null;
  return (
    <Section title="Editing">
      <SegmentedControl.Root
        size="1"
        value={props.active ?? ''}
        onValueChange={(t) => props.onActivate?.(t)}
        style={{width: '100%'}}
      >
        {props.regions.map((r) => (
          <SegmentedControl.Item key={r.target} value={r.target}>
            {r.label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </Section>
  );
}

// one template serves the whole catalogue, so the merchant needs to see it
// against more than one. the choice is a preview and nothing else.
function ViewAsPicker({props}: {props: RailProps}) {
  const {target} = props;
  const entries =
    target === 'product'
      ? props.products
      : target === 'collection'
        ? props.collections
        : undefined;
  if (!entries || entries.length < 2) return null;
  const current = props.viewAs || entries[0]!.handle;
  return (
    <Section title="Preview">
      <Select.Root
        size="1"
        value={current}
        onValueChange={(handle) => props.onViewAs?.(handle)}
      >
        <Select.Trigger style={{width: '100%'}} />
        <Select.Content>
          {entries.map((e) => (
            <Select.Item key={e.handle} value={e.handle}>
              {e.title}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <Text size="1" color="gray">
        Switching changes the content, never the composition. Not saved.
      </Text>
    </Section>
  );
}

function EditorPanel({props}: {props: RailProps}) {
  const {layout, band, selected, authored, editable, clipped, block, node} =
    props;
  const derived = selected !== null && band !== WIDEST && !authored;

  return (
    <>
      <RegionPicker props={props} />
      <ViewAsPicker props={props} />
      <Section title="Band">
        <SegmentedControl.Root
          size="1"
          value={band}
          onValueChange={(b) => props.onBand(b as Band)}
          style={{width: '100%'}}
        >
          {BANDS.map((b) => (
            <SegmentedControl.Item key={b} value={b}>
              {b.toUpperCase()}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>
      </Section>

      <Section title="Add block">
        <Palette />
        <Text size="1" color="gray">
          Drag onto a module.
        </Text>
      </Section>

      <Section title="Blocks">
        <Flex direction="column" gap="1">
          {layout.blocks.map((b) => (
            <Button
              key={b.id}
              size="1"
              variant={b.id === selected ? 'solid' : 'soft'}
              onClick={() => props.onSelect(b.id === selected ? null : b.id)}
              style={{justifyContent: 'space-between'}}
            >
              <Text truncate>{b.id}</Text>
              <Badge size="1" variant="surface">
                {b.children.length}
              </Badge>
            </Button>
          ))}
        </Flex>
      </Section>

      {selected === null || !editable || !block ? (
        <Box p="3">
          <Text size="1" color="gray">
            Nothing selected.
          </Text>
        </Box>
      ) : (
        <>
          <Section title="Placement">
            <Badge
              size="1"
              color={band === WIDEST ? 'indigo' : derived ? 'gray' : 'green'}
            >
              {band === WIDEST
                ? 'widest band — authoritative'
                : derived
                  ? 'derived — editing overrides it'
                  : 'overridden in this band'}
            </Badge>

            <Grid columns="2" gap="2">
              {AXES.map((axis) => (
                <Field key={axis.key} label={axis.label}>
                  <TextField.Root
                    size="1"
                    type="number"
                    min={1}
                    value={editable[axis.key]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1) {
                        props.onCell({[axis.key]: n});
                      }
                    }}
                  />
                </Field>
              ))}
            </Grid>

            {clipped > 0 ? (
              <Callout.Root size="1" color="amber">
                <Callout.Text>
                  Content is clipped — {clipped} more row
                  {clipped === 1 ? '' : 's'} would fit it.
                </Callout.Text>
                <Box mt="2">
                  <Button
                    size="1"
                    variant="soft"
                    color="amber"
                    onClick={props.onFit}
                  >
                    Add {clipped} row{clipped === 1 ? '' : 's'}
                  </Button>
                </Box>
              </Callout.Root>
            ) : null}

            {props.error ? (
              <Callout.Root size="1" color="red">
                <Callout.Text>{props.error}</Callout.Text>
              </Callout.Root>
            ) : null}

            <Flex gap="2" wrap="wrap">
              <Button
                size="1"
                variant="soft"
                onClick={props.onReset}
                disabled={band === WIDEST || derived}
              >
                Reset to derived
              </Button>
              <Button
                size="1"
                variant="soft"
                color="red"
                onClick={props.onDelete}
              >
                Delete block
              </Button>
            </Flex>
          </Section>

          <Section title="Appearance">
            <Appearance block={block} props={props} />
          </Section>

          <Section title="Layout">
            <FlexFields
              flex={block.flex}
              onChange={(p) => props.onFlex(block.id, p)}
            />
          </Section>

          <Section title="Contents">
            {block.children.length === 0 ? (
              <Text size="1" color="gray">
                Empty. Add an element below.
              </Text>
            ) : (
              <Tree
                block={block}
                activeNode={node?.node.id ?? null}
                dragging={props.dragging}
                resync={props.resync}
                onPick={props.onPickNode}
                onMove={props.onMoveNode}
                onRemove={props.onRemoveNode}
              />
            )}
            <AddMenu parentId={null} onAdd={props.onAddChild} />
          </Section>

          {node ? (
            <Section title={LABEL[node.node.kind] ?? node.node.kind}>
              <Inspector found={node} props={props} />
            </Section>
          ) : null}
        </>
      )}

      <Section title="State">
        <Flex gap="2" wrap="wrap">
          <Button
            size="1"
            variant="soft"
            onClick={props.onUndo}
            disabled={!props.canUndo}
          >
            Undo
          </Button>
          <Button
            size="1"
            variant="soft"
            onClick={props.onRedo}
            disabled={!props.canRedo}
          >
            Redo
          </Button>
        </Flex>
        <Text size="1" color="gray">
          Layout serialises to {(props.bytes / 1024).toFixed(1)}kb
        </Text>
        {props.onSave ? (
          <Flex direction="column" gap="2">
            <Flex gap="2" align="center">
              <Button
                size="1"
                variant="soft"
                onClick={props.onSave}
                loading={props.busy}
                disabled={!props.dirty}
              >
                Save draft
              </Button>
              <Button
                size="1"
                onClick={props.onPublish}
                loading={props.busy}
                disabled={!props.onPublish}
              >
                Publish
              </Button>
            </Flex>
            <Text size="1" color="gray">
              {props.unpublished
                ? 'Draft differs from what is live'
                : `Live — version ${props.version ?? 1}`}
            </Text>
          </Flex>
        ) : (
          <Callout.Root size="1" color="gray">
            <Callout.Text>
              A playground. Edits live in memory and are lost on reload —
              nothing is written to a store.
            </Callout.Text>
          </Callout.Root>
        )}
      </Section>
    </>
  );
}
export function Rail(props: RailProps) {
  return (
    <Theme
      className="e-rail"
      appearance="light"
      accentColor="indigo"
      grayColor="sand"
      radius="small"
      scaling="90%"
    >
      <Tabs.Root
        className="e-tabs-bar"
        value={props.tab}
        onValueChange={(t) => props.onTab(t as Tab)}
      >
        <Tabs.List size="1">
          {TABS.map((t) => (
            <Tabs.Trigger key={t.key} value={t.key}>
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>

      <Flex
        className="e-head"
        align="baseline"
        justify="between"
        gap="2"
        px="3"
        py="2"
      >
        <Heading as="h2" size="2">
          unigrid
        </Heading>
        <Text size="1" color="gray">
          playground
        </Text>
      </Flex>
      <Box className="e-scroll">
        {props.tab === 'theme' ? (
          <ThemePanel props={props} />
        ) : props.tab === 'pages' ? (
          <PagesPanel props={props} />
        ) : (
          <EditorPanel props={props} />
        )}
      </Box>

      <Box className="e-foot" px="3" py="2">
        <Text size="1" color="gray">
          drag to move · grab an edge to resize · arrows nudge · esc deselect
        </Text>
      </Box>
    </Theme>
  );
}
