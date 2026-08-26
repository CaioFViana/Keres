import { entityEventEmitter } from '../../src/utils/EventEmitter';

// A module singleton, shared by every service: without clearing it, one test leaks into the next
// exactly as a forgotten listener would leak between screens.
const registered: { event: string; listener: (...args: any[]) => void }[] = [];

function listen(event: string, listener: (...args: any[]) => void) {
  entityEventEmitter.on(event, listener);
  registered.push({ event, listener });
  return listener;
}

afterEach(() => {
  while (registered.length > 0) {
    const { event, listener } = registered.pop()!;
    entityEventEmitter.off(event, listener);
  }
});

describe('entityEventEmitter', () => {
  it('notifies every listener of an event with all arguments', () => {
    const first = listen('character_changed', jest.fn());
    const second = listen('character_changed', jest.fn());

    entityEventEmitter.emit('character_changed', 'story-1', { id: 'char-1' });

    expect(first).toHaveBeenCalledWith('story-1', { id: 'char-1' });
    expect(second).toHaveBeenCalledWith('story-1', { id: 'char-1' });
  });

  it('does not notify listeners of a different event', () => {
    const other = listen('scene_changed', jest.fn());
    listen('character_changed', jest.fn());

    entityEventEmitter.emit('character_changed', 'story-1');

    expect(other).not.toHaveBeenCalled();
  });

  it('is a no-op for an event nobody subscribed to', () => {
    expect(() => entityEventEmitter.emit('never_subscribed', 'story-1')).not.toThrow();
  });

  it('stops notifying a listener after off', () => {
    const listener = listen('character_changed', jest.fn());

    entityEventEmitter.off('character_changed', listener);
    entityEventEmitter.emit('character_changed', 'story-1');

    expect(listener).not.toHaveBeenCalled();
  });

  it('leaves the other listeners of the event registered', () => {
    const removed = listen('character_changed', jest.fn());
    const kept = listen('character_changed', jest.fn());

    entityEventEmitter.off('character_changed', removed);
    entityEventEmitter.emit('character_changed', 'story-1');

    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('ignores an off for an event with no listeners', () => {
    expect(() => entityEventEmitter.off('never_subscribed', jest.fn())).not.toThrow();
  });

  describe('emitAsync', () => {
    it('waits for every async listener before resolving', async () => {
      const completed: string[] = [];
      listen('sync_finished', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed.push('slow');
      });
      listen('sync_finished', () => {
        completed.push('fast');
      });

      await entityEventEmitter.emitAsync('sync_finished', 'story-1');

      expect(completed.sort()).toEqual(['fast', 'slow']);
    });

    it('resolves immediately when nobody is listening', async () => {
      await expect(entityEventEmitter.emitAsync('never_subscribed')).resolves.toBeUndefined();
    });

    it('rejects when a listener rejects, instead of swallowing the failure', async () => {
      listen('sync_finished', async () => {
        throw new Error('listener falhou');
      });

      await expect(entityEventEmitter.emitAsync('sync_finished')).rejects.toThrow(
        'listener falhou',
      );
    });
  });
});
