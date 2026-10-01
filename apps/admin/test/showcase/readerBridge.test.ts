import { describe, expect, it, vi } from 'vitest';
import {
  loadReaderSaves,
  readerStorageKey,
  readReaderMessage,
  sanitizeReaderSaves,
  storeReaderSaves,
  READER_MAX_SAVES,
  READER_MAX_STEPS,
} from '../../src/showcase/reader/readerBridge';

const manual = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  kind: 'manual',
  name: 'Before the vault',
  at: '2026-09-28T10:00:00.000Z',
  scene: 'Cellar',
  count: 2,
  steps: [
    { s: 'a', c: null },
    { s: 'b', c: 'c-key' },
  ],
  ...overrides,
});

describe('readerStorageKey', () => {
  it('is per story and per published version', () => {
    expect(readerStorageKey('story-1', 'pub-1')).toBe('keres_reader_story-1_pub-1');
    expect(readerStorageKey('story-1', 'pub-2')).not.toBe(readerStorageKey('story-1', 'pub-1'));
  });
});

describe('readReaderMessage', () => {
  it('reads the two messages of the protocol', () => {
    expect(readReaderMessage({ keresReader: 1, type: 'load' })).toEqual({ type: 'load' });
    expect(readReaderMessage({ keresReader: 1, type: 'write', saves: [1] })).toEqual({
      type: 'write',
      saves: [1],
    });
  });

  it.each([
    ['nothing', undefined],
    ['a string', 'load'],
    ['another protocol', { type: 'load' }],
    ['another version', { keresReader: 2, type: 'load' }],
    ['another message', { keresReader: 1, type: 'reboot' }],
  ])('ignores %s', (_name, data) => {
    expect(readReaderMessage(data)).toBeNull();
  });
});

describe('sanitizeReaderSaves', () => {
  it('keeps what it knows of a manual save, and only that', () => {
    const [save] = sanitizeReaderSaves([manual({ evil: '<script>', extra: { deep: 1 } })])!;

    expect(save).toEqual({
      id: 'm1',
      kind: 'manual',
      name: 'Before the vault',
      at: '2026-09-28T10:00:00.000Z',
      scene: 'Cellar',
      count: 2,
      steps: [
        { s: 'a', c: null },
        { s: 'b', c: 'c-key' },
      ],
    });
  });

  it('counts the steps itself instead of believing the count it was given', () => {
    const [save] = sanitizeReaderSaves([manual({ count: 999999 })])!;
    expect(save).toMatchObject({ count: 2 });
  });

  it('keeps a place for a linear story and preferences within their range', () => {
    const list = sanitizeReaderSaves([
      { id: 'auto', kind: 'auto', name: 'Autosave', at: 'x', place: 0.4 },
      { id: 'prefs', kind: 'prefs', theme: 'dark', size: 130 },
      { id: 'prefs', kind: 'prefs', theme: 'neon', size: 9000 },
    ])!;

    expect(list[0]).toMatchObject({ kind: 'auto', place: 0.4, steps: [] });
    expect(list[1]).toEqual({ id: 'prefs', kind: 'prefs', theme: 'dark', size: 130 });
    expect(list[2]).toEqual({ id: 'prefs', kind: 'prefs', theme: '', size: 100 });
  });

  it('drops the entries it cannot read and keeps the rest', () => {
    const list = sanitizeReaderSaves([
      null,
      'text',
      { kind: 'manual' },
      manual({ kind: 'hacked' }),
      manual({ id: 'x'.repeat(200) }),
      manual({ steps: [] }),
      manual({ steps: [{ s: 1, c: null }] }),
      manual({ steps: [{ s: 'a', c: 5 }] }),
      manual({ steps: 'nope' }),
      manual({ id: 'ok' }),
    ])!;

    expect(list.map((save) => save.id)).toEqual(['ok']);
  });

  it('refuses a path longer than any reading can be', () => {
    const steps = Array.from({ length: READER_MAX_STEPS + 1 }, () => ({ s: 'a', c: null }));
    expect(sanitizeReaderSaves([manual({ steps })])).toEqual([]);
  });

  it('caps how many entries it keeps', () => {
    const many = Array.from({ length: READER_MAX_SAVES + 20 }, (_, index) =>
      manual({ id: `m${index}` }),
    );
    expect(sanitizeReaderSaves(many)!.length).toBeLessThanOrEqual(READER_MAX_SAVES + 2);
  });

  it('is null for anything that is not a list', () => {
    expect(sanitizeReaderSaves({ saves: [] })).toBeNull();
    expect(sanitizeReaderSaves('[]')).toBeNull();
    expect(sanitizeReaderSaves(undefined)).toBeNull();
  });
});

describe('the keeping', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  };

  it('writes and reads back a list', () => {
    const storage = memory();
    const saves = sanitizeReaderSaves([manual()])!;

    storeReaderSaves(storage, 'k', saves);

    expect(loadReaderSaves(storage, 'k')).toEqual(saves);
  });

  it('reads nothing where nothing was kept, and re-checks what it finds', () => {
    const storage = memory();
    expect(loadReaderSaves(storage, 'k')).toEqual([]);

    storage.setItem('k', JSON.stringify([manual({ kind: 'hacked' }), manual({ id: 'ok' })]));
    expect(loadReaderSaves(storage, 'k').map((save) => save.id)).toEqual(['ok']);

    storage.setItem('k', '{broken');
    expect(loadReaderSaves(storage, 'k')).toEqual([]);
  });

  it('lets the reading go on when storage is full or blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: vi.fn(() => {
        throw new Error('full');
      }),
    };

    expect(() => storeReaderSaves(blocked, 'k', [])).not.toThrow();
    expect(loadReaderSaves(blocked, 'k')).toEqual([]);
  });
});
