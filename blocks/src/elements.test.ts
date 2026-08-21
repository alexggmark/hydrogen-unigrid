import {describe, expect, it} from 'vitest';
import {DEFAULT_FLEX, type Flex} from '@unigrid/core';
import {textAlign} from './elements';

const flex = (patch: Partial<Flex>): Flex => ({...DEFAULT_FLEX, ...patch});

describe('text alignment follows the horizontal axis', () => {
  it('takes align in a column, where align is horizontal', () => {
    for (const [align, expected] of [
      ['start', 'start'],
      ['center', 'center'],
      ['end', 'end'],
    ] as const) {
      expect(textAlign(flex({direction: 'column', align}))).toBe(expected);
    }
  });

  it('takes justify in a row, where justify is horizontal', () => {
    for (const [justify, expected] of [
      ['start', 'start'],
      ['center', 'center'],
      ['end', 'end'],
    ] as const) {
      expect(textAlign(flex({direction: 'row', justify}))).toBe(expected);
    }
  });

  // align is vertical in a row, so reading it there would centre text for a
  // block that only asked for its boxes to line up
  it('ignores align in a row and justify in a column', () => {
    expect(textAlign(flex({direction: 'row', align: 'center', justify: 'start'}))).toBe('start');
    expect(textAlign(flex({direction: 'column', justify: 'center', align: 'start'}))).toBe('start');
  });

  // full-width boxes and spread-out boxes say nothing about the words in them
  it('falls back to start for stretch and between', () => {
    expect(textAlign(flex({direction: 'column', align: 'stretch'}))).toBe('start');
    expect(textAlign(flex({direction: 'row', justify: 'between'}))).toBe('start');
  });

  it('leaves the default alone', () => {
    expect(textAlign(DEFAULT_FLEX)).toBe('start');
  });
});
