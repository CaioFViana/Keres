import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ActivityPage } from '../../src/pages/activity/ActivityPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  exportCsv: vi.fn(),
}));

vi.mock('../../src/api/ActivityApiService', () => ({
  ActivityApiService: {
    list: mocks.list,
    summary: mocks.summary,
    exportCsv: mocks.exportCsv,
  },
}));

const ana = { id: 'user-1', username: 'ana', tag: 'ana_s', isDeleted: false };
const bia = { id: 'user-2', username: 'bia', tag: 'bia', isDeleted: false };

const event = (over: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  createdAt: '2026-01-15T10:00:00.000Z',
  category: 'message',
  action: 'message.sent_direct',
  outcome: 'success',
  actor: ana,
  subject: bia,
  targetType: 'user',
  targetId: 'user-2',
  ip: '203.0.113.9',
  userAgent: 'Keres/1.0',
  meta: { status: 201 },
  ...over,
});

const page = (items: unknown[], total = items.length) => ({ items, total, page: 1, pageSize: 50 });

const summary = (over: Record<string, unknown> = {}) => ({
  since: '2026-01-14T10:00:00.000Z',
  hours: 24,
  total: 40,
  byCategory: { auth: 20 },
  failures: 3,
  denied: 2,
  failedLogins: 5,
  newAccounts: 1,
  messages: 7,
  limitHits: 0,
  adminActions: 4,
  topFailedLoginIps: [{ ip: '198.51.100.7', count: 5 }],
  perDay: Array.from({ length: 14 }, (_, index) => ({ day: `2026-01-${index + 1}`, count: index })),
  system: {
    version: '1.9.0',
    startedAt: '2026-01-14T00:00:00.000Z',
    uptimeSeconds: 90_061,
    databaseDriver: 'sqlite',
    runtime: 'Bun 1.2',
    memoryRssMb: 120,
    users: { total: 12, active: 10, deleted: 2, admins: 1 },
    stories: 30,
    errorLogs: 2,
    retentionDays: 365,
  },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue(page([event()]));
  mocks.summary.mockResolvedValue(summary());
  mocks.exportCsv.mockResolvedValue(new Blob(['a,b']));
  vi.stubGlobal('alert', vi.fn());
});

const renderPage = (route = '/activity') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <ThemeProvider>
        <ActivityPage />
      </ThemeProvider>
    </MemoryRouter>,
  );

const lastQuery = () => mocks.list.mock.calls.at(-1)![0];
const selects = (view: Awaited<ReturnType<typeof renderPage>>) =>
  Array.from(view.container.querySelectorAll('form.toolbar select')) as HTMLSelectElement[];

describe('activity page: the summary', () => {
  it('shows what happened in the last day, with warnings where something needs a look', async () => {
    const view = await renderPage();
    await flush();

    const cards = view.container.querySelectorAll('.stat-card');
    const text = Array.from(cards).map((card) => card.textContent);
    expect(text).toContain('40Events');
    expect(text).toContain('5Failed sign-ins');
    expect(view.container.querySelector('.stat-card.is-warn')).not.toBeNull();
    expect(view.container.querySelector('.stat-card.is-bad')?.textContent).toContain('2');
    expect(mocks.summary).toHaveBeenCalledWith(24);
  });

  it('says how the server is doing, and which addresses fail to sign in most', async () => {
    const view = await renderPage();
    await flush();

    const system = view.container.querySelector('.system-info')!.textContent!;
    expect(system).toContain('1.9.0');
    expect(system).toContain('1d 1h');
    expect(system).toContain('sqlite');
    expect(system).toContain('120 MB');
    expect(system).toContain('10 active, 2 deleted, 1 admins');
    expect(system).toContain('365 days');
    expect(view.container.textContent).toContain('198.51.100.7');
    expect(view.container.querySelectorAll('.bar-chart .bar')).toHaveLength(14);
  });

  it('has no warning marks when nothing is wrong, and hides the addresses list when there are none', async () => {
    mocks.summary.mockResolvedValue(
      summary({
        failedLogins: 0,
        denied: 0,
        topFailedLoginIps: [],
        system: { ...summary().system, errorLogs: 0, uptimeSeconds: 600 },
      }),
    );
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.stat-card.is-warn')).toBeNull();
    expect(view.container.querySelector('.stat-card.is-bad')).toBeNull();
    expect(view.container.textContent).not.toContain('Addresses with the most');
    expect(view.container.querySelector('.system-info')!.textContent).toContain('10m');
  });

  it('looks at the window it is asked for', async () => {
    const view = await renderPage();
    await flush();

    await changeInput(view.container.querySelector('.activity-summary select')!, '168');

    expect(mocks.summary).toHaveBeenLastCalledWith(168);
  });

  it('shows the failure when the summary cannot be read, and keeps the record', async () => {
    mocks.summary.mockRejectedValue(new Error('Summary is down.'));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.activity-summary .error-text')?.textContent).toBe(
      'Summary is down.',
    );
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('formats a short uptime in hours', async () => {
    mocks.summary.mockResolvedValue(
      summary({ system: { ...summary().system, uptimeSeconds: 7500 } }),
    );
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.system-info')!.textContent).toContain('2h 5m');
  });
});

describe('activity page: the record', () => {
  it('lists events by what happened, in words, with who and whom as people', async () => {
    const view = await renderPage();
    await flush();

    const row = view.container.querySelector('tbody tr')!;
    expect(row.textContent).toContain('Messages');
    expect(row.textContent).toContain('Message to a friend');
    expect(row.textContent).toContain('Succeeded');
    expect(row.textContent).toContain('@ana_s');
    expect(row.textContent).toContain('@bia');
    expect(row.textContent).toContain('203.0.113.9');
    expect(row.querySelector('a')!.getAttribute('href')).toBe('/users/user-1');
  });

  it('falls back to the code for an action it has no words for', async () => {
    mocks.list.mockResolvedValue(page([event({ action: 'newarea.new_thing' })]));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('tbody tr')!.textContent).toContain('newarea.new_thing');
  });

  it('shows an event without an actor, an address or a subject as blanks, and a closed account as such', async () => {
    mocks.list.mockResolvedValue(
      page([
        event({ id: 'a', actor: null, subject: null, ip: null }),
        event({ id: 'b', actor: { ...ana, isDeleted: true } }),
        event({ id: 'c', actor: { id: null, username: 'ghost', tag: null, isDeleted: false } }),
      ]),
    );
    const view = await renderPage();
    await flush();

    const rows = view.container.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('-');
    expect(rows[1].textContent).toContain('(account closed)');
    // The closed account is named, but no longer a link to a page that is gone.
    expect(rows[1].querySelectorAll('td')[3].querySelector('a')).toBeNull();
    expect(rows[2].textContent).toContain('ghost');
  });

  it('marks failures and refusals apart from what worked', async () => {
    mocks.list.mockResolvedValue(
      page([event({ id: 'a', outcome: 'failure' }), event({ id: 'b', outcome: 'denied' })]),
    );
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.outcome-failure')?.textContent).toBe('Failed');
    expect(view.container.querySelector('.outcome-denied')?.textContent).toBe('Refused');
  });

  it('opens an event with everything about it, and what the request said', async () => {
    const view = await renderPage();
    await flush();

    await click(view.container.querySelector('tbody tr')!);

    const panel = view.container.querySelector('.detail-panel')!;
    expect(panel.querySelector('h3')!.textContent).toBe('Message to a friend');
    expect(panel.textContent).toContain('user user-2');
    expect(panel.textContent).toContain('Keres/1.0');
    expect(panel.querySelector('code')!.textContent).toBe('message.sent_direct');
    expect(panel.querySelector('pre')!.textContent).toContain('"status": 201');
  });

  it('opens an event from the keyboard', async () => {
    const view = await renderPage();
    await flush();
    const row = view.container.querySelector('tbody tr')!;

    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();

    expect(view.container.querySelector('.detail-panel')).not.toBeNull();
  });

  it('shows an event with no target as a dash', async () => {
    mocks.list.mockResolvedValue(
      page([event({ targetType: null, targetId: null, userAgent: null, ip: null })]),
    );
    const view = await renderPage();
    await flush();
    await click(view.container.querySelector('tbody tr')!);

    expect(view.container.querySelector('.detail-panel dl')!.textContent).toContain('About-');
  });

  it('says when there is nothing for the filters', async () => {
    mocks.list.mockResolvedValue(page([]));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('tbody tr td')?.textContent).toContain('Nothing recorded');
  });

  it('shows a failure when the record cannot be read', async () => {
    mocks.list.mockRejectedValue(new Error('Record is down.'));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Record is down.');
  });

  it('pages', async () => {
    mocks.list.mockResolvedValue(page([event()], 120));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.pagination')!.textContent).toContain('Page 1 of 3');
    const next = Array.from(view.container.querySelectorAll('.pagination button')).find(
      (b) => b.textContent === 'Next',
    )!;
    await click(next);
    expect(lastQuery().page).toBe(2);
  });
});

describe('activity page: filters', () => {
  it('asks for everything, newest first, by default', async () => {
    await renderPage();
    await flush();

    expect(lastQuery()).toMatchObject({ order: 'desc', page: 1, pageSize: 50 });
    expect(lastQuery().category).toBeUndefined();
    expect(lastQuery().outcome).toBeUndefined();
  });

  it('applies the area, outcome, action, dates, search and order on submit, from the first page', async () => {
    const view = await renderPage();
    await flush();
    const [category, outcome, order] = selects(view);
    const inputs = Array.from(
      view.container.querySelectorAll('form.toolbar input'),
    ) as HTMLInputElement[];

    await changeInput(category, 'auth');
    await changeInput(outcome, 'failure');
    await changeInput(order, 'asc');
    await changeInput(inputs[0], '  ana ');
    await changeInput(inputs[1], ' login ');
    await changeInput(inputs[2], '2026-01-10');
    await changeInput(inputs[3], '2026-01-12');
    expect(lastQuery().category).toBeUndefined();
    await submit(view.container.querySelector('form.toolbar') as HTMLFormElement);

    expect(lastQuery()).toMatchObject({
      category: 'auth',
      outcome: 'failure',
      order: 'asc',
      search: 'ana',
      action: 'login',
      page: 1,
    });
    expect(new Date(lastQuery().from).getTime()).toBe(new Date('2026-01-10T00:00:00').getTime());
    expect(new Date(lastQuery().to).getTime()).toBe(new Date('2026-01-12T23:59:59.999').getTime());
  });

  it('follows one user when opened from their page, and lets go of them', async () => {
    const view = await renderPage('/activity?user=user-1');
    await flush();

    expect(lastQuery().userId).toBe('user-1');
    expect(view.container.querySelector('.filter-chip')!.textContent).toContain('user-1');

    await click(view.container.querySelector('.filter-chip button')!);

    expect(lastQuery().userId).toBeUndefined();
    expect(view.container.querySelector('.filter-chip')).toBeNull();
  });
});

describe('activity page: export', () => {
  it('downloads the filtered record as a file', async () => {
    const created: string[] = [];
    const click = vi.fn();
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
      if (tag === 'a') element.click = click;
      return element;
    });
    const view = await renderPage();
    await flush();

    await clickElement(
      Array.from(view.container.querySelectorAll('form.toolbar button')).find(
        (b) => b.textContent === 'Export CSV',
      )!,
    );
    await flush();

    expect(mocks.exportCsv).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
    expect(click).toHaveBeenCalled();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('says so when the export fails', async () => {
    mocks.exportCsv.mockRejectedValue(new Error('Export failed.'));
    vi.stubGlobal('alert', vi.fn());
    const view = await renderPage();
    await flush();

    await clickElement(
      Array.from(view.container.querySelectorAll('form.toolbar button')).find(
        (b) => b.textContent === 'Export CSV',
      )!,
    );
    await flush();

    expect(alert).toHaveBeenCalledWith('Export failed.');
  });
});

const clickElement = click;
