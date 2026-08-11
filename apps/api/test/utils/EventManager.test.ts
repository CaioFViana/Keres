import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventManager } from '../../src/utils/EventManager';

// `eventManager` é um singleton de módulo: sem limpar os listeners, um teste vaza para o
// seguinte exatamente como vazaria entre requisições.
const registered: { event: string; callback: (payload: unknown) => void }[] = [];

function listen(event: string, callback: (payload: unknown) => void) {
  eventManager.on(event, callback);
  registered.push({ event, callback });
  return callback;
}

beforeEach(() => {
  while (registered.length > 0) {
    const { event, callback } = registered.pop()!;
    eventManager.off(event, callback);
  }
});

describe('eventManager', () => {
  it('delivers a payload to every listener of the event', () => {
    const first = listen('story:updated', vi.fn());
    const second = listen('story:updated', vi.fn());

    eventManager.emit('story:updated', { storyId: 'story-1' });

    expect(first).toHaveBeenCalledWith({ storyId: 'story-1' });
    expect(second).toHaveBeenCalledWith({ storyId: 'story-1' });
  });

  it('does not leak a payload to listeners of another event', () => {
    const other = listen('story:deleted', vi.fn());
    listen('story:updated', vi.fn());

    eventManager.emit('story:updated', {});

    expect(other).not.toHaveBeenCalled();
  });

  it('is a no-op when nobody is listening', () => {
    expect(() => eventManager.emit('nobody:listening', {})).not.toThrow();
  });

  it('stops calling a listener once it is removed', () => {
    const callback = listen('story:updated', vi.fn());

    eventManager.off('story:updated', callback);
    eventManager.emit('story:updated', {});

    expect(callback).not.toHaveBeenCalled();
  });

  it('only removes the listener that was passed to off', () => {
    const removed = listen('story:updated', vi.fn());
    const kept = listen('story:updated', vi.fn());

    eventManager.off('story:updated', removed);
    eventManager.emit('story:updated', { storyId: 'story-1' });

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('ignores an off for an event that was never registered', () => {
    expect(() => eventManager.off('never:registered', vi.fn())).not.toThrow();
  });

  it('calls a listener registered twice once per registration', () => {
    const callback = vi.fn();
    listen('story:updated', callback);
    listen('story:updated', callback);

    eventManager.emit('story:updated', {});

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
