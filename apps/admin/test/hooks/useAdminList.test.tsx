import { describe, expect, it, vi } from 'vitest';
import { useAdminList } from '../../src/hooks/useAdminList';
import { click, flush, render } from '../helpers/react';

type Row = { id: string };

function Probe({
  load,
  filter,
}: {
  load: (filter: string) => Promise<{ items: Row[]; total: number }>;
  filter: string;
}) {
  const list = useAdminList(() => load(filter), [filter]);
  return (
    <div>
      <span data-testid="state">
        {list.loading ? 'loading' : list.error ? `error:${list.error}` : 'ready'}
      </span>
      <span data-testid="rows">{list.items.map((row) => row.id).join(',')}</span>
      <span data-testid="total">{list.total}</span>
      <button type="button" onClick={list.reload}>
        reload
      </button>
    </div>
  );
}

const text = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-testid="${id}"]`)!.textContent;

describe('useAdminList', () => {
  it('loads on mount and reports the rows and the total', async () => {
    const load = vi.fn().mockResolvedValue({ items: [{ id: 'a' }, { id: 'b' }], total: 7 });
    const view = await render(<Probe load={load} filter="x" />);
    await flush();

    expect(text(view.container, 'state')).toBe('ready');
    expect(text(view.container, 'rows')).toBe('a,b');
    expect(text(view.container, 'total')).toBe('7');
    await view.unmount();
  });

  it('loads again when what it depends on changes, and when asked to reload', async () => {
    const load = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const view = await render(<Probe load={load} filter="x" />);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);

    await view.unmount();
    const again = await render(<Probe load={load} filter="y" />);
    await flush();
    expect(load).toHaveBeenLastCalledWith('y');

    await click(again.container.querySelector('button')!);
    await flush();
    expect(load).toHaveBeenCalledTimes(3);
    await again.unmount();
  });

  it('reports a failure instead of rows', async () => {
    const load = vi.fn().mockRejectedValue(new Error('boom'));
    const view = await render(<Probe load={load} filter="x" />);
    await flush();

    expect(text(view.container, 'state')).toBe('error:boom');
    await view.unmount();
  });
});
