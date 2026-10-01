import type { ReactElement } from 'react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LogsPage } from '../../src/pages/logs/LogsPage';
import { RecoveryPage } from '../../src/pages/recovery/RecoveryPage';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  listLogs: vi.fn(),
  listDeleted: vi.fn(),
  restoreDeleted: vi.fn(),
  browseOperationLog: vi.fn(),
}));

vi.mock('../../src/api/LogsApiService', () => ({ LogsApiService: { list: mocks.listLogs } }));
vi.mock('../../src/api/RecoveryApiService', () => ({
  RecoveryApiService: {
    listDeleted: mocks.listDeleted,
    restore: mocks.restoreDeleted,
    browseOperationLog: mocks.browseOperationLog,
  },
}));

const withRouter = (page: ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

async function keyDown(element: Element, key: string): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

const logEntry = (over: Record<string, unknown> = {}) => ({
  id: 'log-1',
  level: 'error',
  message: 'Push rejected: stale base.',
  meta: { storyId: 'story-1', op: 'update' },
  userId: 'user-1',
  username: 'ana',
  storyId: 'story-1',
  storyTitle: 'Demo Story',
  createdAt: '2026-08-19T10:00:00.000Z',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listLogs.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  mocks.listDeleted.mockResolvedValue([]);
  mocks.restoreDeleted.mockResolvedValue({});
  mocks.browseOperationLog.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('alert', vi.fn());
});

describe('logs page', () => {
  it('shows the detail of the selected entry', async () => {
    mocks.listLogs.mockResolvedValue({
      items: [logEntry()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<LogsPage />);
    await flush();
    expect(view.container.querySelector('.detail-panel')).toBeNull();

    await click(view.container.querySelector('tbody tr')!);
    await flush();

    const panel = view.container.querySelector('.detail-panel');
    expect(panel?.textContent).toContain('Push rejected: stale base.');
    expect(panel?.textContent).toContain('Demo Story');
    expect(panel?.textContent).toContain('story-1');
    await view.unmount();
  });

  it('selects a row from the keyboard, and ignores other keys', async () => {
    mocks.listLogs.mockResolvedValue({
      items: [logEntry()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<LogsPage />);
    await flush();
    const row = view.container.querySelector('tbody tr')!;

    await keyDown(row, 'Tab');
    await flush();
    expect(view.container.querySelector('.detail-panel')).toBeNull();

    await keyDown(row, 'Enter');
    await flush();
    expect(view.container.querySelector('.detail-panel')).not.toBeNull();
    await view.unmount();
  });

  it('pages through the log', async () => {
    mocks.listLogs.mockResolvedValue({ items: [], total: 120, page: 1, pageSize: 50 });
    const view = await withRouter(<LogsPage />);
    await flush();
    const [previous, next] = Array.from(
      view.container.querySelectorAll('.pagination button'),
    ) as HTMLButtonElement[];
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    await click(next);
    await flush();
    expect(mocks.listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    await view.unmount();
  });

  it('shows a failure instead of a stuck spinner', async () => {
    mocks.listLogs.mockRejectedValue(new Error('Log store is down.'));
    const view = await withRouter(<LogsPage />);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Log store is down.');
    await view.unmount();
  });

  it('sends every filter the operator fills in', async () => {
    const view = await withRouter(<LogsPage />);
    await flush();
    const inputs = view.container.querySelector('.toolbar')!.querySelectorAll('input');

    await changeInput(inputs[0], 'story-1');
    await changeInput(inputs[1], 'user-1');
    await changeInput(inputs[2], 'stale base');
    await submit(view.container.querySelector('form')!);
    await flush();

    expect(mocks.listLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ storyId: 'story-1', userId: 'user-1', search: 'stale base' }),
    );
    await view.unmount();
  });

  it('filters by date range and walks back a page', async () => {
    mocks.listLogs.mockResolvedValue({ items: [], total: 120, page: 1, pageSize: 50 });
    const view = await withRouter(<LogsPage />);
    await flush();
    const inputs = view.container.querySelector('.toolbar')!.querySelectorAll('input');

    await changeInput(inputs[3], '2026-08-01');
    await changeInput(inputs[4], '2026-08-19');
    await submit(view.container.querySelector('form')!);
    await flush();
    expect(mocks.listLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-08-01', to: '2026-08-19', page: 1 }),
    );

    const [previous, next] = Array.from(view.container.querySelectorAll('.pagination button'));
    await click(next);
    await flush();
    await click(previous);
    await flush();
    expect(mocks.listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    await view.unmount();
  });

  it('ignores a listing that outlives the page', async () => {
    let resolveList!: (value: unknown) => void;
    mocks.listLogs.mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    const view = await withRouter(<LogsPage />);
    await view.unmount();

    resolveList({ items: [logEntry()], total: 1, page: 1, pageSize: 50 });
    await flush();
  });

  it('ignores a listing failure that outlives the page', async () => {
    let rejectList!: (reason: unknown) => void;
    mocks.listLogs.mockReturnValue(new Promise((_resolve, reject) => (rejectList = reject)));
    const view = await withRouter(<LogsPage />);
    await view.unmount();

    rejectList(new Error('Log store is down.'));
    await flush();
  });

  it('shows dashes in the detail when the entry carries no names', async () => {
    mocks.listLogs.mockResolvedValue({
      items: [logEntry({ storyTitle: null, storyId: null, username: null, userId: null })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<LogsPage />);
    await flush();

    await click(view.container.querySelector('tbody tr')!);
    await flush();

    const defs = Array.from(view.container.querySelectorAll('.detail-panel dd')).map(
      (node) => node.textContent,
    );
    expect(defs).toContain('-');
    await view.unmount();
  });

  it('falls back to ids, then to a dash, when names are missing', async () => {
    mocks.listLogs.mockResolvedValue({
      items: [
        logEntry({ storyTitle: null, username: null }),
        logEntry({ id: 'log-2', storyTitle: null, storyId: null, username: null, userId: null }),
      ],
      total: 2,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<LogsPage />);
    await flush();

    const rows = view.container.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('story-1');
    expect(rows[0].textContent).toContain('user-1');
    expect(rows[1].textContent).toContain('-');
    await view.unmount();
  });
});

describe('recovery page', () => {
  const deletedItem = (over: Record<string, unknown> = {}) => ({
    entityType: 'Character',
    id: 'char-1',
    storyId: 'story-1',
    storyTitle: 'Demo Story',
    deletedAt: '2026-08-19T10:00:00.000Z',
    version: 4,
    name: 'Ana',
    ...over,
  });

  const logRow = (over: Record<string, unknown> = {}) => ({
    id: 'op-1',
    storyId: 'story-1',
    storyTitle: 'Demo Story',
    userId: 'user-1',
    username: 'ana',
    operationVersion: 12,
    operationType: 'delete',
    entityType: 'Character',
    entityId: 'char-1',
    entityName: 'Ana',
    payload: { id: 'char-1' },
    entityVersion: 4,
    createdAt: '2026-08-19T10:00:00.000Z',
    ...over,
  });

  it('restores nothing when the operator cancels the confirmation', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );
    mocks.listDeleted.mockResolvedValue([deletedItem()]);
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[0]);
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Restore',
      )!,
    );
    await flush();

    expect(mocks.restoreDeleted).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Ana');
    await view.unmount();
  });

  it('reports a restore failure and keeps the row', async () => {
    mocks.listDeleted.mockResolvedValue([deletedItem()]);
    mocks.restoreDeleted.mockRejectedValue(new Error('Already restored.'));
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[0]);
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Restore',
      )!,
    );
    await flush();

    expect(window.alert).toHaveBeenCalledWith('Already restored.');
    expect(view.container.textContent).toContain('Ana');
    await view.unmount();
  });

  it('restores an unnamed row by its id', async () => {
    mocks.listDeleted.mockResolvedValue([deletedItem({ name: null })]);
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[0]);
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Restore',
      )!,
    );
    await flush();

    expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('char-1');
    expect(mocks.restoreDeleted).toHaveBeenCalledWith('Character', 'char-1');
    expect(view.container.textContent).not.toContain('char-1');
    await view.unmount();
  });

  it('falls back to its own message when a restore fails without one', async () => {
    mocks.listDeleted.mockResolvedValue([deletedItem()]);
    mocks.restoreDeleted.mockRejectedValue(undefined);
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[0]);
    await flush();
    await click(
      Array.from(view.container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Restore',
      )!,
    );
    await flush();

    expect(window.alert).toHaveBeenCalledWith('Restore failed.');
    await view.unmount();
  });

  it('shows the story id when a row has no story title', async () => {
    mocks.listDeleted.mockResolvedValue([deletedItem({ storyTitle: null })]);
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[0]);
    await flush();

    expect(view.container.querySelector('tbody tr')?.textContent).toContain('story-1');
    await view.unmount();
  });

  it('shows a failure when the deleted-items search fails', async () => {
    mocks.listDeleted.mockRejectedValue(new Error('Recovery is down.'));
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[0]);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Recovery is down.');
    await view.unmount();
  });

  it('renders unnamed rows and rows without a story without crashing', async () => {
    mocks.listDeleted.mockResolvedValue([
      deletedItem({ name: null, storyTitle: null, storyId: null, deletedAt: null }),
    ]);
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[0]);
    await flush();

    expect(view.container.textContent).toContain('(unnamed)');
    expect(view.container.textContent).toContain('char-1');
    await view.unmount();
  });

  it('searches deleted items by type, story and text', async () => {
    const view = await withRouter(<RecoveryPage />);

    const form = view.container.querySelectorAll('form')[0];
    await changeInput(form.querySelector('select')!, 'Character');
    const [storyId, search] = Array.from(form.querySelectorAll('input'));
    await changeInput(storyId, 'story-1');
    await changeInput(search, 'ana');
    await submit(form);
    await flush();

    expect(mocks.listDeleted).toHaveBeenCalledWith({
      entityType: 'Character',
      storyId: 'story-1',
      search: 'ana',
    });
    await view.unmount();
  });

  it('searches the operation log by story and text', async () => {
    const view = await withRouter(<RecoveryPage />);

    const form = view.container.querySelectorAll('form')[1];
    const [storyId, search] = Array.from(form.querySelectorAll('input'));
    await changeInput(storyId, 'story-1');
    await changeInput(search, 'char-1');
    await submit(form);
    await flush();

    expect(mocks.browseOperationLog).toHaveBeenCalledWith({
      storyId: 'story-1',
      search: 'char-1',
      pageSize: 50,
    });
    await view.unmount();
  });

  it('browses the operation log and shows the selected entry payload', async () => {
    mocks.browseOperationLog.mockResolvedValue({
      items: [logRow()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[1]);
    await flush();
    expect(mocks.browseOperationLog).toHaveBeenCalledWith({
      storyId: undefined,
      search: undefined,
      pageSize: 50,
    });

    await click(view.container.querySelectorAll('table')[1].querySelector('tbody tr')!);
    await flush();

    const panel = view.container.querySelector('.detail-panel');
    expect(panel?.textContent).toContain('char-1');
    expect(panel?.textContent).toContain('Demo Story');
    expect(panel?.textContent).toContain('"id"');
    await view.unmount();
  });

  it('selects a log row from the keyboard', async () => {
    mocks.browseOperationLog.mockResolvedValue({
      items: [logRow()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[1]);
    await flush();
    await keyDown(view.container.querySelectorAll('table')[1].querySelector('tbody tr')!, ' ');
    await flush();

    expect(view.container.querySelector('.detail-panel')).not.toBeNull();
    await view.unmount();
  });

  it('ignores other keys on a log row', async () => {
    mocks.browseOperationLog.mockResolvedValue({
      items: [logRow()],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[1]);
    await flush();
    await keyDown(view.container.querySelectorAll('table')[1].querySelector('tbody tr')!, 'Tab');
    await flush();

    expect(view.container.querySelector('.detail-panel')).toBeNull();
    await view.unmount();
  });

  it('shows a failure when the operation log search fails', async () => {
    mocks.browseOperationLog.mockRejectedValue(new Error('Log browse is down.'));
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[1]);
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Log browse is down.');
    await view.unmount();
  });

  it('falls back to ids when the log row carries no names', async () => {
    mocks.browseOperationLog.mockResolvedValue({
      items: [logRow({ entityName: null, storyTitle: null, username: null, entityVersion: null })],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const view = await withRouter(<RecoveryPage />);

    await submit(view.container.querySelectorAll('form')[1]);
    await flush();
    await click(view.container.querySelectorAll('table')[1].querySelector('tbody tr')!);
    await flush();

    expect(view.container.textContent).toContain('char-1');
    const panel = view.container.querySelector('.detail-panel')!;
    const terms = Array.from(panel.querySelectorAll('dt')).map((node) => node.textContent);
    const defs = Array.from(panel.querySelectorAll('dd')).map((node) => node.textContent);
    expect(defs[terms.indexOf('Entity version')]).toBe('-');
    await view.unmount();
  });
});
