import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStoryApiService } from '../../src/api/AdminStoryApiService';
import { StoryContent } from '../../src/pages/stories/StoryContent';
import { click, flush, render } from '../helpers/react';

vi.mock('../../src/api/AdminStoryApiService', () => ({
  AdminStoryApiService: {
    media: vi.fn(),
    boards: vi.fn(),
    sketches: vi.fn(),
    locationMaps: vi.fn(),
    blob: vi.fn(),
    entityTypes: vi.fn(),
    entities: vi.fn(),
  },
}));

const story = {
  id: 'story-1',
  title: 'A Queda',
  isNsfw: false,
  isDeleted: false,
  updatedAt: new Date().toISOString(),
  ownerUserId: 'user-1',
  ownerUsername: 'ana',
  ownerTag: 'ana#1',
  ownerDeleted: false,
} as const;

const media = (over: Record<string, unknown> = {}) => ({
  id: 'media-1',
  fileName: 'retrato.png',
  title: 'Retrato',
  mediaType: 'image',
  mimeType: 'image/png',
  sizeBytes: 12,
  hash: 'a'.repeat(32),
  sourceUrl: null,
  extraNotes: null,
  isFavorite: false,
  updatedAt: new Date().toISOString(),
  ...over,
});

const api = vi.mocked(AdminStoryApiService);

beforeEach(() => {
  vi.clearAllMocks();
  api.media.mockResolvedValue([]);
  api.boards.mockResolvedValue([]);
  api.sketches.mockResolvedValue([]);
  api.locationMaps.mockResolvedValue([]);
  api.blob.mockResolvedValue(new Blob(['bytes'], { type: 'image/png' }));
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

async function open() {
  const view = await render(<StoryContent story={{ ...story }} />);
  await click(view.container.querySelector('button')!);
  await flush();
  return view;
}

const goTo = async (view: { container: HTMLElement }, name: string) => {
  const tab = Array.from(view.container.querySelectorAll('[role="tab"]')).find(
    (entry) => entry.textContent === name,
  )!;
  await click(tab);
  await flush();
};

describe('StoryContent media', () => {
  it('previews video and audio, links out for links, and does not preview other files', async () => {
    api.media.mockResolvedValue([
      media({ id: 'v', mediaType: 'video', title: null, fileName: 'clip.mp4' }),
      media({ id: 'a', mediaType: 'audio', title: 'Tema', isFavorite: true }),
      media({
        id: 'l',
        mediaType: 'link',
        title: 'Fonte',
        sourceUrl: 'https://example.com/x',
        extraNotes: 'nota',
      }),
      media({ id: 'l2', mediaType: 'link', title: 'Sem url', sourceUrl: null }),
      media({ id: 'd', mediaType: 'document', title: 'Notas', sizeBytes: 5 * 1024 * 1024 }),
      media({ id: 'k', mediaType: 'document', title: 'Medio', sizeBytes: 2048 }),
    ]);
    const view = await open();
    await flush();

    expect(view.container.querySelector('video')?.getAttribute('src')).toBe('blob:preview');
    expect(view.container.querySelector('audio')?.getAttribute('src')).toBe('blob:preview');
    expect(view.container.querySelector('a[href="https://example.com/x"]')).not.toBeNull();
    expect(view.container.textContent).toContain('clip.mp4');
    expect(view.container.textContent).toContain('favorite');
    expect(view.container.textContent).toContain('nota');
    expect(view.container.textContent).toContain('5.0 MB');
    expect(view.container.textContent).toContain('2.0 KB');
    expect(view.container.textContent).toContain('12 B');
    // Only the previewable ones asked for bytes.
    expect(api.blob).toHaveBeenCalledTimes(2);
    await view.unmount();
  });

  it('says the preview is unavailable when the bytes cannot be read, and downloads on demand', async () => {
    api.media.mockResolvedValue([media()]);
    api.blob.mockRejectedValueOnce(new Error('gone'));
    const view = await open();
    await flush();
    expect(view.container.textContent).toContain('Preview unavailable.');

    const clicked = vi.fn();
    const create = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = create(tag);
      if (tag === 'a') element.click = clicked;
      return element;
    });
    const download = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Download',
    )!;
    await click(download);
    await flush();
    spy.mockRestore();

    expect(clicked).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    await view.unmount();
  });

  it('does not use a preview that arrives after the card was closed', async () => {
    let release: (blob: Blob) => void = () => {};
    api.media.mockResolvedValue([media()]);
    api.blob.mockReturnValue(new Promise<Blob>((resolve) => (release = resolve)));
    const view = await open();
    await view.unmount();

    release(new Blob(['late']));
    await flush();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe('StoryContent summaries', () => {
  it('lists the notes, arrows and descriptions of boards, sketches and maps', async () => {
    api.boards.mockResolvedValue([
      {
        id: 'b',
        name: 'Relações',
        description: 'Quem se liga a quem',
        updatedAt: new Date().toISOString(),
        summary: {
          nodeCount: 2,
          edgeCount: 1,
          entityPins: [
            { entityType: 'Character', entityId: 'c', label: 'Herói', note: 'protagonista' },
            { entityType: 'Item', entityId: 'i', label: 'Espada', note: null },
          ],
          notes: [
            { title: 'Lembrete', body: 'checar' },
            { title: 'Solto', body: null },
          ],
          edgeLabels: ['ama', 'teme'],
        },
      },
    ]);
    api.sketches.mockResolvedValue([
      {
        id: 's',
        name: 'Planta',
        description: 'Casa',
        updatedAt: new Date().toISOString(),
        summary: {
          layerCount: 1,
          strokeCount: 2,
          fillCount: 0,
          overlayCount: 0,
          kinds: {},
          texts: [],
        },
      },
    ]);
    api.locationMaps.mockResolvedValue([
      {
        id: 'm',
        name: 'Reino',
        description: 'O reino',
        updatedAt: new Date().toISOString(),
        summary: {
          imageCount: 1,
          nodeCount: 0,
          baseGalleryIds: [],
          locationIds: [],
          markers: [
            { title: 'Porta', note: 'rangendo' },
            { title: 'Janela', note: null },
          ],
          relationTexts: ['norte de', 'sul de'],
        },
      },
    ]);
    const view = await open();

    await goTo(view, 'Boards');
    for (const text of [
      'Quem se liga a quem',
      'protagonista',
      'Espada',
      'Lembrete',
      'checar',
      'Solto',
      'ama, teme',
    ]) {
      expect(view.container.textContent).toContain(text);
    }
    await goTo(view, 'Sketches');
    expect(view.container.textContent).toContain('Casa');
    await goTo(view, 'Maps');
    for (const text of ['O reino', 'rangendo', 'Janela', 'norte de · sul de']) {
      expect(view.container.textContent).toContain(text);
    }
    await view.unmount();
  });

  it('says each section is empty when the story stores nothing there', async () => {
    const view = await open();

    expect(view.container.textContent).toContain('No media files.');
    await goTo(view, 'Boards');
    expect(view.container.textContent).toContain('No boards.');
    await goTo(view, 'Sketches');
    expect(view.container.textContent).toContain('No sketches.');
    await goTo(view, 'Maps');
    expect(view.container.textContent).toContain('No location maps.');
    await view.unmount();
  });
});

describe('StoryContent entities', () => {
  it('shows each row by its best label with the raw values, and the empty state of a type', async () => {
    api.entityTypes.mockResolvedValue([
      { entityType: 'Note', liveCount: 0 },
      { entityType: 'Character', liveCount: 4 },
    ]);
    api.entities.mockResolvedValue({
      items: [
        { id: 'a', title: 'Titulo', extra: { x: 1 }, gone: null },
        { id: 'b', label: 'Rotulo', n: 3 },
        { id: 'c', name: '' },
        { n: 1 },
      ],
      total: 4,
      page: 1,
      pageSize: 25,
    });
    const view = await open();
    await goTo(view, 'Entities');
    await flush();

    expect(api.entities).toHaveBeenCalledWith('story-1', 'Character', 1);
    const summaries = Array.from(view.container.querySelectorAll('summary')).map(
      (entry) => entry.textContent,
    );
    expect(summaries.slice(0, 3)).toEqual(['Titulo', 'Rotulo', 'c']);
    expect(summaries[3]).toContain('"n":1');
    expect(view.container.textContent).toContain('{"x":1}');
    expect(view.container.textContent).toContain('—');

    api.entities.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    const select = view.container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(select, 'Note');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
    expect(view.container.textContent).toContain('No rows of this type.');
    await view.unmount();
  });

  it('reports a failure of the entity types or of the rows of a type', async () => {
    api.entityTypes.mockRejectedValue(new Error('Types failed.'));
    const first = await open();
    await goTo(first, 'Entities');
    await flush();
    expect(first.container.textContent).toContain('Types failed.');
    await first.unmount();

    api.entityTypes.mockResolvedValue([{ entityType: 'Character', liveCount: 1 }]);
    api.entities.mockRejectedValue('plain');
    const second = await open();
    await goTo(second, 'Entities');
    await flush();
    await flush();
    expect(second.container.querySelector('.error-text')).not.toBeNull();
    await second.unmount();
  });
});

describe('StoryContent late and odd answers', () => {
  it('names an image by its file when it has no title, and survives an answer that is not an Error', async () => {
    api.media.mockResolvedValue([media({ title: null })]);
    const view = await open();
    await flush();
    expect(view.container.querySelector('img')?.getAttribute('alt')).toBe('retrato.png');
    await view.unmount();

    api.media.mockRejectedValue('plain');
    const failed = await open();
    expect(failed.container.querySelector('.error-text')?.textContent).toBe('Action failed.');
    await failed.unmount();
  });

  it('ignores what arrives after the viewer was closed', async () => {
    let failBlob: (reason: unknown) => void = () => {};
    api.media.mockResolvedValue([media()]);
    api.blob.mockReturnValue(new Promise<Blob>((_, reject) => (failBlob = reject)));
    const media_ = await open();
    await media_.unmount();
    failBlob(new Error('late'));
    await flush();

    let resolveTypes: (types: Array<{ entityType: string; liveCount: number }>) => void = () => {};
    let rejectTypes: (reason: unknown) => void = () => {};
    let resolveRows: (rows: unknown) => void = () => {};
    let rejectRows: (reason: unknown) => void = () => {};
    api.media.mockResolvedValue([]);
    api.entityTypes.mockReturnValueOnce(new Promise((resolve) => (resolveTypes = resolve)));
    const first = await open();
    await goTo(first, 'Entities');
    await first.unmount();
    resolveTypes([{ entityType: 'Character', liveCount: 1 }]);
    await flush();

    api.entityTypes.mockReturnValueOnce(new Promise((_, reject) => (rejectTypes = reject)));
    const second = await open();
    await goTo(second, 'Entities');
    await second.unmount();
    rejectTypes(new Error('late'));
    await flush();

    api.entityTypes.mockResolvedValue([{ entityType: 'Character', liveCount: 1 }]);
    api.entities.mockReturnValueOnce(new Promise((resolve) => (resolveRows = resolve)) as never);
    const third = await open();
    await goTo(third, 'Entities');
    await third.unmount();
    resolveRows({ items: [], total: 0, page: 1, pageSize: 25 });
    await flush();

    api.entities.mockReturnValueOnce(new Promise((_, reject) => (rejectRows = reject)) as never);
    const fourth = await open();
    await goTo(fourth, 'Entities');
    await fourth.unmount();
    rejectRows(new Error('late'));
    await flush();
  });

  it('selects nothing when no entity type has rows, and does not load any', async () => {
    api.entityTypes.mockResolvedValue([{ entityType: 'Note', liveCount: 0 }]);
    const view = await open();
    await goTo(view, 'Entities');
    await flush();

    expect(api.entities).not.toHaveBeenCalled();
    expect((view.container.querySelector('select') as HTMLSelectElement).value).toBe('Note');
    await view.unmount();
  });

  it('shows a generic message when the types fail with something that is not an Error', async () => {
    api.entityTypes.mockRejectedValue('plain');
    const view = await open();
    await goTo(view, 'Entities');
    await flush();

    expect(view.container.textContent).toContain('Action failed.');
    await view.unmount();
  });
});
