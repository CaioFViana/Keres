import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStoryApiService } from '../../src/api/AdminStoryApiService';
import { StoryContent } from '../../src/pages/stories/StoryContent';
import { click, flush, render } from '../helpers/react';

vi.mock('../../src/api/AdminStoryApiService', () => ({
  AdminStoryApiService: {
    media: vi.fn(),
    boards: vi.fn(),
    locationMaps: vi.fn(),
    blob: vi.fn(),
    entityTypes: vi.fn(),
    entities: vi.fn(),
  },
}));

const story = {
  id: 'story-1',
  title: 'A Queda',
  isNsfw: true,
  isDeleted: false,
  updatedAt: new Date().toISOString(),
  ownerUserId: 'user-1',
  ownerUsername: 'ana',
  ownerTag: 'ana#1',
  ownerDeleted: false,
} as const;

const mediaItem = {
  id: 'media-1',
  fileName: 'retrato.png',
  title: 'Retrato',
  mediaType: 'image',
  mimeType: 'image/png',
  sizeBytes: 12,
  hash: 'a'.repeat(32),
  sourceUrl: null,
  extraNotes: 'rascunho',
  isFavorite: false,
  updatedAt: new Date().toISOString(),
};

const boardRow = {
  id: 'board-1',
  name: 'Relações',
  description: null,
  updatedAt: new Date().toISOString(),
  summary: {
    nodeCount: 1,
    edgeCount: 0,
    entityPins: [{ entityType: 'Character', entityId: 'char-1', label: 'Herói', note: null }],
    notes: [],
    edgeLabels: [],
  },
};

const mapRow = {
  id: 'map-1',
  name: 'Reino',
  description: null,
  updatedAt: new Date().toISOString(),
  summary: {
    imageCount: 1,
    nodeCount: 0,
    baseGalleryIds: ['media-1'],
    locationIds: [],
    markers: [{ title: 'Tesouro', note: 'atrás da porta' }],
    relationTexts: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminStoryApiService.media).mockResolvedValue([mediaItem]);
  vi.mocked(AdminStoryApiService.boards).mockResolvedValue([boardRow]);
  vi.mocked(AdminStoryApiService.locationMaps).mockResolvedValue([mapRow]);
  vi.mocked(AdminStoryApiService.blob).mockResolvedValue(
    new Blob(['bytes'], { type: 'image/png' }),
  );
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

async function open() {
  const view = await render(<StoryContent story={{ ...story }} />);
  await click(view.container.querySelector('button')!);
  await flush();
  return view;
}

describe('StoryContent moderation viewer', () => {
  it('loads media, boards and maps in parallel when opened', async () => {
    const view = await open();

    expect(AdminStoryApiService.media).toHaveBeenCalledWith('story-1');
    expect(AdminStoryApiService.boards).toHaveBeenCalledWith('story-1');
    expect(AdminStoryApiService.locationMaps).toHaveBeenCalledWith('story-1');
    expect(view.container.textContent).toContain('Retrato');
    await view.unmount();
  });

  it('previews the image bytes behind the story hash', async () => {
    const view = await open();
    await flush();

    const img = view.container.querySelector('img');
    expect(AdminStoryApiService.blob).toHaveBeenCalledWith('story-1', mediaItem.hash);
    expect(img?.getAttribute('src')).toBe('blob:preview');
    await view.unmount();
  });

  it('switches to the board and map summaries', async () => {
    const view = await open();
    const tabs = Array.from(view.container.querySelectorAll('[role="tab"]'));

    await click(tabs.find((tab) => tab.textContent === 'Boards')!);
    await flush();
    expect(view.container.textContent).toContain('Herói');

    await click(tabs.find((tab) => tab.textContent === 'Maps')!);
    await flush();
    expect(view.container.textContent).toContain('Tesouro');
    await view.unmount();
  });

  it('shows empty states when the story stores nothing yet', async () => {
    vi.mocked(AdminStoryApiService.media).mockResolvedValue([]);
    vi.mocked(AdminStoryApiService.boards).mockResolvedValue([]);
    vi.mocked(AdminStoryApiService.locationMaps).mockResolvedValue([]);

    const view = await open();

    expect(view.container.textContent).toContain('No media files.');
    await view.unmount();
  });

  it('shows the failure instead of an empty viewer', async () => {
    vi.mocked(AdminStoryApiService.media).mockRejectedValue(new Error('No acesso.'));

    const view = await open();

    expect(view.container.textContent).toContain('No acesso.');
    await view.unmount();
  });

  it('browses raw entity rows on the entities tab', async () => {
    vi.mocked(AdminStoryApiService.entityTypes).mockResolvedValue([
      { entityType: 'Character', liveCount: 1 },
      { entityType: 'Note', liveCount: 0 },
    ]);
    vi.mocked(AdminStoryApiService.entities).mockResolvedValue({
      items: [{ id: 'char-1', name: 'Herói', description: 'protagonista' }],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    const view = await open();
    const tabs = Array.from(view.container.querySelectorAll('[role="tab"]'));
    await click(tabs.find((tab) => tab.textContent === 'Entities')!);
    await flush();
    await flush();

    expect(AdminStoryApiService.entityTypes).toHaveBeenCalledWith('story-1');
    expect(AdminStoryApiService.entities).toHaveBeenCalledWith('story-1', 'Character', 1);
    expect(view.container.textContent).toContain('Character (1)');
    expect(view.container.textContent).toContain('Herói');
    expect(view.container.textContent).toContain('protagonista');
    await view.unmount();
  });

  it('advances entity pages through the pagination controls', async () => {
    vi.mocked(AdminStoryApiService.entityTypes).mockResolvedValue([
      { entityType: 'OperationLog', liveCount: 3 },
    ]);
    vi.mocked(AdminStoryApiService.entities).mockImplementation(async (_story, _type, page) => ({
      items: [{ id: `op-${page}` }],
      total: 3,
      page: page ?? 1,
      pageSize: 2,
    }));

    const view = await open();
    const tabs = Array.from(view.container.querySelectorAll('[role="tab"]'));
    await click(tabs.find((tab) => tab.textContent === 'Entities')!);
    await flush();
    await flush();

    expect(view.container.textContent).toContain('Page 1 of 2 (3 total)');
    const next = Array.from(view.container.querySelectorAll('.pagination button')).find(
      (button) => button.textContent === 'Next',
    )!;
    await click(next);
    await flush();
    await flush();

    expect(AdminStoryApiService.entities).toHaveBeenLastCalledWith('story-1', 'OperationLog', 2);
    expect(view.container.textContent).toContain('Page 2 of 2 (3 total)');
    await view.unmount();
  });
});
