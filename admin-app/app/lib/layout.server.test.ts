import {describe, expect, it} from 'vitest';
import {emptyBlock, encode, type Layout} from '@unigrid/core';
import {loadDraft, publish, publishAll, saveDraft} from './layout.server';

const layout: Layout = {
  version: 1,
  blocks: [emptyBlock('x', {a: {col: 1, colSpan: 4, row: 1, rowSpan: 2}})],
};

type Field = {key: string; value?: string | null};

// the Admin type is structural, so a stub is a real client as far as this is
// concerned. records what was written so the assertions can be about the wire.
function fakeAdmin(fields: Field[] | null) {
  const writes: Field[][] = [];
  const admin = {
    graphql: async (query: string, options?: {variables?: Record<string, unknown>}) => {
      if (query.includes('metaobjectUpdate')) {
        writes.push(options?.variables?.fields as Field[]);
        return {json: async () => ({data: {metaobjectUpdate: {userErrors: []}}})};
      }
      return {
        json: async () => ({
          data: {metaobjectByHandle: fields ? {id: 'gid://x/1', fields} : null},
        }),
      };
    },
  };
  return {admin, writes};
}

const at = (fields: Field[], key: string) =>
  fields.find((f) => f.key === key)?.value;

describe('publish', () => {
  it('copies draft into published and bumps the version', async () => {
    const {admin, writes} = fakeAdmin([
      {key: 'draft', value: encode(layout)},
      {key: 'published', value: encode({...layout, blocks: []})},
      {key: 'version', value: '3'},
    ]);

    expect(await publish(admin, 'home')).toEqual({ok: true});
    expect(at(writes[0]!, 'published')).toBe(encode(layout));
    expect(at(writes[0]!, 'version')).toBe('4');
  });

  // publishing the browser's copy would let an unsaved edit go live, and then
  // draft and published would disagree with nothing to show for it
  it('never writes the draft field', async () => {
    const {admin, writes} = fakeAdmin([{key: 'draft', value: encode(layout)}]);
    await publish(admin, 'home');
    expect(writes[0]!.map((f) => f.key)).toEqual(['published', 'version']);
  });

  it('refuses an unreadable draft rather than publishing it', async () => {
    const {admin, writes} = fakeAdmin([{key: 'draft', value: 'not json'}]);
    expect(await publish(admin, 'home')).toMatchObject({ok: false});
    expect(writes).toHaveLength(0);
  });

  it('refuses when there is no draft, and when there is no entry', async () => {
    expect(await publish(fakeAdmin([]).admin, 'home')).toMatchObject({ok: false});
    expect(await publish(fakeAdmin(null).admin, 'home')).toMatchObject({ok: false});
  });

  it('starts versions at 1 when the field is missing or junk', async () => {
    for (const version of [undefined, 'seven']) {
      const fields: Field[] = [{key: 'draft', value: encode(layout)}];
      if (version) fields.push({key: 'version', value: version});
      const {admin, writes} = fakeAdmin(fields);
      await publish(admin, 'home');
      expect(at(writes[0]!, 'version')).toBe('1');
    }
  });
});

describe('draft', () => {
  it('saves to draft only', async () => {
    const {admin, writes} = fakeAdmin([{key: 'draft', value: encode(layout)}]);
    expect(await saveDraft(admin, 'home', layout)).toEqual({ok: true});
    expect(writes[0]!.map((f) => f.key)).toEqual(['draft']);
  });

  // a page published before the editor existed has no draft yet
  it('falls back to published so the page is still editable', async () => {
    const {admin} = fakeAdmin([{key: 'published', value: encode(layout)}]);
    expect((await loadDraft(admin, 'home'))?.layout).toEqual(layout);
  });

  it('reports whether the draft differs from what is live', async () => {
    const same = encode(layout);
    const {admin} = fakeAdmin([
      {key: 'draft', value: same},
      {key: 'published', value: same},
    ]);
    expect((await loadDraft(admin, 'home'))?.unpublished).toBe(false);

    const {admin: other} = fakeAdmin([
      {key: 'draft', value: same},
      {key: 'published', value: encode({...layout, blocks: []})},
    ]);
    expect((await loadDraft(other, 'home'))?.unpublished).toBe(true);
  });
});

describe('publishAll', () => {
  // a store where the header is saved but not live, and the page is already live
  const store: Record<string, Field[]> = {
    header: [
      {key: 'draft', value: encode(layout)},
      {key: 'published', value: encode({...layout, blocks: []})},
      {key: 'version', value: '1'},
    ],
    home: [
      {key: 'draft', value: encode(layout)},
      {key: 'published', value: encode(layout)},
      {key: 'version', value: '4'},
    ],
    footer: [],
  };

  function many() {
    const wrote: {target: string; fields: Field[]}[] = [];
    let seen = '';
    const admin = {
      graphql: async (query: string, options?: {variables?: Record<string, unknown>}) => {
        if (query.includes('metaobjectUpdate')) {
          wrote.push({target: seen, fields: options?.variables?.fields as Field[]});
          return {json: async () => ({data: {metaobjectUpdate: {userErrors: []}}})};
        }
        seen = String(options?.variables?.handle);
        const fields = store[seen];
        return {
          json: async () => ({
            data: {metaobjectByHandle: fields?.length ? {id: `gid://${seen}`, fields} : null},
          }),
        };
      },
    };
    return {admin, wrote};
  }

  it('promotes only the regions whose draft differs from what is live', async () => {
    const {admin, wrote} = many();
    expect(await publishAll(admin, ['header', 'home', 'footer'])).toEqual({ok: true});
    expect(wrote.map((w) => w.target)).toEqual(['header']);
  });

  // a footer nobody has written is not a failure, it is nothing to do
  it('skips a region that does not exist', async () => {
    const {admin} = many();
    expect(await publishAll(admin, ['footer'])).toEqual({ok: true});
  });
});
