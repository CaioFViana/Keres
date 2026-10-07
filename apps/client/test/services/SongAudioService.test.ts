/**
 * @jest-environment node
 */
import type { VoiceScore } from '@keres/shared';
import {
  createSongAudioService,
  hashText,
  type SongAudioStore,
  songAudioKey,
} from '../../src/services/SongAudioService';

jest.mock('expo-file-system', () => ({
  Directory: class {},
  File: class {},
  Paths: { cache: '' },
}));

const score = (pitches: number[], tempo = 120): VoiceScore => ({
  notes: pitches.map((pitch, i) => ({ pitch, start: i, duration: 0.9, sung: true })),
  beats: pitches.length,
  tempo,
});

function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const pruned: number[] = [];
  const store: SongAudioStore = {
    find: async (key) => (files.has(key) ? `mem://${key}` : null),
    put: async (key, bytes) => {
      files.set(key, bytes);
      return `mem://${key}`;
    },
    prune: async (max) => {
      pruned.push(max);
    },
  };
  return { store, files, pruned };
}

describe('hashText', () => {
  it('is the same for the same text and different for a changed one', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
    expect(hashText('abc')).toHaveLength(14);
  });
});

describe('songAudioKey', () => {
  it('follows the notes, the tempo, the voice and the click', () => {
    const base = songAudioKey(score([60, 62]), { timbre: 'hum' });

    expect(songAudioKey(score([60, 62]), { timbre: 'hum' })).toBe(base);
    expect(songAudioKey(score([60, 63]), { timbre: 'hum' })).not.toBe(base);
    expect(songAudioKey(score([60, 62], 90), { timbre: 'hum' })).not.toBe(base);
    expect(songAudioKey(score([60, 62]), { timbre: 'ah' })).not.toBe(base);
    expect(songAudioKey(score([60, 62]), { timbre: 'hum', clickBeatsPerBar: 4 })).not.toBe(base);
  });
});

describe('songAudioKey with an accompaniment', () => {
  const withBacking = (instrument: 'guitar' | 'harp', pitch = 43): VoiceScore => ({
    ...score([60, 62]),
    backing: { instrument, notes: [{ pitch, start: 0, duration: 2, velocity: 0.8 }] },
  });

  it('differs from the voice alone, and follows the instrument and what it plays', () => {
    const alone = songAudioKey(score([60, 62]), { timbre: 'hum' });
    const guitar = songAudioKey(withBacking('guitar'), { timbre: 'hum' });

    expect(guitar).not.toBe(alone);
    expect(songAudioKey(withBacking('harp'), { timbre: 'hum' })).not.toBe(guitar);
    expect(songAudioKey(withBacking('guitar', 45), { timbre: 'hum' })).not.toBe(guitar);
    expect(songAudioKey(withBacking('guitar'), { timbre: 'hum' })).toBe(guitar);
  });
});

describe('createSongAudioService', () => {
  const make = () => {
    const kept = memoryStore();
    const service = createSongAudioService({
      store: kept.store,
      yieldToUi: async () => {},
      maxBytes: 1234,
    });
    return { ...kept, service };
  };

  it('renders a tune to a WAV, keeps it, and says how long it runs', async () => {
    const { service, files } = make();

    const result = await service.render(score([60, 62, 64]), { timbre: 'ah' });

    expect(result).toMatchObject({ seconds: 1.5, cached: false });
    expect(result?.uri.startsWith('mem://')).toBe(true);
    const bytes = [...files.values()][0];
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
  });

  it('does not render the same tune twice', async () => {
    const { service, files } = make();
    await service.render(score([60, 62]), { timbre: 'ah' });

    const again = await service.render(score([60, 62]), { timbre: 'ah' });

    expect(again?.cached).toBe(true);
    expect(files.size).toBe(1);
  });

  it('keeps a changed note as another file', async () => {
    const { service, files } = make();
    await service.render(score([60, 62]), { timbre: 'ah' });
    await service.render(score([60, 64]), { timbre: 'ah' });

    expect(files.size).toBe(2);
  });

  it('prunes to the size it was given after it writes', async () => {
    const { service, pruned } = make();
    await service.render(score([60]), { timbre: 'hum' });
    await Promise.resolve();

    expect(pruned).toEqual([1234]);
  });

  it('writes nothing when the render is cancelled', async () => {
    const { files } = make();
    const many = score(
      Array.from({ length: 200 }, (_, i) => 55 + (i % 12)),
      600,
    );
    let calls = 0;

    const result = await createSongAudioService({
      store: { find: async () => null, put: async () => 'x', prune: async () => {} },
      yieldToUi: async () => {},
      now: () => (calls += 10),
    }).render(many, { timbre: 'ah' }, { isCancelled: () => true });

    expect(result).toBeNull();
    expect(files.size).toBe(0);
  });

  it('reports its progress up to the whole', async () => {
    const fractions: number[] = [];

    await createSongAudioService({
      store: memoryStore().store,
      yieldToUi: async () => {},
      now: (() => {
        let clock = 0;
        return () => (clock += 20);
      })(),
    }).render(
      score(Array.from({ length: 30 }, (_, i) => 55 + (i % 9))),
      { timbre: 'la' },
      {
        onProgress: (fraction) => fractions.push(fraction),
      },
    );

    expect(fractions[fractions.length - 1]).toBe(1);
  });

  it('makes a short tone for a key, and the same one the second time', async () => {
    const { service, files } = make();

    const first = await service.tone(64, 'hum');
    const second = await service.tone(64, 'hum');
    await service.tone(65, 'hum');

    expect(second).toBe(first);
    expect(files.size).toBe(2);
  });
});
