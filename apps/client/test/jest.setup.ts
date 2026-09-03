const locizePromotion = 'i18next is made possible by our own product, Locize';
const originalConsoleInfo = console.info;

// React needs this explicit signal outside the browser so asynchronous updates performed by
// React Native test renderers are treated as an `act`-aware environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Reanimated schedules native-frame updates in the real runtime. Its Jest implementation keeps
// collapsible controls deterministic and prevents animation updates from leaking outside `act`.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

/**
 * i18next prints a sponsorship banner whenever it initializes. It has no diagnostic value in
 * this suite, while other `console.info` calls remain visible to preserve useful test output.
 */
console.info = (...args: Parameters<typeof console.info>) => {
  if (args.some((arg) => typeof arg === 'string' && arg.includes(locizePromotion))) {
    return;
  }
  originalConsoleInfo(...args);
};
