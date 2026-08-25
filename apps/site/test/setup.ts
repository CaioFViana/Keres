import { initI18n } from '../src/i18n';

declare global {
  // React 19 lê isto no `act()`. Sem a declaração, `tsc` recusa o índice em `globalThis`.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

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

/**
 * O jsdom não implementa `<dialog>`: `showModal`/`close` não existem. A foto ampliada usa o
 * elemento nativo justamente para ganhar Esc e foco preso, então aqui basta registrar a
 * abertura e o fechamento para o teste conseguir afirmar o comportamento.
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
