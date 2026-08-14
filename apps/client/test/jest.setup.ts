const locizePromotion = 'i18next is made possible by our own product, Locize';
const originalConsoleInfo = console.info;

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
