import {
  BANDS,
  isGroup,
  WIDEST,
  type Band,
  type Block,
  type Cell,
  type Element,
  type ElementKind,
  type Fill,
  type Flex,
  type Found,
  type Group,
  type Layout,
} from '@unigrid/core';
import {Palette} from './Palette';
import {Tree, type NodeDrag} from './Tree';

// the customiser rail. chrome only — every decision it triggers is core's.

const AXES = [
  {key: 'col', label: 'col'},
  {key: 'colSpan', label: 'span'},
  {key: 'row', label: 'row'},
  {key: 'rowSpan', label: 'rows'},
] as const;

const DIRECTION = ['column', 'row'] as const;
const JUSTIFY = ['start', 'center', 'end', 'between'] as const;
const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const LEVELS = [1, 2, 3, 4, 5] as const;
const SIZES = ['sm', 'lg'] as const;
const VARIANTS = ['primary', 'secondary'] as const;
const ADDABLE: (ElementKind | 'group')[] = [
  'headline',
  'text',
  'richText',
  'button',
  'group',
];

const LABEL: Record<string, string> = {
  headline: 'Headline',
  text: 'Text',
  richText: 'Rich text',
  button: 'Button',
  group: 'Group',
};

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
  error: string | null;
  dirty: boolean;
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
  onSave: () => void;
  onPickNode: (id: string | null) => void;
  onAddChild: (kind: ElementKind | 'group', parentId: string | null) => void;
  onPatchNode: (id: string, patch: Partial<Element> | Partial<Group>) => void;
  onMoveNode: (id: string, delta: number) => void;
  onRemoveNode: (id: string) => void;
  onPatchBlock: (patch: Partial<Pick<Block, 'fill' | 'flex' | 'invert'>>) => void;
  onFlex: (id: string, patch: Partial<Flex>) => void;
};

function Choice<T extends string | number>({
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
    <div className="e-choice">
      <span>{label}</span>
      <div className="e-seg">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            aria-pressed={o === value}
            onClick={() => onPick(o)}
          >
            {String(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FlexFields({
  flex,
  onChange,
}: {
  flex: Flex;
  onChange: (patch: Partial<Flex>) => void;
}) {
  return (
    <>
      <Choice
        label="direction"
        value={flex.direction}
        options={DIRECTION}
        onPick={(direction) => onChange({direction})}
      />
      <Choice
        label="justify"
        value={flex.justify}
        options={JUSTIFY}
        onPick={(justify) => onChange({justify})}
      />
      <Choice
        label="align"
        value={flex.align}
        options={ALIGN}
        onPick={(align) => onChange({align})}
      />
      <label className="e-range">
        <span>gap {flex.gap}</span>
        <input
          type="range"
          min={0}
          max={8}
          step={1}
          value={flex.gap}
          onChange={(e) => onChange({gap: Number(e.target.value)})}
        />
      </label>
    </>
  );
}

function AddMenu({
  parentId,
  onAdd,
}: {
  parentId: string | null;
  onAdd: (kind: ElementKind | 'group', parentId: string | null) => void;
}) {
  // a group takes elements only, so it is never offered inside one
  const offer = parentId ? ADDABLE.filter((k) => k !== 'group') : ADDABLE;
  return (
    <div className="e-chips">
      {offer.map((kind) => (
        <button
          key={kind}
          type="button"
          className="e-chip"
          onClick={() => onAdd(kind, parentId)}
        >
          + {LABEL[kind]}
        </button>
      ))}
    </div>
  );
}

function Inspector({found, props}: {found: Found; props: RailProps}) {
  const {node} = found;
  if (isGroup(node)) {
    return (
      <>
        <FlexFields flex={node.flex} onChange={(p) => props.onFlex(node.id, p)} />
        <h3>Add to group</h3>
        <AddMenu parentId={node.id} onAdd={props.onAddChild} />
      </>
    );
  }

  const patch = (p: Partial<Element>) => props.onPatchNode(node.id, p);

  return (
    <>
      {node.kind === 'headline' ? (
        <Choice label="level" value={node.level} options={LEVELS} onPick={(level) => patch({level})} />
      ) : null}
      {node.kind === 'text' || node.kind === 'richText' ? (
        <Choice label="size" value={node.size} options={SIZES} onPick={(size) => patch({size})} />
      ) : null}
      {node.kind === 'button' ? (
        <Choice
          label="style"
          value={node.variant}
          options={VARIANTS}
          onPick={(variant) => patch({variant})}
        />
      ) : null}

      <label className="e-field">
        <span>{node.kind === 'button' ? 'label' : 'content'}</span>
        {node.kind === 'richText' ? (
          <textarea
            rows={5}
            value={node.value}
            onChange={(e) => patch({value: e.target.value})}
          />
        ) : (
          <input
            type="text"
            value={node.kind === 'button' ? node.label : node.value}
            onChange={(e) =>
              patch(node.kind === 'button' ? {label: e.target.value} : {value: e.target.value})
            }
          />
        )}
      </label>

      {node.kind === 'button' ? (
        <label className="e-field">
          <span>link</span>
          <input
            type="text"
            value={node.href}
            onChange={(e) => patch({href: e.target.value})}
          />
        </label>
      ) : null}
    </>
  );
}

function Appearance({block, props}: {block: Block; props: RailProps}) {
  const fill = block.fill;
  const setFill = (patch: Partial<Fill>) =>
    props.onPatchBlock({fill: {...fill, ...patch}});

  return (
    <>
      <label className="e-field e-inline">
        <span>background</span>
        <input
          type="color"
          value={fill.color ?? '#ffffff'}
          onChange={(e) => setFill({color: e.target.value})}
        />
        <button type="button" onClick={() => setFill({color: undefined})}>
          clear
        </button>
      </label>

      <label className="e-field">
        <span>image or video url</span>
        <input
          type="text"
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
      </label>

      <label className="e-field e-inline">
        <span>overlay</span>
        <input
          type="color"
          value={fill.overlay?.color ?? '#000000'}
          onChange={(e) =>
            setFill({
              overlay: {color: e.target.value, opacity: fill.overlay?.opacity ?? 0.4},
            })
          }
        />
        <button type="button" onClick={() => setFill({overlay: undefined})}>
          clear
        </button>
      </label>
      {fill.overlay ? (
        <label className="e-range">
          <span>opacity {Math.round(fill.overlay.opacity * 100)}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(fill.overlay.opacity * 100)}
            onChange={(e) =>
              setFill({
                overlay: {
                  color: fill.overlay?.color ?? '#000000',
                  opacity: Number(e.target.value) / 100,
                },
              })
            }
          />
        </label>
      ) : null}

      <label className="e-toggle">
        <input
          type="checkbox"
          checked={block.invert}
          onChange={(e) => props.onPatchBlock({invert: e.target.checked})}
        />
        <span>invert colour</span>
      </label>
    </>
  );
}

export function Rail(props: RailProps) {
  const {layout, band, selected, authored, editable, clipped, block, node} = props;
  const derived = selected !== null && band !== WIDEST && !authored;

  return (
    <aside className="e-rail">
      <header className="e-head">
        <strong>unigrid</strong>
        <span className="e-dim">editor spike</span>
      </header>

      <div className="e-scroll">
        <section className="e-sec">
          <h2>Band</h2>
          <div className="e-tabs">
            {BANDS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={b === band}
                onClick={() => props.onBand(b)}
              >
                {b.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="e-sec">
          <h2>Add block</h2>
          <Palette />
          <p className="e-dim">Drag onto a module.</p>
        </section>

        <section className="e-sec">
          <h2>Blocks</h2>
          <ul className="e-list">
            {layout.blocks.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  aria-pressed={b.id === selected}
                  onClick={() => props.onSelect(b.id === selected ? null : b.id)}
                >
                  <span>{b.id}</span>
                  <span className="e-dim">{b.children.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selected === null || !editable || !block ? (
          <section className="e-sec">
            <p className="e-dim">Nothing selected.</p>
          </section>
        ) : (
          <>
            <section className="e-sec">
              <h2>Placement</h2>
              <p className="e-badge">
                {band === WIDEST
                  ? 'widest band — authoritative'
                  : derived
                    ? 'derived — editing overrides it'
                    : 'overridden in this band'}
              </p>
              <div className="e-fields">
                {AXES.map((axis) => (
                  <label key={axis.key}>
                    <span>{axis.label}</span>
                    <input
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
                  </label>
                ))}
              </div>
              {clipped > 0 ? (
                <p className="e-warn">
                  Content is clipped — {clipped} more row{clipped === 1 ? '' : 's'} would
                  fit it.
                  <button type="button" onClick={props.onFit}>
                    Add {clipped} row{clipped === 1 ? '' : 's'}
                  </button>
                </p>
              ) : null}
              <div className="e-row">
                <button
                  type="button"
                  onClick={props.onReset}
                  disabled={band === WIDEST || derived}
                >
                  Reset to derived
                </button>
                <button type="button" className="e-danger" onClick={props.onDelete}>
                  Delete block
                </button>
              </div>
              {props.error ? <p className="e-error">{props.error}</p> : null}
            </section>

            <section className="e-sec">
              <h2>Appearance</h2>
              <Appearance block={block} props={props} />
            </section>

            <section className="e-sec">
              <h2>Layout</h2>
              <FlexFields
                flex={block.flex}
                onChange={(p) => props.onFlex(block.id, p)}
              />
            </section>

            <section className="e-sec">
              <h2>Contents</h2>
              {block.children.length === 0 ? (
                <p className="e-dim">Empty. Add an element below.</p>
              ) : (
                <Tree
                  block={block}
                  activeNode={node?.node.id ?? null}
                  dragging={props.dragging}
                  onPick={props.onPickNode}
                  onMove={props.onMoveNode}
                  onRemove={props.onRemoveNode}
                />
              )}
              <AddMenu parentId={null} onAdd={props.onAddChild} />
            </section>

            {node ? (
              <section className="e-sec">
                <h2>{LABEL[node.node.kind] ?? node.node.kind}</h2>
                <Inspector found={node} props={props} />
              </section>
            ) : null}
          </>
        )}

        <section className="e-sec">
          <h2>State</h2>
          <div className="e-row">
            <button type="button" onClick={props.onUndo} disabled={!props.canUndo}>
              Undo
            </button>
            <button type="button" onClick={props.onRedo} disabled={!props.canRedo}>
              Redo
            </button>
          </div>
          <div className="e-row">
            <button type="button" onClick={props.onSave}>
              {props.dirty ? 'Save •' : 'Save'}
            </button>
            <span className="e-dim">
              {(props.bytes / 1024).toFixed(1)}kb / 128kb
            </span>
          </div>
        </section>
      </div>

      <footer className="e-foot e-dim">
        drag to move · grab an edge to resize · arrows nudge · esc deselect
      </footer>
    </aside>
  );
}
