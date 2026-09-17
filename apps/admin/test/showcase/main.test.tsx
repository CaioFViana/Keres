import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createRoot: vi.fn(), render: vi.fn() }));

vi.mock('react-dom/client', () => ({
  createRoot: mocks.createRoot.mockReturnValue({ render: mocks.render }),
  default: { createRoot: mocks.createRoot },
}));

beforeAll(async () => {
  document.body.innerHTML = '<div id="root"></div>';
  await import('../../src/showcase/main');
});

describe('showcase entry point', () => {
  it('mounts the site in the root element', () => {
    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'));
    expect(mocks.render).toHaveBeenCalledOnce();
  });

  it('resolves the theme before the first paint', () => {
    expect(document.documentElement.getAttribute('data-theme')).toMatch(/light|dark/);
  });
});
