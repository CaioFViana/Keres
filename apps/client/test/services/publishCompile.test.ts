/** @jest-environment node */
import {
  compileStoryReader,
  FORMAT_META,
  type ManuscriptFormat,
  type ManuscriptImage,
} from '@keres/shared';
import { compileStoryManuscript } from '@keres/shared/manuscript/export';
import type { TFunction } from 'i18next';
import {
  buildPublishCompileInput,
  renderPublishManuscript,
  renderPublishReader,
  type PublishCompileRows,
} from '../../src/services/storymanagement/PublishCompileService';

jest.mock('../../src/components/features/manuscript/export/pdfFontAssets', () => ({
  __esModule: true,
  pdfFontMatrices: async () => null,
}));

// The publisher's language stand-in: the key with its params beside it, so
// names flowing through the sentences stay visible without a real catalog.
const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

// A 1x1 PNG: enough for the pipeline to embed, small enough to stay fast.
const DOT_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
  0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
  0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08,
  0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59,
  0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

function linearRows(overrides: Partial<PublishCompileRows> = {}): PublishCompileRows {
  return {
    storyTitle: 'The Quiet Valley',
    storyType: 'linear',
    chapters: [{ id: 'ch-1', name: 'Arrival', index: 1, type: 'chapter', arcId: null }],
    scenes: [
      {
        id: 's-1',
        chapterId: 'ch-1',
        name: 'Opening',
        index: 1,
        body: 'Waves break on the shore. 漢字も混じる。',
        isDeleted: false,
        isStart: false,
        summary: null,
        locationId: null,
      },
    ],
    choices: [],
    locations: [],
    arcs: [],
    groups: [],
    checks: [],
    effects: [],
    items: [],
    ...overrides,
  };
}

function branchingRows(): PublishCompileRows {
  return {
    storyTitle: 'Crossroads',
    storyType: 'branching',
    chapters: [],
    scenes: [
      {
        id: 's-1',
        chapterId: null,
        name: 'Gate',
        index: 1,
        body: 'Two doors.',
        isDeleted: false,
        isStart: true,
        summary: null,
        locationId: null,
      },
      {
        id: 's-2',
        chapterId: null,
        name: 'Garden',
        index: 2,
        body: 'Quiet green.',
        isDeleted: false,
        isStart: false,
        summary: null,
        locationId: null,
      },
    ],
    choices: [{ id: 'c-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Step through' }],
    locations: [],
    arcs: [],
    groups: [{ id: 'g-1', choiceId: 'c-1', combinator: 'AND', order: 1, isDeleted: false }],
    checks: [
      {
        groupId: 'g-1',
        mode: 'block',
        type: 'inventory',
        order: 1,
        sceneId: null,
        minVisits: null,
        itemId: 'item-1',
        itemPresence: 'lacks',
        triggerName: null,
        triggerState: null,
        isDeleted: false,
      },
    ],
    effects: [
      {
        entityType: 'Choice',
        entityId: 'c-1',
        effectType: 'triggerSet',
        itemId: null,
        triggerName: 'met-gardener',
        isDeleted: false,
      },
      {
        entityType: 'Choice',
        entityId: 'c-1',
        effectType: 'itemGrant',
        itemId: 'item-1',
        triggerName: null,
        isDeleted: false,
      },
    ],
    items: [{ id: 'item-1', name: 'Brass Key' }],
  };
}

describe('buildPublishCompileInput', () => {
  it('puts choice requirements and effects into words', () => {
    const input = buildPublishCompileInput(branchingRows(), t);

    expect(input.storyType).toBe('branching');
    expect(input.choices).toHaveLength(1);
    expect(input.choices[0].requirements).toBeDefined();
    expect(input.choices[0].requirements?.join(' ')).toContain('Brass Key');
    expect(input.choices[0].effects?.join(' ')).toContain('met-gardener');
  });

  it('carries the raw rules the reader plays by', () => {
    const input = buildPublishCompileInput(branchingRows(), t);

    expect(input.rules?.groups).toHaveLength(1);
    expect(input.rules?.checks).toHaveLength(1);
    expect(input.rules?.effects).toHaveLength(2);
    expect(input.rules?.items).toEqual([{ id: 'item-1', name: 'Brass Key' }]);
  });

  it('resolves scene places by id', () => {
    const input = buildPublishCompileInput(
      linearRows({
        locations: [{ id: 'loc-1', name: 'Harbor', intExt: 'exterior' }],
        scenes: [
          {
            id: 's-1',
            chapterId: 'ch-1',
            name: 'Opening',
            index: 1,
            body: 'Waves.',
            isDeleted: false,
            isStart: false,
            summary: 'A return.',
            locationId: 'loc-1',
          },
        ],
      }),
      t,
    );

    expect(input.scenes[0]).toMatchObject({
      locationName: 'Harbor',
      locationIntExt: 'exterior',
      summary: 'A return.',
    });
  });
});

describe('renderPublishManuscript parity', () => {
  // The renderers stamp wall-clock dates into their output (a docx always
  // differs from the one compiled a millisecond later, wherever it runs), so
  // both sides of each comparison compile under the same frozen clock. Only
  // the clock is frozen: the zip packers need their real timers.
  const RealDate = globalThis.Date;
  class FrozenDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if ((args as unknown[]).length === 0) super('2026-03-04T05:06:07.000Z');
      else super(...args);
    }
    static override now(): number {
      return new RealDate('2026-03-04T05:06:07.000Z').getTime();
    }
  }
  beforeEach(() => {
    globalThis.Date = FrozenDate as unknown as typeof Date;
  });
  afterEach(() => {
    globalThis.Date = RealDate;
  });

  const formats: ManuscriptFormat[] = [
    'md',
    'txt',
    'html',
    'docx',
    'epub',
    'pdf',
    'fountain',
    'screenplay-pdf',
  ];

  it.each(formats)(
    'compiles the same bytes as the shared compiler for %s',
    async (format) => {
      const input = buildPublishCompileInput(linearRows(), t);
      const options = { format, language: 'en' } as const;

      const throughService = await renderPublishManuscript(input, { ...options });
      const direct = await compileStoryManuscript(input, { ...options }, undefined);

      expect(throughService.format).toBe(format);
      expect(throughService.extension).toBe(FORMAT_META[format].extension);
      expect(throughService.mimeType).toBe(FORMAT_META[format].mimeType);
      expect(throughService.bytes).toEqual(direct.bytes);
    },
    60000,
  );

  it('stays byte-identical with a cover, page pictures and sung songs', async () => {
    const input = buildPublishCompileInput(
      linearRows({
        scenes: [
          {
            id: 's-1',
            chapterId: 'ch-1',
            name: 'Opening',
            index: 1,
            body: 'Waves. 漢字',
            isDeleted: false,
            isStart: false,
            summary: null,
            locationId: null,
            pages: [{ id: 'p-1', mediaId: 'pic-1', fit: 'cover', text: null }],
            music: [
              {
                id: 'm-1',
                role: 'in-world',
                title: 'Harbor Song',
                cue: null,
                song: {
                  id: 'song-1',
                  title: 'Harbor Song',
                  lyrics: '[Verse]\nWaves\n',
                  lyricsTranslation: null,
                  sections: ['Verse'],
                },
              },
            ],
          },
        ],
      }),
      t,
    );
    const media: Record<string, ManuscriptImage> = {
      'pic-1': { mimeType: 'image/png', width: 1, height: 1, bytes: DOT_PNG },
      'cover:g-1': { mimeType: 'image/png', width: 1, height: 1, bytes: DOT_PNG },
    };
    const withMedia = { ...input, media, cover: 'cover:g-1' };
    const options = {
      format: 'html',
      language: 'en',
      includeSongs: true,
      songLanguage: 'sung',
    } as const;

    const throughService = await renderPublishManuscript(withMedia, { ...options });
    const direct = await compileStoryManuscript(withMedia, { ...options }, undefined);

    expect(throughService.bytes).toEqual(direct.bytes);
    expect(new TextDecoder().decode(throughService.bytes)).toContain('Harbor Song');
  });

  it('throws past the shared byte cap instead of storing the oversized', async () => {
    const input = buildPublishCompileInput(
      linearRows({
        scenes: [
          {
            id: 's-1',
            chapterId: 'ch-1',
            name: 'Opening',
            index: 1,
            body: `x${'y'.repeat(101 * 1024 * 1024)}`,
            isDeleted: false,
            isStart: false,
            summary: null,
            locationId: null,
          },
        ],
      }),
      t,
    );

    await expect(
      renderPublishManuscript(input, { format: 'txt', language: 'en' }),
    ).rejects.toThrow(/exceeds the .* limit/);
  }, 120000);
});

describe('renderPublishReader wiring', () => {
  it('serves a self-contained branching page honoring checks and effects', () => {
    const input = buildPublishCompileInput(branchingRows(), t);

    const throughService = renderPublishReader(input, { language: 'en' });
    const direct = compileStoryReader(input, { language: 'en' });

    expect(throughService.mimeType).toBe('text/html; charset=utf-8');
    expect(throughService.bytes).toEqual(direct.bytes);
    const html = new TextDecoder().decode(throughService.bytes);
    expect(html).toContain('id="story-data"');
    expect(html).toContain('met-gardener');
    expect(html).toContain('Brass Key');
  });

  it('serves the linear manuscript as its reading page', () => {
    const input = buildPublishCompileInput(linearRows(), t);

    const throughService = renderPublishReader(input, { language: 'en' });

    expect(new TextDecoder().decode(throughService.bytes)).toContain('Waves break');
  });

  it('throws past the shared byte cap', () => {
    const input = buildPublishCompileInput(
      linearRows({
        scenes: [
          {
            id: 's-1',
            chapterId: 'ch-1',
            name: 'Opening',
            index: 1,
            body: `x${'y'.repeat(101 * 1024 * 1024)}`,
            isDeleted: false,
            isStart: false,
            summary: null,
            locationId: null,
          },
        ],
      }),
      t,
    );

    expect(() => renderPublishReader(input, { language: 'en' })).toThrow(/exceeds the .* limit/);
  }, 120000);
});
