import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../../src/components/Modal';
import { click, flush, render } from '../helpers/react';
import { act } from 'react';

async function mouseDown(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

async function keyDown(key: string): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('modal dialog', () => {
  it('shows its title and content with a close button', async () => {
    const view = await render(
      <Modal title="Notice" onClose={() => {}}>
        <p>Something broke.</p>
      </Modal>,
    );
    await flush();

    const dialog = view.container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Notice');
    expect(dialog.textContent).toContain('Something broke.');
    expect(dialog.textContent).toContain('Close');
    await view.unmount();
  });

  it('closes from its button', async () => {
    const onClose = vi.fn();
    const view = await render(
      <Modal title="Notice" onClose={onClose}>
        <p>Something broke.</p>
      </Modal>,
    );
    await flush();

    await click(
      Array.from(view.container.querySelectorAll('.modal button')).find(
        (button) => button.textContent === 'Close',
      )!,
    );
    await flush();

    expect(onClose).toHaveBeenCalledOnce();
    await view.unmount();
  });

  it('closes when the overlay behind it is clicked, but not from inside', async () => {
    const onClose = vi.fn();
    const view = await render(
      <Modal title="Notice" onClose={onClose}>
        <p>Something broke.</p>
      </Modal>,
    );
    await flush();

    await mouseDown(view.container.querySelector('.modal p')!);
    await flush();
    expect(onClose).not.toHaveBeenCalled();

    await mouseDown(view.container.querySelector('.modal-overlay')!);
    await flush();
    expect(onClose).toHaveBeenCalledOnce();
    await view.unmount();
  });

  it('lets Escape close only the topmost stacked dialog', async () => {
    const onCloseOuter = vi.fn();
    const onCloseInner = vi.fn();
    const view = await render(
      <Modal title="Outer" onClose={onCloseOuter}>
        <Modal title="Inner" onClose={onCloseInner}>
          <p>Stacked.</p>
        </Modal>
      </Modal>,
    );
    await flush();

    await keyDown('Escape');
    await flush();

    expect(onCloseInner).toHaveBeenCalledOnce();
    expect(onCloseOuter).not.toHaveBeenCalled();
    await view.unmount();
  });

  it('closes on Escape and ignores other keys', async () => {
    const onClose = vi.fn();
    const view = await render(
      <Modal title="Notice" onClose={onClose}>
        <p>Something broke.</p>
      </Modal>,
    );
    await flush();

    await keyDown('Tab');
    await flush();
    expect(onClose).not.toHaveBeenCalled();

    await keyDown('Escape');
    await flush();
    expect(onClose).toHaveBeenCalledOnce();
    await view.unmount();
  });
});
