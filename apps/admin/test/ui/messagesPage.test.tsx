import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MessagesPage } from '../../src/pages/messages/MessagesPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  open: vi.fn(),
  patch: vi.fn(),
  reply: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../src/api/MessagesApiService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/api/MessagesApiService')>()),
  MessagesApiService: {
    list: mocks.list,
    open: mocks.open,
    patch: mocks.patch,
    reply: mocks.reply,
    remove: mocks.remove,
  },
}));

const ana = { id: 'user-1', username: 'ana', tag: 'ana_s', isDeleted: false };

const siteMessage = (over: Record<string, unknown> = {}) => ({
  id: 'msg-site',
  channel: 'site',
  fromAdmin: false,
  subject: 'Plans',
  body: 'Do you offer yearly billing?',
  contactEmail: 'visitor@example.com',
  user: null,
  createdAt: '2026-01-15T10:00:00.000Z',
  isRead: false,
  isArchived: false,
  ...over,
});

const userMessage = (over: Record<string, unknown> = {}) => ({
  id: 'msg-user',
  channel: 'admin',
  fromAdmin: false,
  subject: null,
  body: 'I cannot sign in',
  contactEmail: null,
  user: ana,
  createdAt: '2026-01-16T10:00:00.000Z',
  isRead: true,
  isArchived: false,
  ...over,
});

const page = (items: unknown[], total = items.length) => ({ items, total, page: 1, pageSize: 25 });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue(page([siteMessage(), userMessage()]));
  mocks.open.mockImplementation(async (id: string) => {
    const message = id === 'msg-site' ? siteMessage({ isRead: true }) : userMessage();
    return { message, thread: id === 'msg-site' ? [] : [message] };
  });
  mocks.patch.mockImplementation(async (id: string, change: Record<string, boolean>) =>
    siteMessage({
      id,
      isRead: change.read ?? true,
      isArchived: change.archived ?? false,
    }),
  );
  mocks.reply.mockResolvedValue({
    ...userMessage({ id: 'reply-1', body: 'Try again now' }),
    fromAdmin: true,
  });
  mocks.remove.mockResolvedValue({ id: 'x' });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('alert', vi.fn());
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <MessagesPage />
      </ThemeProvider>
    </MemoryRouter>,
  );

const buttonNamed = (root: Element, text: string) =>
  Array.from(root.querySelectorAll('button')).find((button) => button.textContent === text)!;

const lastQuery = () => mocks.list.mock.calls.at(-1)![0];

describe('messages page', () => {
  it('lists messages with their origin and sender, flagging the unread ones', async () => {
    const view = await renderPage();
    await flush();

    const rows = view.container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toContain('row-unread');
    expect(rows[0].textContent).toContain('Site');
    expect(rows[0].textContent).toContain('visitor@example.com');
    expect(rows[0].textContent).toContain('Plans');
    expect(rows[1].className).not.toContain('row-unread');
    expect(rows[1].textContent).toContain('User');
    const sender = rows[1].querySelector('a')!;
    expect(sender.textContent).toBe('@ana_s');
    expect(sender.getAttribute('href')).toBe('/users/user-1');
    await view.unmount();
  });

  it('asks for the active inbox, newest first, by default', async () => {
    const view = await renderPage();
    await flush();

    expect(lastQuery()).toMatchObject({
      source: 'all',
      read: 'all',
      archived: 'active',
      sort: 'date',
      order: 'desc',
      page: 1,
      pageSize: 25,
    });
    await view.unmount();
  });

  it('narrows by origin, read state, archive, sort and order, back on the first page', async () => {
    const view = await renderPage();
    await flush();
    const selects = Array.from(view.container.querySelectorAll('.toolbar select'));

    await changeInput(selects[0] as HTMLSelectElement, 'site');
    expect(lastQuery()).toMatchObject({ source: 'site', page: 1 });
    await changeInput(selects[1] as HTMLSelectElement, 'unread');
    expect(lastQuery()).toMatchObject({ read: 'unread' });
    await changeInput(selects[2] as HTMLSelectElement, 'archived');
    expect(lastQuery()).toMatchObject({ archived: 'archived' });
    await changeInput(selects[3] as HTMLSelectElement, 'sender');
    expect(lastQuery()).toMatchObject({ sort: 'sender' });
    await changeInput(selects[4] as HTMLSelectElement, 'asc');
    expect(lastQuery()).toMatchObject({ order: 'asc' });
    await view.unmount();
  });

  it('searches on submit', async () => {
    const view = await renderPage();
    await flush();

    await changeInput(view.container.querySelector('.toolbar input')!, '  billing ');
    expect(lastQuery().search).toBeUndefined();
    await submit(view.container.querySelector('.toolbar')! as HTMLFormElement);

    expect(lastQuery()).toMatchObject({ search: 'billing', page: 1 });
    await view.unmount();
  });

  it('pages through the results', async () => {
    mocks.list.mockResolvedValue(page([siteMessage()], 60));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.pagination')!.textContent).toContain('Page 1 of 3');
    await click(buttonNamed(view.container, 'Next'));
    expect(lastQuery().page).toBe(2);
    await click(buttonNamed(view.container, 'Previous'));
    expect(lastQuery().page).toBe(1);
    await view.unmount();
  });

  it('opens a message from the site, reading it, with a link to answer by email', async () => {
    const view = await renderPage();
    await flush();

    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Open'));
    await flush();

    expect(mocks.open).toHaveBeenCalledWith('msg-site');
    expect(view.container.querySelector('.form-card h3')?.textContent).toBe('Plans');
    expect(view.container.querySelector('.form-card')?.textContent).toContain(
      'Do you offer yearly billing?',
    );
    const reply = view.container.querySelector('.form-card a[href^="mailto:"]')!;
    expect(reply.getAttribute('href')).toContain('visitor@example.com');
    expect(reply.getAttribute('href')).toContain(encodeURIComponent('Re: Plans'));
    // A visitor has no account to answer inside the platform.
    expect(view.container.querySelector('.message-reply')).toBeNull();
    await view.unmount();
  });

  it("opens a user's message with the conversation, and answers inside the platform", async () => {
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[1], 'Open'));
    await flush();

    expect(view.container.querySelector('.form-card h3')?.textContent).toBe('Message from @ana_s');
    expect(view.container.querySelectorAll('.message-thread li')).toHaveLength(1);
    expect(view.container.querySelector('a[href^="mailto:"]')).toBeNull();

    const form = view.container.querySelector('.message-reply') as HTMLFormElement;
    expect(buttonNamed(form, 'Send reply').disabled).toBe(true);
    await changeInput(form.querySelector('textarea')!, 'Try again now');
    expect(form.textContent).toContain('13 / 2000');
    await submit(form);
    await flush();

    expect(mocks.reply).toHaveBeenCalledWith('msg-user', 'Try again now');
    const entries = view.container.querySelectorAll('.message-thread li');
    expect(entries).toHaveLength(2);
    expect(entries[1].className).toContain('from-admin');
    expect(entries[1].textContent).toContain('Try again now');
    expect(
      view.container.querySelector<HTMLTextAreaElement>('.message-reply textarea')!.value,
    ).toBe('');
    await view.unmount();
  });

  it('shows why a reply failed, keeping what was written', async () => {
    mocks.reply.mockRejectedValue(new Error('This user no longer has an account.'));
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[1], 'Open'));
    await flush();
    await changeInput(view.container.querySelector('.message-reply textarea')!, 'Hello');

    await submit(view.container.querySelector('.message-reply') as HTMLFormElement);
    await flush();

    expect(view.container.querySelector('.modal')?.textContent).toContain(
      'This user no longer has an account.',
    );
    expect(
      view.container.querySelector<HTMLTextAreaElement>('.message-reply textarea')!.value,
    ).toBe('Hello');
    await view.unmount();
  });

  it('offers no reply box to a user whose account was closed', async () => {
    mocks.open.mockResolvedValue({
      message: userMessage({ user: { ...ana, isDeleted: true } }),
      thread: [],
    });
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[1], 'Open'));
    await flush();

    expect(view.container.querySelector('.message-reply')).toBeNull();
    expect(view.container.querySelector('.form-card')?.textContent).toContain('(account closed)');
    await view.unmount();
  });

  it('deletes one of its own replies from the conversation', async () => {
    const reply = { ...userMessage({ id: 'reply-0', body: 'Earlier answer' }), fromAdmin: true };
    mocks.open.mockResolvedValue({ message: userMessage(), thread: [userMessage(), reply] });
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[1], 'Open'));
    await flush();

    const own = view.container.querySelector('.message-thread li.from-admin')!;
    await click(buttonNamed(own, 'Delete'));
    await flush();

    expect(mocks.remove).toHaveBeenCalledWith('reply-0');
    expect(view.container.querySelectorAll('.message-thread li')).toHaveLength(1);
    await view.unmount();
  });

  it('marks unread and archives from the opened message', async () => {
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Open'));
    await flush();

    await click(buttonNamed(view.container, 'Mark as unread'));
    await flush();
    expect(mocks.patch).toHaveBeenCalledWith('msg-site', { read: false });
    expect(buttonNamed(view.container, 'Mark as read')).toBeTruthy();

    await click(buttonNamed(view.container, 'Archive'));
    await flush();
    expect(mocks.patch).toHaveBeenCalledWith('msg-site', { archived: true });
    await view.unmount();
  });

  it('archives and restores straight from the list', async () => {
    const view = await renderPage();
    await flush();

    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Archive'));
    await flush();

    expect(mocks.patch).toHaveBeenCalledWith('msg-site', { archived: true });
    await view.unmount();
  });

  it('flags an archived message and offers to restore it', async () => {
    mocks.list.mockResolvedValue(page([siteMessage({ isArchived: true, isRead: true })]));
    const view = await renderPage();
    await flush();

    const row = view.container.querySelector('tbody tr')!;
    expect(row.className).toContain('row-archived');
    expect(row.textContent).toContain('Archived');
    expect(buttonNamed(row, 'Restore')).toBeTruthy();
    await view.unmount();
  });

  it('deletes after confirmation, and not without it', async () => {
    const view = await renderPage();
    await flush();

    vi.mocked(confirm).mockReturnValueOnce(false);
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Delete'));
    expect(mocks.remove).not.toHaveBeenCalled();

    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Delete'));
    await flush();
    expect(mocks.remove).toHaveBeenCalledWith('msg-site');
    await view.unmount();
  });

  it('says when there is nothing to show', async () => {
    mocks.list.mockResolvedValue(page([]));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('tbody tr td')?.textContent).toContain('No messages.');
    await view.unmount();
  });

  it('shows a failure when the list fails to load, and when an action fails', async () => {
    mocks.list.mockRejectedValue(new Error('Messages are down.'));
    const view = await renderPage();
    await flush();
    expect(view.container.querySelector('.error-text')?.textContent).toBe('Messages are down.');

    mocks.list.mockResolvedValue(page([siteMessage()]));
    await changeInput(
      view.container.querySelectorAll('.toolbar select')[0] as HTMLSelectElement,
      'site',
    );
    await flush();
    mocks.open.mockRejectedValue(new Error('Not found.'));
    await click(buttonNamed(view.container, 'Open'));
    await flush();
    expect(view.container.querySelector('.error-text')?.textContent).toBe('Not found.');

    mocks.patch.mockRejectedValue(new Error('Patch failed.'));
    await click(buttonNamed(view.container, 'Archive'));
    await flush();
    expect(view.container.querySelector('.modal')?.textContent).toContain('Patch failed.');
    mocks.remove.mockRejectedValue(new Error('Delete failed.'));
    await click(buttonNamed(view.container, 'Delete'));
    await flush();
    expect(view.container.querySelector('.modal')?.textContent).toContain('Delete failed.');
    await view.unmount();
  });

  it('goes back to the list from an opened message', async () => {
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Open'));
    await flush();

    await click(buttonNamed(view.container, 'Done'));
    await flush();

    expect(view.container.querySelector('table')).not.toBeNull();
    await view.unmount();
  });

  it('shortens a long text in the list, and shows an unreadable date as blank', async () => {
    mocks.list.mockResolvedValue(
      page([siteMessage({ subject: null, body: 'x'.repeat(200), createdAt: 'not a date' })]),
    );
    const view = await renderPage();
    await flush();

    const cells = view.container.querySelectorAll('tbody tr td');
    expect(cells[3].textContent).toBe(`${'x'.repeat(90)}…`);
    expect(cells[4].textContent).toBe('');
    await view.unmount();
  });

  it('opens a site message with no subject and an archived one with its way back', async () => {
    mocks.open.mockResolvedValue({
      message: siteMessage({ subject: null, isArchived: true }),
      thread: [],
    });
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Open'));
    await flush();

    expect(view.container.querySelector('.form-card h3')?.textContent).toBe('(no subject)');
    expect(view.container.querySelector('.form-card')?.textContent).toContain('Archived');
    expect(buttonNamed(view.container, 'Restore')).toBeTruthy();
    await view.unmount();
  });

  it('falls back to a plain message when a failure carries none', async () => {
    const view = await renderPage();
    await flush();
    mocks.open.mockRejectedValueOnce('nope');
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Open'));
    await flush();
    expect(view.container.querySelector('.error-text')?.textContent).toBe('Action failed.');

    mocks.patch.mockRejectedValue('nope');
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Archive'));
    await flush();
    expect(view.container.querySelector('.modal')?.textContent).toContain('Action failed.');
    mocks.remove.mockRejectedValue('nope');
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[0], 'Delete'));
    await flush();
    expect(view.container.querySelector('.modal')?.textContent).toContain('Delete failed.');

    mocks.open.mockResolvedValue({
      message: userMessage(),
      thread: [userMessage(), { ...userMessage({ id: 'reply-0', user: null }), fromAdmin: true }],
    });
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[1], 'Open'));
    await flush();
    mocks.remove.mockRejectedValue('nope');
    await click(
      buttonNamed(view.container.querySelector('.message-thread li.from-admin')!, 'Delete'),
    );
    await flush();
    expect(view.container.querySelector('.modal')?.textContent).toContain('Delete failed.');
    mocks.reply.mockRejectedValue('nope');
    await changeInput(view.container.querySelector('.message-reply textarea')!, 'Hi');
    await submit(view.container.querySelector('.message-reply') as HTMLFormElement);
    await flush();
    expect(view.container.querySelector('.modal')?.textContent).toContain(
      'Could not send the reply.',
    );
    await view.unmount();
  });

  it('does not send a reply that is only blanks', async () => {
    const view = await renderPage();
    await flush();
    await click(buttonNamed(view.container.querySelectorAll('tbody tr')[1], 'Open'));
    await flush();
    await changeInput(view.container.querySelector('.message-reply textarea')!, '   ');

    await submit(view.container.querySelector('.message-reply') as HTMLFormElement);

    expect(mocks.reply).not.toHaveBeenCalled();
    await view.unmount();
  });
});
