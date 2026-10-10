/**
 * @jest-environment node
 */
import { attachCanvasWebInput } from '../../src/hooks/canvasWebInput';

type Listener = (event: unknown) => void;

const createNode = () => {
  const listeners = new Map<string, Listener>();
  const node = {
    addEventListener: jest.fn((type: string, listener: Listener) => listeners.set(type, listener)),
    removeEventListener: jest.fn((type: string) => listeners.delete(type)),
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 300 }),
    focus: jest.fn(),
  };
  return { node, listeners };
};

const handlers = () => ({ zoomAt: jest.fn(), panBy: jest.fn(), fit: jest.fn() });

const keyEvent = (key: string, extra: Record<string, unknown> = {}) => ({
  key,
  preventDefault: jest.fn(),
  ...extra,
});

describe('attachCanvasWebInput', () => {
  it('attaches nothing off the web, without a node, or on a node that cannot listen', () => {
    const { node } = createNode();

    expect(attachCanvasWebInput({ current: node }, 'ios', handlers())).toBeUndefined();
    expect(attachCanvasWebInput({ current: null }, 'web', handlers())).toBeUndefined();
    expect(attachCanvasWebInput({ current: {} }, 'web', handlers())).toBeUndefined();
    expect(node.addEventListener).not.toHaveBeenCalled();
  });

  it('zooms under the cursor with the wheel, and keeps the page from scrolling', () => {
    const { node, listeners } = createNode();
    const input = handlers();
    attachCanvasWebInput({ current: node }, 'web', input);
    const preventDefault = jest.fn();

    listeners.get('wheel')!({
      deltaY: -100,
      deltaMode: 0,
      clientX: 110,
      clientY: 70,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalled();
    const [factor, focus] = input.zoomAt.mock.calls[0];
    expect(factor).toBeGreaterThan(1);
    expect(focus).toEqual({ x: 100, y: 50 });
    expect(node.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), {
      passive: false,
    });
  });

  it.each([
    ['+', 'zoomAt', [1.25, { x: 200, y: 150 }]],
    ['=', 'zoomAt', [1.25, { x: 200, y: 150 }]],
    ['-', 'zoomAt', [0.8, { x: 200, y: 150 }]],
    ['0', 'fit', []],
    ['ArrowLeft', 'panBy', [64, 0]],
    ['ArrowRight', 'panBy', [-64, 0]],
    ['ArrowUp', 'panBy', [0, 64]],
    ['ArrowDown', 'panBy', [0, -64]],
  ] as const)('answers %s with %s', (key, action, args) => {
    const { node, listeners } = createNode();
    const input = handlers();
    attachCanvasWebInput({ current: node }, 'web', input);
    const event = keyEvent(key);

    listeners.get('keydown')!(event);

    expect(input[action]).toHaveBeenCalledTimes(1);
    expect((input[action] as jest.Mock).mock.calls[0]).toEqual(args);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('leaves other keys, shortcuts and typing in a field alone', () => {
    const { node, listeners } = createNode();
    const input = handlers();
    attachCanvasWebInput({ current: node }, 'web', input);

    for (const event of [
      keyEvent('a'),
      keyEvent('+', { ctrlKey: true }),
      keyEvent('-', { metaKey: true }),
      keyEvent('+', { target: { tagName: 'INPUT' } }),
      keyEvent('0', { target: { tagName: 'TEXTAREA' } }),
      keyEvent('ArrowLeft', { target: { isContentEditable: true } }),
    ]) {
      listeners.get('keydown')!(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(input.zoomAt).not.toHaveBeenCalled();
    expect(input.panBy).not.toHaveBeenCalled();
    expect(input.fit).not.toHaveBeenCalled();
  });

  it('gives the canvas the keyboard when the pointer presses it', () => {
    const { node, listeners } = createNode();
    attachCanvasWebInput({ current: node }, 'web', handlers());

    listeners.get('pointerdown')!({});

    expect(node.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('lets go of everything on cleanup', () => {
    const { node, listeners } = createNode();
    const detach = attachCanvasWebInput({ current: node }, 'web', handlers());

    detach!();

    expect(listeners.size).toBe(0);
    expect(node.removeEventListener).toHaveBeenCalledTimes(3);
  });
});
