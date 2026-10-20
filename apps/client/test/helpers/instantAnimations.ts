import { Animated } from 'react-native';

/**
 * Makes `Animated.timing` finish on the spot, inside whatever call started it.
 *
 * A real timing animation advances on its own frames after the press that started it, so each
 * frame updates the animated component outside `act()`. A test about what a switch or a card does,
 * not about how it glides, can run the animation to its end immediately instead. Call it in a
 * `beforeEach` and restore the spy in an `afterEach`.
 */
export function useInstantTiming(): jest.SpyInstance {
  return jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: (callback) => {
      (value as Animated.Value).setValue(config.toValue as number);
      callback?.({ finished: true });
    },
    stop: () => {},
    reset: () => {},
  }));
}
