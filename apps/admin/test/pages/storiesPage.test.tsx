import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStoryApiService } from '../../src/api/AdminStoryApiService';
import { StoriesPage } from '../../src/pages/stories/StoriesPage';
import { changeInput, click, flush, render, submit } from '../helpers/react';

vi.mock('../../src/api/AdminStoryApiService', () => ({
  AdminStoryApiService: {
    list: vi.fn(),
    collaborators: vi.fn(),
    removeCollaborator: vi.fn(),
    setNsfw: vi.fn(),
    media: vi.fn(),
    boards: vi.fn(),
    sketches: vi.fn(),
    locationMaps: vi.fn(),
    blob: vi.fn(),
    entityTypes: vi.fn(),
    entities: vi.fn(),
  },
}));

const story = (over: Record<string, unknown> = {}) => ({
  id: 'story-1',
  title: 'A Queda',
  isNsfw: false,
  isDeleted: false,
  updatedAt: '2026-03-01T10:00:00.000Z',
  ownerUserId: 'user-1',
  ownerUsername: 'ana',
  ownerTag: 'ana#1',
  ownerDeleted: false,
  ...over,
});

const collaborator = (over: Record<string, unknown> = {}) => ({
  permissionId: 'perm-1',
  userId: 'user-2',
  username: 'beto',
  tag: 'beto#2',
  permissionType: 'editor',
  ...over,
});

const list = vi.mocked(AdminStoryApiService);

async function open() {
  const view = await render(
    <MemoryRouter>
      <StoriesPage />
    </MemoryRouter>,
  );
  await flush();
  return view;
}

const buttonNamed = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll('button')).find((button) => button.textContent === text)!;

beforeEach(() => {
  vi.clearAllMocks();
  list.list.mockResolvedValue({ items: [story()], total: 1, page: 1, pageSize: 25 });
  list.collaborators.mockResolvedValue([collaborator()]);
  list.removeCollaborator.mockResolvedValue(undefined as never);
  list.setNsfw.mockResolvedValue({ id: 'story-1', isNsfw: true } as never);
  list.media.mockResolvedValue([]);
  list.boards.mockResolvedValue([]);
  list.sketches.mockResolvedValue([]);
  list.locationMaps.mockResolvedValue([]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('StoriesPage', () => {
  it('lists the stories with their owner and asks for the first page', async () => {
    const view = await open();

    expect(list.list).toHaveBeenCalledWith({
      search: undefined,
      nsfw: undefined,
      page: 1,
      pageSize: 25,
    });
    expect(view.container.textContent).toContain('A Queda');
    expect(view.container.textContent).toContain('@ana#1');
    expect(view.container.querySelector('a[href="/users/user-1"]')).not.toBeNull();
    await view.unmount();
  });

  it('says so when there is nothing, and shows the owner of a deleted account', async () => {
    list.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
    const empty = await open();
    expect(empty.container.textContent).toContain('No stories found.');
    await empty.unmount();

    list.list.mockResolvedValue({
      items: [story({ ownerDeleted: true, isDeleted: true })],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    const deleted = await open();
    expect(deleted.container.textContent).toContain('(deleted account)');
    expect(deleted.container.querySelector('tr.row-deleted')).not.toBeNull();
    await deleted.unmount();
  });

  it('shows the failure when the list cannot be read', async () => {
    list.list.mockRejectedValue(new Error('Offline.'));
    const view = await open();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Offline.');
    await view.unmount();
  });

  it('searches by title from page one and filters by the adults-only flag', async () => {
    const view = await open();
    const input = view.container.querySelector('input') as HTMLInputElement;
    await changeInput(input, '  queda ');
    await submit(view.container.querySelector('form') as HTMLFormElement);
    await flush();

    expect(list.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'queda', page: 1 }),
    );

    const select = view.container.querySelector('select') as HTMLSelectElement;
    await changeInput(select, 'nsfw');
    await flush();
    expect(list.list).toHaveBeenLastCalledWith(expect.objectContaining({ nsfw: true }));

    await changeInput(select, 'safe');
    await flush();
    expect(list.list).toHaveBeenLastCalledWith(expect.objectContaining({ nsfw: false }));
    await view.unmount();
  });

  it('pages through the results', async () => {
    list.list.mockResolvedValue({ items: [story()], total: 60, page: 1, pageSize: 25 });
    const view = await open();
    expect(view.container.querySelector('.pagination')?.textContent).toContain('60');

    await click(buttonNamed(view.container, 'Next'));
    await flush();
    expect(list.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

    await click(buttonNamed(view.container, 'Previous'));
    await flush();
    expect(list.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    await view.unmount();
  });

  it('flags a story as adults-only only after confirming, and updates the row', async () => {
    const view = await open();

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click(buttonNamed(view.container, 'Flag +18'));
    await flush();
    expect(list.setNsfw).not.toHaveBeenCalled();

    await click(buttonNamed(view.container, 'Flag +18'));
    await flush();
    expect(list.setNsfw).toHaveBeenCalledWith('story-1', true);
    expect(view.container.querySelector('.status-badge')?.textContent).toBe('+18');
    expect(buttonNamed(view.container, 'Unflag')).toBeDefined();
    await view.unmount();
  });

  it('unflags without asking, and shows a failure of the change', async () => {
    list.list.mockResolvedValue({
      items: [story({ isNsfw: true })],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    list.setNsfw.mockResolvedValue({ id: 'story-1', isNsfw: false } as never);
    const view = await open();

    await click(buttonNamed(view.container, 'Unflag'));
    await flush();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(list.setNsfw).toHaveBeenCalledWith('story-1', false);

    list.setNsfw.mockRejectedValue(new Error('No access.'));
    await click(buttonNamed(view.container, 'Flag +18'));
    await flush();
    expect(view.container.querySelector('.error-text')?.textContent).toBe('No access.');
    await view.unmount();
  });

  it('opens and hides the story content', async () => {
    const view = await open();

    await click(buttonNamed(view.container, 'Content'));
    await flush();
    const inner = view.container.querySelector('tbody tr:nth-child(2) button') as HTMLButtonElement;
    await click(inner);
    await flush();
    expect(list.media).toHaveBeenCalledWith('story-1');
    expect(buttonNamed(view.container, 'Hide').getAttribute('aria-expanded')).toBe('true');

    await click(buttonNamed(view.container, 'Hide'));
    await flush();
    expect(buttonNamed(view.container, 'Content').getAttribute('aria-expanded')).toBe('false');
    await view.unmount();
  });

  it('lists the collaborators, removes one after confirming, and says when there are none', async () => {
    const view = await open();

    await click(buttonNamed(view.container, 'Show'));
    await flush();
    expect(view.container.textContent).toContain('@beto#2');
    expect(view.container.textContent).toContain('(editor)');

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await click(buttonNamed(view.container, 'Delete'));
    await flush();
    expect(list.removeCollaborator).not.toHaveBeenCalled();

    await click(buttonNamed(view.container, 'Delete'));
    await flush();
    expect(list.removeCollaborator).toHaveBeenCalledWith('story-1', 'user-2');
    expect(view.container.textContent).toContain('No collaborators.');
    await view.unmount();
  });

  it('shows why the collaborators or their removal failed', async () => {
    list.collaborators.mockRejectedValue(new Error('Nope.'));
    const failed = await open();
    await click(buttonNamed(failed.container, 'Show'));
    await flush();
    expect(failed.container.textContent).toContain('Nope.');
    await failed.unmount();

    list.collaborators.mockResolvedValue([collaborator()]);
    list.removeCollaborator.mockRejectedValue(new Error('Still there.'));
    const stuck = await open();
    await click(buttonNamed(stuck.container, 'Show'));
    await flush();
    await click(buttonNamed(stuck.container, 'Delete'));
    await flush();
    expect(stuck.container.textContent).toContain('Still there.');
    await stuck.unmount();
  });
});

describe('StoriesPage odd answers', () => {
  it('shows a generic message when a change fails with something that is not an Error', async () => {
    list.setNsfw.mockRejectedValue('plain');
    const flagged = await open();
    await click(buttonNamed(flagged.container, 'Flag +18'));
    await flush();
    expect(flagged.container.querySelector('.error-text')?.textContent).toBe('Action failed.');
    await flagged.unmount();

    list.collaborators.mockRejectedValue('plain');
    const loading = await open();
    await click(buttonNamed(loading.container, 'Show'));
    await flush();
    expect(loading.container.textContent).toContain('Action failed.');
    await loading.unmount();

    list.collaborators.mockResolvedValue([collaborator()]);
    list.removeCollaborator.mockRejectedValue('plain');
    const removing = await open();
    await click(buttonNamed(removing.container, 'Show'));
    await flush();
    await click(buttonNamed(removing.container, 'Delete'));
    await flush();
    expect(removing.container.textContent).toContain('Action failed.');
    await removing.unmount();
  });

  it('ignores a list that arrives after the page was closed', async () => {
    let resolve: (value: unknown) => void = () => {};
    let reject: (reason: unknown) => void = () => {};
    list.list.mockReturnValueOnce(new Promise((done) => (resolve = done)) as never);
    const first = await render(
      <MemoryRouter>
        <StoriesPage />
      </MemoryRouter>,
    );
    await first.unmount();
    resolve({ items: [story()], total: 1, page: 1, pageSize: 25 });
    await flush();

    list.list.mockReturnValueOnce(new Promise((_, fail) => (reject = fail)) as never);
    const second = await render(
      <MemoryRouter>
        <StoriesPage />
      </MemoryRouter>,
    );
    await second.unmount();
    reject(new Error('late'));
    await flush();
  });
});
