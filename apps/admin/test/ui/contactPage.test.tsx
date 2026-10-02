import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ContactPage } from '../../src/pages/contact/ContactPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { click, flush, render } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../src/api/ContactApiService', () => ({
  ContactApiService: {
    list: mocks.list,
    get: mocks.get,
    remove: mocks.remove,
  },
}));

const message = (over: Record<string, unknown> = {}) => ({
  id: 'msg-1',
  subject: 'Plans',
  body: 'Do you offer yearly billing?',
  contactEmail: 'visitor@example.com',
  isRead: false,
  createdAt: '2026-01-15T10:00:00.000Z',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([message()]);
  mocks.get.mockImplementation(async (id: string) => message({ id, isRead: true }));
  mocks.remove.mockResolvedValue({ id: 'msg-1' });
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
        <ContactPage />
      </ThemeProvider>
    </MemoryRouter>,
  );

describe('contact page', () => {
  it('lists messages flagging the unread ones', async () => {
    mocks.list.mockResolvedValue([
      message(),
      message({ id: 'msg-2', subject: 'Bug', isRead: true }),
    ]);
    const view = await renderPage();
    await flush();

    const rows = view.container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toContain('row-unread');
    expect(rows[0].textContent).toContain('Unread');
    expect(rows[1].className).not.toContain('row-unread');
    await view.unmount();
  });

  it('opens a message, marking it read, with a reply link', async () => {
    const view = await renderPage();
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('tbody button')).find(
        (button) => button.textContent === 'Open',
      )!,
    );
    await flush();

    expect(mocks.get).toHaveBeenCalledWith('msg-1');
    expect(view.container.querySelector('.form-card h3')?.textContent).toBe('Plans');
    expect(view.container.querySelector('.form-card')?.textContent).toContain(
      'Do you offer yearly billing?',
    );
    const reply = view.container.querySelector('.form-card a[href^="mailto:"]')!;
    expect(reply.getAttribute('href')).toContain('visitor@example.com');
    expect(reply.getAttribute('href')).toContain(encodeURIComponent('Re: Plans'));
    await view.unmount();
  });

  it('deletes after confirmation', async () => {
    const view = await renderPage();
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('tbody button')).find(
        (button) => button.textContent === 'Delete',
      )!,
    );
    await flush();

    expect(mocks.remove).toHaveBeenCalledWith('msg-1');
    expect(view.container.querySelector('tbody tr td')?.textContent).toContain('No messages.');
    await view.unmount();
  });

  it('shows a failure when the list fails to load', async () => {
    mocks.list.mockRejectedValue(new Error('Contact is down.'));
    const view = await renderPage();
    await flush();

    expect(view.container.querySelector('.error-text')?.textContent).toBe('Contact is down.');
    await view.unmount();
  });
});
