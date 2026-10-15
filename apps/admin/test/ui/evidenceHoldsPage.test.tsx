import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EvidenceHoldsPage } from '@/pages/evidenceHolds/EvidenceHoldsPage';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '@test/helpers/react';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  extend: vi.fn(),
  release: vi.fn(),
}));

vi.mock('@/api/EvidenceHoldsApiService', () => ({
  EvidenceHoldsApiService: {
    list: mocks.list,
    get: mocks.get,
    create: mocks.create,
    extend: mocks.extend,
    release: mocks.release,
  },
}));

const ANA_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

const hold = (over: Record<string, unknown> = {}) => ({
  id: 'hold-1',
  createdAt: '2026-10-01T10:00:00.000Z',
  expiresAt: '2027-04-01T10:00:00.000Z',
  targetKind: 'story',
  targetId: 'story-1',
  subjectUserId: ANA_ID,
  reportMessageIds: ['msg-report-1'],
  createdBy: null,
  note: null,
  ...over,
});

const SNAPSHOT = { title: 'Story title', body: 'The reported text.' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({
    items: [
      hold(),
      hold({
        id: 'hold-2',
        targetKind: 'message',
        targetId: 'msg-7',
        subjectUserId: null,
        reportMessageIds: [],
        createdBy: 'admin-1',
        note: 'Ordered by the authority',
      }),
    ],
  });
  mocks.get.mockResolvedValue({ ...hold(), snapshot: SNAPSHOT });
  mocks.create.mockResolvedValue(hold({ id: 'hold-3' }));
  mocks.extend.mockResolvedValue(hold({ expiresAt: '2027-10-01T10:00:00.000Z' }));
  mocks.release.mockResolvedValue({ ok: true });
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/evidence-holds']}>
      <ThemeProvider>
        <EvidenceHoldsPage />
      </ThemeProvider>
    </MemoryRouter>,
  );

const lastListCall = () => mocks.list.mock.calls.at(-1)![0];
const buttonNamed = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label)!;
const viewButton = (container: HTMLElement, row = 0) =>
  Array.from(container.querySelectorAll('tbody tr')[row].querySelectorAll('button')).find(
    (button) => button.textContent === 'View',
  )!;
const keepForm = (container: HTMLElement) =>
  container.querySelector('form.form-card') as HTMLFormElement;
const dialogForm = (container: HTMLElement) =>
  container.querySelector('.modal form.form-card') as HTMLFormElement;

describe('evidence holds page: the list', () => {
  it('lists the holds, and tells the automatic ones from the ones an admin made', async () => {
    const view = await renderPage();
    await flush();

    const rows = view.container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Automatic');
    expect(rows[0].textContent).toContain('story-1');
    expect(rows[0].querySelector('a')!.getAttribute('href')).toBe(`/users/${ANA_ID}`);
    expect(rows[0].querySelectorAll('td')[4].textContent).toBe('1');
    expect(rows[1].textContent).toContain('By an admin');
    expect(rows[1].textContent).not.toContain('Automatic');
    expect(rows[1].textContent).toContain('Ordered by the authority');
    expect(mocks.list).toHaveBeenCalledWith({ limit: 100, includeExpired: false });
  });

  it('says so when there is nothing to show', async () => {
    mocks.list.mockResolvedValue({ items: [] });
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.empty-state')!.textContent).toBe(
      'No holds for these filters.',
    );
  });

  it('asks for the expired holds too when "Show expired" is ticked', async () => {
    const view = await renderPage();
    await flush();

    const box = view.container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await click(box);
    await flush();

    expect(lastListCall()).toEqual({ limit: 100, includeExpired: true });
    expect(mocks.list.mock.calls.length).toBeGreaterThan(1);
  });

  it('shows the failure when the holds cannot be read', async () => {
    mocks.list.mockRejectedValue(new Error('Holds are down.'));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Holds are down.');
  });
});

describe('evidence holds page: keeping an item', () => {
  it('posts the item, the report and the note, then reads the list again', async () => {
    const view = await renderPage();
    await flush();
    const form = keepForm(view.container);
    const [targetId, reportId] = Array.from(form.querySelectorAll('input'));
    const kind = form.querySelector('select')!;
    const note = form.querySelector('textarea')!;
    const before = mocks.list.mock.calls.length;

    await changeInput(kind, 'message');
    await changeInput(targetId, ' msg-9 ');
    await changeInput(reportId, 'msg-report-9');
    await changeInput(note, 'Reported by a user');
    await submit(form);
    await flush();

    expect(mocks.create).toHaveBeenCalledWith({
      targetKind: 'message',
      targetId: 'msg-9',
      reportMessageId: 'msg-report-9',
      note: 'Reported by a user',
    });
    expect(mocks.list.mock.calls.length).toBeGreaterThan(before);
    // The kind stays for the next item; the rest is cleared.
    expect(keepForm(view.container).querySelector('select')!.value).toBe('message');
    expect((keepForm(view.container).querySelector('input') as HTMLInputElement).value).toBe('');
  });

  it('leaves the report and the note out when they are blank', async () => {
    const view = await renderPage();
    await flush();
    const form = keepForm(view.container);

    await changeInput(form.querySelector('input')!, 'story-9');
    await submit(form);
    await flush();

    const body = mocks.create.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(['targetId', 'targetKind']);
    expect(body).toMatchObject({ targetKind: 'story', targetId: 'story-9' });
  });

  it('shows the refusal from the server', async () => {
    mocks.create.mockRejectedValue(new Error('Item not found.'));
    const view = await renderPage();
    await flush();
    const form = keepForm(view.container);

    await changeInput(form.querySelector('input')!, 'story-404');
    await submit(form);
    await flush();

    expect(document.body.textContent).toContain('Item not found.');
  });
});

describe('evidence holds page: the view', () => {
  it('opens the hold and shows its copy as formatted JSON', async () => {
    const view = await renderPage();
    await flush();

    await click(viewButton(view.container));
    await flush();

    expect(mocks.get).toHaveBeenCalledWith('hold-1');
    const pre = view.container.querySelector('.modal pre')!;
    expect(pre.textContent).toBe(JSON.stringify(SNAPSHOT, null, 2));
  });

  it('shows the failure when the hold cannot be read', async () => {
    mocks.get.mockRejectedValue(new Error('Hold not found.'));
    const view = await renderPage();
    await flush();

    await click(viewButton(view.container));
    await flush();

    expect(view.container.querySelector('.modal .error-text')?.textContent).toBe('Hold not found.');
  });
});

describe('evidence holds page: extending and letting go', () => {
  const openFirst = async () => {
    const view = await renderPage();
    await flush();
    await click(viewButton(view.container));
    await flush();
    return view;
  };

  it('extends the hold by the days typed', async () => {
    const view = await openFirst();

    await changeInput(view.container.querySelector('.modal input[type="number"]')!, '365');
    await submit(dialogForm(view.container));
    await flush();

    expect(mocks.extend).toHaveBeenCalledWith('hold-1', 365);
    expect(mocks.list.mock.calls.length).toBeGreaterThan(1);
  });

  it('refuses to extend by a number of days outside the range, without calling the server', async () => {
    const view = await openFirst();

    await changeInput(view.container.querySelector('.modal input[type="number"]')!, '0');
    await submit(dialogForm(view.container));
    await flush();

    expect(mocks.extend).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Days must be between 1 and 3650.');
  });

  it('asks before letting go, and deletes only when the answer is yes', async () => {
    const confirmation = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmation);
    const view = await openFirst();

    await click(buttonNamed(view.container, 'Let go'));
    await flush();
    expect(confirmation).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
    expect(view.container.querySelector('.modal')).not.toBeNull();

    confirmation.mockReturnValue(true);
    await click(buttonNamed(view.container, 'Let go'));
    await flush();
    expect(mocks.release).toHaveBeenCalledWith('hold-1');
    expect(view.container.querySelector('.modal')).toBeNull();
  });

  it('shows the failure when the server refuses to let go', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    mocks.release.mockRejectedValue(new Error('Hold is locked.'));
    const view = await openFirst();

    await click(buttonNamed(view.container, 'Let go'));
    await flush();

    expect(document.body.textContent).toContain('Hold is locked.');
    expect(view.container.querySelector('.modal')).not.toBeNull();
  });
});
