import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '../../src/components/Pagination';
import { click, flush, render } from '../helpers/react';

const buttons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button'));

describe('Pagination', () => {
  it('shows where the list is and moves one page at a time', async () => {
    const onPageChange = vi.fn();
    const view = await render(
      <Pagination page={2} pageSize={25} total={80} onPageChange={onPageChange} />,
    );
    await flush();

    const [previous, next] = buttons(view.container);
    expect(view.container.textContent).toContain('2');
    expect(view.container.textContent).toContain('4');

    await click(previous);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await click(next);
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await view.unmount();
  });

  it('stops at either end, and an empty list is still page 1 of 1', async () => {
    const first = await render(
      <Pagination page={1} pageSize={25} total={80} onPageChange={() => {}} />,
    );
    expect(buttons(first.container)[0].disabled).toBe(true);
    expect(buttons(first.container)[1].disabled).toBe(false);
    await first.unmount();

    const last = await render(
      <Pagination page={4} pageSize={25} total={80} onPageChange={() => {}} />,
    );
    expect(buttons(last.container)[0].disabled).toBe(false);
    expect(buttons(last.container)[1].disabled).toBe(true);
    await last.unmount();

    const empty = await render(
      <Pagination page={1} pageSize={25} total={0} onPageChange={() => {}} />,
    );
    expect(buttons(empty.container).every((button) => button.disabled)).toBe(true);
    await empty.unmount();
  });
});
