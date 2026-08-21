import { initI18n } from '../src/i18n';

// React 19 recusa `act()` se o ambiente de teste não se declara. Sem isto, cada
// render/click do helper imprime "The current testing environment is not configured
// to support act(...)" e os testes ainda passam — o ruído é que some.
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

initI18n('keres_test_language');
