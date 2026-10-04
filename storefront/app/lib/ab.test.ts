import {describe, expect, it, vi} from 'vitest';
import {encode, emptyBlock, type Layout} from '@unigrid/core';
import {createAb, fromPosthog, readCookies} from './ab';
import {chooseBody} from './layout';

const request = (cookie = '', query = '') =>
  new Request(`https://shop.test/${query}`, {
    headers: cookie ? {Cookie: cookie} : {},
  });

const posthog = (variant: unknown, enabled = true) =>
  vi.fn(async () =>
    Response.json({flags: {hero: {key: 'hero', enabled, variant}}}),
  ) as unknown as typeof fetch;

const make = (req: Request, f?: typeof fetch) =>
  createAb(req, {key: 'phc_x', fetch: f ?? posthog('test'), id: () => 'v1'});

describe('assignment', () => {
  it('a remembered answer wins over asking posthog', async () => {
    const f = posthog('control');
    const ab = make(request('ug_ab_hero=test'), f);
    expect(await ab.arm('hero')).toEqual({arm: 'b', counted: true});
    expect(f).not.toHaveBeenCalled();
    expect(ab.setCookies()).toEqual([]);
  });

  // a page loader and the root loader must never disagree within one request
  it('asks posthog once per flag per request', async () => {
    const f = posthog('test');
    const ab = make(request(), f);
    const [x, y] = await Promise.all([ab.arm('hero'), ab.arm('hero')]);
    expect(x).toEqual({arm: 'b', counted: true});
    expect(y).toBe(x);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('remembers the answer and mints a visitor id', async () => {
    const ab = make(request());
    await ab.arm('hero');
    const set = ab.setCookies().join('\n');
    expect(set).toContain('ug_vid=v1');
    expect(set).toMatch(/ug_ab_hero=test;.*Max-Age/);
  });

  it('keeps an existing visitor id', async () => {
    const ab = make(request('ug_vid=old'));
    await ab.arm('hero');
    expect(ab.distinctId()).toBe('old');
    expect(ab.setCookies().join()).not.toContain('ug_vid=');
  });

  // excluded rather than counted as control, and only for the session, so a
  // blip neither skews the results nor keeps the visitor out for good
  it('a failed call serves A, uncounted, for the session', async () => {
    const f = vi.fn(async () => {
      throw new Error('timeout');
    }) as unknown as typeof fetch;
    const ab = make(request(), f);
    expect(await ab.arm('hero')).toEqual({arm: 'a', counted: false});
    const cookie = ab.setCookies().find((c) => c.startsWith('ug_ab_hero'));
    expect(cookie).toMatch(/^ug_ab_hero=x;/);
    expect(cookie).not.toContain('Max-Age');
  });

  it('an excluded visitor is not asked again this session', async () => {
    const f = posthog('test');
    const ab = make(request('ug_ab_hero=x'), f);
    expect(await ab.arm('hero')).toEqual({arm: 'a', counted: false});
    expect(f).not.toHaveBeenCalled();
  });

  it('a preview renders the arm asked for and is never counted', async () => {
    const f = posthog('control');
    const ab = make(request('', '?ug_arm=b'), f);
    expect(await ab.arm('hero')).toEqual({arm: 'b', counted: false});
    expect(f).not.toHaveBeenCalled();
  });

  it('no project token means A for everyone, without a call', async () => {
    const f = posthog('test');
    const ab = createAb(request(), {fetch: f});
    expect(await ab.arm('hero')).toEqual({arm: 'a', counted: false});
    expect(f).not.toHaveBeenCalled();
  });

  it('a malformed flag key is no test', async () => {
    const ab = make(request());
    expect(await ab.arm('bad key;')).toEqual({arm: 'a', counted: false});
    expect(ab.touched()).toBe(false);
  });
});

describe('posthog answer', () => {
  it('only an explicit test variant shows B', () => {
    const json = (variant: unknown, enabled = true) => ({
      flags: {hero: {enabled, variant}},
    });
    expect(fromPosthog(json('test'), 'hero')).toEqual({
      arm: 'b',
      counted: true,
    });
    expect(fromPosthog(json('control'), 'hero')).toEqual({
      arm: 'a',
      counted: true,
    });
    expect(fromPosthog(json('test', false), 'hero').counted).toBe(false);
    expect(fromPosthog(json('third'), 'hero')).toEqual({
      arm: 'a',
      counted: false,
    });
    expect(fromPosthog({}, 'hero')).toEqual({arm: 'a', counted: false});
    expect(fromPosthog(null, 'hero')).toEqual({arm: 'a', counted: false});
  });

  it('reads cookies', () => {
    expect(readCookies('a=1; ug_ab_hero=test ;b')).toEqual({
      a: '1',
      ug_ab_hero: 'test',
    });
    expect(readCookies(null)).toEqual({});
  });
});

const one = (id: string): Layout => ({
  version: 1,
  blocks: [emptyBlock(id, {a: {col: 1, colSpan: 4, row: 1, rowSpan: 2}})],
});

const region = (over: Record<string, string | null>) => ({
  fields: Object.entries({
    version: '2',
    published: encode(one('a')),
    ...over,
  }).map(([key, value]) => ({key, value})),
});

const always = (arm: 'a' | 'b', counted = true) => ({
  arm: vi.fn(async () => ({arm, counted})),
});

describe('choosing the body', () => {
  it('serves B and reports exposure when the visitor is in the test arm', async () => {
    const got = await chooseBody(
      region({published_b: encode(one('b')), flag: 'hero'}),
      'published',
      always('b'),
    );
    expect(got.body?.blocks[0]?.id).toBe('b');
    expect(got.experiment).toEqual({flag: 'hero', variant: 'test'});
  });

  it('no flag, or no published B, is no test and asks nobody', async () => {
    const cases: Record<string, string>[] = [
      {published_b: encode(one('b'))},
      {flag: 'hero'},
    ];
    for (const over of cases) {
      const ab = always('b');
      const got = await chooseBody(region(over), 'published', ab);
      expect(got.body?.blocks[0]?.id).toBe('a');
      expect(got.experiment).toBeUndefined();
      expect(ab.arm).not.toHaveBeenCalled();
    }
  });

  it('an uncounted visitor renders an arm without reporting it', async () => {
    const got = await chooseBody(
      region({published_b: encode(one('b')), flag: 'hero'}),
      'published',
      always('b', false),
    );
    expect(got.body?.blocks[0]?.id).toBe('b');
    expect(got.experiment).toBeUndefined();
  });

  // the editor's draft view is not a visitor
  it('a draft read never enters the test', async () => {
    const ab = always('b');
    const got = await chooseBody(
      region({
        draft: encode(one('d')),
        published_b: encode(one('b')),
        flag: 'hero',
      }),
      'draft',
      ab,
    );
    expect(got.body?.blocks[0]?.id).toBe('d');
    expect(ab.arm).not.toHaveBeenCalled();
  });
});
