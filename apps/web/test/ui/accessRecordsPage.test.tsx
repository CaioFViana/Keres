import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AccessRecordsPage } from '@/pages/access-records/AccessRecordsPage';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '@test/helpers/react';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  exportCsv: vi.fn(),
}));

vi.mock('@/api/AccessRecordsApiService', () => ({
  AccessRecordsApiService: {
    list: mocks.list,
    exportCsv: mocks.exportCsv,
  },
}));

const ANA_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const ADDRESS = '203.0.113.9';

const record = (over: Record<string, unknown> = {}) => ({
  id: 'rec-1',
  occurredAt: '2026-01-15T10:00:00.000Z',
  event: 'login',
  userId: ANA_ID,
  username: 'ana',
  usernameTried: null,
  ip: ADDRESS,
  ...over,
});

const page = (items: unknown[], over: Record<string, unknown> = {}) => ({
  items,
  nextCursor: null,
  retentionDays: 183,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue(page([record()]));
  mocks.exportCsv.mockResolvedValue({ blob: new Blob(['a,b']), truncated: false });
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/access-records']}>
      <ThemeProvider>
        <AccessRecordsPage />
      </ThemeProvider>
    </MemoryRouter>,
  );

const lastQuery = () => mocks.list.mock.calls.at(-1)![0];
const filterInputs = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('form.toolbar input')) as HTMLInputElement[];

describe('access records page: the record', () => {
  it('shows when, what, who and from which address, and says how long it is kept', async () => {
    const view = await renderPage();
    await flush();

    const row = view.container.querySelector('tbody tr')!;
    expect(row.textContent).toContain('Signed in');
    expect(row.textContent).toContain('ana');
    expect(row.querySelector('a')!.getAttribute('href')).toBe(`/users/${ANA_ID}`);
    expect(row.textContent).toContain(ADDRESS);
    // 183 days from the server: six months.
    expect(view.container.textContent).toContain('Kept for 6 months');
    expect(mocks.list).toHaveBeenCalledWith({ limit: 50 });
  });

  it('shows a name that matched no account as the name typed, and a refused sign-in as such', async () => {
    mocks.list.mockResolvedValue(
      page([
        record({
          id: 'rec-2',
          event: 'login_failed',
          userId: null,
          username: null,
          usernameTried: 'fantasma',
        }),
      ]),
    );
    const view = await renderPage();
    await flush();

    const row = view.container.querySelector('tbody tr')!;
    expect(row.textContent).toContain('Sign-in refused');
    expect(row.textContent).toContain('Name typed (no account)');
    expect(row.textContent).toContain('fantasma');
    expect(row.querySelector('a')).toBeNull();
  });

  it('says so when there is nothing to show', async () => {
    mocks.list.mockResolvedValue(page([]));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.empty-state')!.textContent).toBe(
      'Nothing recorded for these filters.',
    );
  });

  it('shows the failure when the records cannot be read', async () => {
    mocks.list.mockRejectedValue(new Error('Records are down.'));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Records are down.');
  });
});

describe('access records page: paging', () => {
  it('asks for the older records with the cursor, and adds them to the list', async () => {
    mocks.list.mockResolvedValueOnce(page([record()], { nextCursor: '1700000000000_rec-1' }));
    mocks.list.mockResolvedValueOnce(
      page([record({ id: 'rec-0', event: 'token_refresh' })], { nextCursor: null }),
    );
    const view = await renderPage();
    await flush();

    const more = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Older records',
    )!;
    await click(more);
    await flush();

    expect(lastQuery()).toMatchObject({ cursor: '1700000000000_rec-1', limit: 50 });
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(view.container.textContent).toContain('Session renewed');
    expect(
      Array.from(view.container.querySelectorAll('button')).some(
        (button) => button.textContent === 'Older records',
      ),
    ).toBe(false);
  });
});

describe('access records page: the filters', () => {
  it('searches by a name as the account, by an id as the account id, and by address and dates', async () => {
    const view = await renderPage();
    await flush();
    const [account, address, from, to] = filterInputs(view.container);

    await changeInput(account, ' ana ');
    await changeInput(address, ' 203.0.113.9 ');
    await changeInput(from, '2026-01-10');
    await changeInput(to, '2026-01-12');
    await submit(view.container.querySelector('form.toolbar') as HTMLFormElement);

    expect(lastQuery()).toMatchObject({ username: 'ana', ip: ADDRESS, limit: 50 });
    expect(lastQuery().userId).toBeUndefined();
    // The days are the local days the filter names, from the first moment to the last.
    expect(Date.parse(lastQuery().from)).toBe(new Date('2026-01-10T00:00:00').getTime());
    expect(Date.parse(lastQuery().to)).toBe(new Date('2026-01-12T23:59:59.999').getTime());

    await changeInput(account, ANA_ID);
    await submit(view.container.querySelector('form.toolbar') as HTMLFormElement);
    expect(lastQuery()).toMatchObject({ userId: ANA_ID });
    expect(lastQuery().username).toBeUndefined();
  });

  it('does not search while the form is only typed in', async () => {
    const view = await renderPage();
    await flush();
    const calls = mocks.list.mock.calls.length;

    await changeInput(filterInputs(view.container)[0], 'ana');

    expect(mocks.list.mock.calls.length).toBe(calls);
  });
});

describe('access records page: the export', () => {
  it('exports the filters as a CSV file', async () => {
    const created: string[] = [];
    const download = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => {
        created.push(String(blob.size));
        return 'blob:csv';
      }),
      revokeObjectURL: vi.fn(),
    });
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = realCreate(tag);
      if (tag === 'a') element.click = download;
      return element;
    });
    const view = await renderPage();
    await flush();
    await changeInput(filterInputs(view.container)[1], ADDRESS);
    await submit(view.container.querySelector('form.toolbar') as HTMLFormElement);

    const exportButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Export CSV',
    )!;
    await click(exportButton);
    await flush();

    expect(mocks.exportCsv).toHaveBeenLastCalledWith(expect.objectContaining({ ip: ADDRESS }));
    expect(created).toEqual(['3']);
    expect(download).toHaveBeenCalled();
    expect(view.container.querySelector('.modal')).toBeNull();
  });

  it('says when the export was cut short, and how many it holds', async () => {
    mocks.exportCsv.mockResolvedValue({ blob: new Blob(['a']), truncated: true });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:csv'), revokeObjectURL: vi.fn() });
    const view = await renderPage();
    await flush();

    const exportButton = Array.from(view.container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Export CSV',
    )!;
    await click(exportButton);
    await flush();

    expect(document.body.textContent).toContain('first 50000 records only');
  });
});
