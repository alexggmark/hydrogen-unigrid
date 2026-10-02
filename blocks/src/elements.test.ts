import {describe, expect, it} from 'vitest';
import {DEFAULT_FLEX, type Flex} from '@unigrid/core';
import {DEFAULT_PALETTE} from '@unigrid/core';
import {flexVars, pageIsDark, textAlign} from './elements';

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

describe('the page decides an unfilled block\'s ink', () => {
  it('an unset background is the stylesheet\'s own, which is light', () => {
    expect(pageIsDark(DEFAULT_PALETTE, undefined)).toBe(false);
    expect(pageIsDark(DEFAULT_PALETTE, {})).toBe(false);
  });

  it('reads a literal either way', () => {
    expect(pageIsDark(DEFAULT_PALETTE, {background: {hex: '#111110'}})).toBe(true);
    expect(pageIsDark(DEFAULT_PALETTE, {background: {hex: '#fbfbf9'}})).toBe(false);
  });

  // a slot is a reference, so the answer moves when the palette does
  it('resolves a slot through the palette', () => {
    expect(pageIsDark(DEFAULT_PALETTE, {background: {slot: 1}})).toBe(true);
    expect(pageIsDark(DEFAULT_PALETTE, {background: {slot: 2}})).toBe(false);
    const swapped = {...DEFAULT_PALETTE, 2: '#111110'};
    expect(pageIsDark(swapped, {background: {slot: 2}})).toBe(true);
  });

  // a channel average calls a saturated blue light and a saturated yellow dark
  it('weights the channels rather than averaging them', () => {
    expect(pageIsDark(DEFAULT_PALETTE, {background: {hex: '#1b3fa0'}})).toBe(true);
    expect(pageIsDark(DEFAULT_PALETTE, {background: {hex: '#f2c200'}})).toBe(false);
  });
});

describe('flex vars carry both arrangements', () => {
  // a group that left its phone values out would inherit its parent's
  it('writes the phone set even with no override', () => {
    const vars = flexVars(flex({direction: 'row'})) as Record<string, unknown>;
    expect(vars['--fd-c']).toBe('row');
    expect(vars['--fd-d']).toBe('row');
  });

  it('takes text alignment from the phone arrangement on the phone', () => {
    const vars = flexVars(
      flex({direction: 'row', justify: 'end'}),
      flex({direction: 'column', align: 'center'}),
    ) as Record<string, unknown>;
    expect(vars['--ta-d']).toBe('end');
    expect(vars['--ta-c']).toBe('center');
  });
});
