import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventManager } from '../../src/utils/EventManager';

const registered: Array<[string, (payload: unknown) => void]> = [];

function listen(event: string, callback = vi.fn()) {
  eventManager.on(event, callback);
  registered.push([event, callback]);
  return callback;
}

afterEach(() => {
  while (registered.length) {
    const [event, callback] = registered.pop()!;
    eventManager.off(event, callback);
  }
});

describe('event manager integration', () => {
  it('delivers an event to every listener registered for it', () => {
    const first = listen('story:updated');
    const second = listen('story:updated');
    const otherEvent = listen('story:deleted');

    eventManager.emit('story:updated', { storyId: 'story-1' });

    expect(first).toHaveBeenCalledWith({ storyId: 'story-1' });
    expect(second).toHaveBeenCalledWith({ storyId: 'story-1' });
    expect(otherEvent).not.toHaveBeenCalled();
  });

  it('removes only the requested listener and tolerates unknown events', () => {
    const removed = listen('story:updated');
    const kept = listen('story:updated');
    eventManager.off('story:updated', removed);
    eventManager.off('never:registered', vi.fn());
    eventManager.emit('story:updated', {});
    eventManager.emit('nobody:listening', {});

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
  });
});
