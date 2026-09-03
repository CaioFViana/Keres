import { renderHook } from '@testing-library/react-native';
import {
  useEntityEventSubscriptions,
  useEntityInitialLoad,
} from '../../src/hooks/useEntityRefreshLifecycle';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

describe('entity refresh lifecycle', () => {
  it('runs the initial loader on mount and again only when its callback changes', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const view = await renderHook<void, { load: () => void }>(
      ({ load }) => useEntityInitialLoad(load),
      { initialProps: { load: first } },
    );
    expect(first).toHaveBeenCalledTimes(1);

    await view.rerender({ load: first });
    expect(first).toHaveBeenCalledTimes(1);
    await view.rerender({ load: second });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('subscribes and removes each listener with the lifecycle of its screen', async () => {
    const event = 'test_lifecycle_subscription';
    const listener = jest.fn();
    const view = await renderHook(() => useEntityEventSubscriptions([{ event, listener }]));
    entityEventEmitter.emit(event, 'story');
    expect(listener).toHaveBeenCalledWith('story');

    await view.unmount();
    entityEventEmitter.emit(event, 'story');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
