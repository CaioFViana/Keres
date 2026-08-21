import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createRoot: vi.fn(), render: vi.fn() }));

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot.mockReturnValue({ render: mocks.render }),
  default: { createRoot: mocks.createRoot },
}));

beforeAll(async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import('../src/main');
});

describe('admin entry point', () => {
  it('mounts the app in the root element', () => {
    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(mocks.render).toHaveBeenCalledOnce();
  });
});
