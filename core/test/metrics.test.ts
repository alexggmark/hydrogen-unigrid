import {describe, expect, it} from 'vitest';
import {
  DEFAULT_METRICS,
  METRIC_RANGE,
  metricsDiff,
  metricsFrom,
} from '../src/metrics';

describe('theme metrics', () => {
  it('an absent or unreadable theme is the default', () => {
    expect(metricsFrom(undefined)).toEqual(DEFAULT_METRICS);
    expect(metricsFrom('nonsense')).toEqual(DEFAULT_METRICS);
    expect(metricsFrom({})).toEqual(DEFAULT_METRICS);
  });

  // a knob added later is simply absent in an entry saved before it existed
  it('merges a partial theme onto the default', () => {
    expect(metricsFrom({blockRadius: 1.2})).toEqual({
      ...DEFAULT_METRICS,
      blockRadius: 1.2,
    });
  });

  it('clamps a value outside its range and ignores a non-number', () => {
    const out = metricsFrom({blockRadius: 99, gutter: -4, pageMax: 'wide'});
    expect(out.blockRadius).toBe(METRIC_RANGE.blockRadius[1]);
    expect(out.gutter).toBe(METRIC_RANGE.gutter[0]);
    expect(out.pageMax).toBe(DEFAULT_METRICS.pageMax);
  });

  // an untouched theme costs nothing to store, the same property the layout
  // wire has
  it('stores only what differs from the default', () => {
    expect(metricsDiff(DEFAULT_METRICS)).toEqual({});
    expect(metricsDiff({...DEFAULT_METRICS, buttonRadius: 0.4})).toEqual({
      buttonRadius: 0.4,
    });
  });

  it('roundtrips through what gets written to the store', () => {
    const theme = {...DEFAULT_METRICS, blockRadius: 2, gutterNarrow: 0.4};
    expect(metricsFrom(JSON.parse(JSON.stringify(metricsDiff(theme))))).toEqual(
      theme,
    );
  });
});
