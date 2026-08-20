import {BANDS, WIDEST, type Band, type Cell, type Layout} from '@unigrid/core';
import {Palette} from './Palette';

// the customiser rail. chrome only — every decision it triggers is core's.

const AXES = [
  {key: 'col', label: 'col'},
  {key: 'colSpan', label: 'span'},
  {key: 'row', label: 'row'},
  {key: 'rowSpan', label: 'rows'},
] as const;

export type RailProps = {
  layout: Layout;
  band: Band;
  selected: string | null;
  authored: Cell | undefined;
  editable: Cell | undefined;
  error: string | null;
  dirty: boolean;
  bytes: number;
  canUndo: boolean;
  canRedo: boolean;
  onBand: (band: Band) => void;
  onSelect: (id: string | null) => void;
  onCell: (patch: Partial<Cell>) => void;
  onReset: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
};

export function Rail(props: RailProps) {
  const {layout, band, selected, authored, editable} = props;
  const derived = selected !== null && band !== WIDEST && !authored;

  return (
    <aside className="e-rail">
      <header className="e-head">
        <strong>unigrid</strong>
        <span className="e-dim">editor spike</span>
      </header>

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
        <p className="e-dim">
          Forced — the band is inspected at this width, not the width that would
          trigger it.
        </p>
      </section>

      <section className="e-sec">
        <h2>Add</h2>
        <Palette />
        <p className="e-dim">Drag onto a module. Nothing is placed by default.</p>
      </section>

      <section className="e-sec e-grow">
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
                <span className="e-dim">{b.type}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="e-sec">
        <h2>Placement</h2>
        {selected === null || !editable ? (
          <p className="e-dim">Nothing selected.</p>
        ) : (
          <>
            <p className="e-badge">
              {band === WIDEST
                ? 'widest band — authoritative'
                : derived
                  ? 'derived — editing overrides it'
                  : 'overridden in this band'}
            </p>
            <p className="e-dim" style={{margin: '0 0 8px'}}>
              The authored span is the rendered span. Content that does not fit
              is clipped — nothing here moves anything else.
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
            <div className="e-row">
              <button
                type="button"
                onClick={props.onReset}
                disabled={band === WIDEST || derived}
              >
                Reset to derived
              </button>
              <button type="button" className="e-danger" onClick={props.onDelete}>
                Delete
              </button>
            </div>
          </>
        )}
        {props.error ? <p className="e-error">{props.error}</p> : null}
      </section>

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
        <p className="e-dim">
          Save writes nothing yet — it encodes and downloads, so the wire format
          is exercised on every real layout.
        </p>
      </section>

      <footer className="e-foot e-dim">
        drag to move · grab an edge to resize · arrows nudge · esc deselect
      </footer>
    </aside>
  );
}
