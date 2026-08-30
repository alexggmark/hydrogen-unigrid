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
  isSlot,
  SLOTS,
  isGroup,
  WIDEST,
  type Band,
  type Block,
  type Cell,
  type Colour,
  type Element,
  type ElementKind,
  type Fill,
  type Flex as FlexModel,
  type Found,
  type Group,
  type Layout,
  type Palette as ThemePalette,
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
const VARIANTS = ['primary', 'secondary'] as const;
const MENU_DIRECTIONS = ['row', 'column'] as const;
const PRODUCT_VIEWS = ['media', 'details'] as const;

// a key, not a kind: product is two entries here and one kind in the model
export type AddKey =
  | Exclude<ElementKind, 'product'>
  | 'group'
  | 'productMedia'
  | 'productDetails';

const ADDABLE: AddKey[] = [
  'headline',
  'text',
  'richText',
  'button',
  'menu',
  'productMedia',
  'productDetails',
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
  group: 'Group',
};

export type MenuEntry = {handle: string; title: string};
export type ProductEntry = {handle: string; title: string};

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
  tab: Tab;
  onTab: (tab: Tab) => void;
  onPalette?: (palette: ThemePalette) => void;
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
  onPatchBlock: (patch: Partial<Pick<Block, 'fill' | 'flex' | 'invert'>>) => void;
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

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <Box p="3">
      <Heading as="h3" size="1" mb="2" color="gray" style={{letterSpacing: '0.08em'}}>
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
        <FlexFields flex={node.flex} onChange={(p) => props.onFlex(node.id, p)} />
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
            <Select.Trigger placeholder="Choose a menu" style={{width: '100%'}} />
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
            <Select.Trigger placeholder="Choose a product" style={{width: '100%'}} />
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

      <Field label={node.kind === 'button' ? 'Label' : 'Content'}>
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
            value={node.kind === 'button' ? node.label : node.value}
            onChange={(e) =>
              patch(
                node.kind === 'button'
                  ? {label: e.target.value}
                  : {value: e.target.value},
              )
            }
          />
        )}
      </Field>

      {node.kind === 'button' ? (
        <Field label="Link">
          <TextField.Root
            size="1"
            value={node.href}
            onChange={(e) => patch({href: e.target.value})}
          />
        </Field>
      ) : null}
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
          <Button size="1" variant="soft" onClick={() => setFill({color: undefined})}>
            Clear
          </Button>
        </Flex>
      </Field>

      <Field label="Image or video URL">
        <TextField.Root
          size="1"
          placeholder="https://… or gid://…"
          value={fill.media?.src ?? ''}
          onChange={(e) => {
            const src = e.target.value;
            setFill({
              media: src
                ? {kind: /\.(mp4|webm|mov)(\?|$)/i.test(src) ? 'video' : 'image', src}
                : undefined,
            });
          }}
        />
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
          <Button size="1" variant="soft" onClick={() => setFill({overlay: undefined})}>
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

function ThemePanel({props}: {props: RailProps}) {
  return (
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
            onChange={(e) => props.onPalette?.({...props.palette, [slot]: e.target.value})}
          />
          <Text size="2">Colour {slot}</Text>
          <Text size="1" color="gray">
            {props.palette[slot]}
          </Text>
        </Flex>
      ))}
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
          <Flex
            key={page.target}
            direction="column"
            gap="1"
            className="e-page"
          >
            <Flex gap="2" align="center">
              <Button
                size="1"
                variant={page.target === props.target ? 'solid' : 'soft'}
                onClick={() => {
                  // already on the canvas: switch locally rather than reloading
                  const here = props.regions?.some((r) => r.target === page.target);
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
      <Button size="1" disabled={!title.trim()} onClick={() => onCreate(title.trim())}>
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

function EditorPanel({props}: {props: RailProps}) {
  const {layout, band, selected, authored, editable, clipped, block, node} = props;
  const derived = selected !== null && band !== WIDEST && !authored;

  return (
    <>
        <RegionPicker props={props} />
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
                    <Button size="1" variant="soft" color="amber" onClick={props.onFit}>
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
                <Button size="1" variant="soft" color="red" onClick={props.onDelete}>
                  Delete block
                </Button>
              </Flex>
            </Section>

            <Section title="Appearance">
              <Appearance block={block} props={props} />
            </Section>

            <Section title="Layout">
              <FlexFields flex={block.flex} onChange={(p) => props.onFlex(block.id, p)} />
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
            <Button size="1" variant="soft" onClick={props.onUndo} disabled={!props.canUndo}>
              Undo
            </Button>
            <Button size="1" variant="soft" onClick={props.onRedo} disabled={!props.canRedo}>
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
