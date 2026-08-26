import { initI18n } from '../src/i18n';

declare global {
  // React 19 reads this in `act()`. Without the declaration, `tsc` rejects the index on `globalThis`.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// React 19 refuses `act()` if the test environment does not declare itself. Without this, every
// render/click in the helper prints "The current testing environment is not configured to
// support act(...)" and the tests still pass - what goes away is the noise.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

/**
 * jsdom does not implement `<dialog>`: `showModal`/`close` do not exist. The enlarged screenshot
 * uses the native element precisely to get Esc and trapped focus, so here it is enough to record
 * the opening and the closing for the test to be able to assert the behaviour.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

initI18n('keres_test_language');
