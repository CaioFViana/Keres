/**
 * Moves a jsdom suite to another URL (`@jest-environment ./test/helpers/jsdomEnvironment.js`). jsdom no longer lets a
 * test redefine `window.location`, so the document is reconfigured instead and `location` reports the new address.
 */
export function setJsdomUrl(url: string): void {
  (globalThis as unknown as { __reconfigureJsdomUrl: (url: string) => void }).__reconfigureJsdomUrl(
    url,
  );
}
