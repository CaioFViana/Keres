import { Platform } from 'react-native';

/**
 * Modo vitrine: o app abre já dentro de uma tela específica, com uma história de exemplo
 * instalada, no tema e no idioma pedidos.
 *
 * Existe para a captura de telas do site (`apps/desktop/scripts/capture-screens.cjs`). A
 * alternativa seria o capturador clicar pela abertura - idioma, nome, seleção de história,
 * instalação do exemplo, gaveta, tela - uma dúzia de passos que quebram quando um rótulo muda.
 * Aqui a captura vira "abrir uma URL e esperar".
 *
 * Só existe na web e só com o parâmetro na URL: em qualquer outro caminho, `null`.
 */
export interface ShowcaseRequest {
  /** Pasta da história em `exampleStories/content`. */
  story: string;
  /** Item da gaveta, ex.: `PlotsStack`. */
  stack: string;
  /** Tela dentro daquela pilha, ex.: `PlotProgress`. Ausente = a raiz da pilha. */
  screen?: string;
  theme: 'light' | 'dark';
  language: string;
}

let cached: ShowcaseRequest | null | undefined;

export function readShowcaseRequest(): ShowcaseRequest | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    cached = null;
    return cached;
  }
  const params = new URLSearchParams(window.location.search);
  const story = params.get('showcase');
  if (!story) {
    cached = null;
    return cached;
  }
  cached = {
    story,
    stack: params.get('stack') ?? 'MainDashboard',
    screen: params.get('screen') ?? undefined,
    theme: params.get('theme') === 'dark' ? 'dark' : 'light',
    language: params.get('lang') ?? 'en',
  };
  return cached;
}

/**
 * A rota inicial de um navegador quando a vitrine pediu uma tela dele - e o padrão do app em
 * qualquer outro caso.
 *
 * Rota inicial, e não navegação imperativa: não depende de o navegador já estar montado, não
 * corre contra o carregamento dos dados e não deixa a tela anterior aparecer num piscar antes
 * da captura.
 */
export function showcaseInitialRoute<T extends string>(stack: string, fallback: T): T {
  const request = readShowcaseRequest();
  if (!request || request.stack !== stack || !request.screen) return fallback;
  return request.screen as T;
}
