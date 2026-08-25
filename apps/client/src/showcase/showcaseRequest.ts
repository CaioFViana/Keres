import { Platform } from 'react-native';

/**
 * Showcase mode: the app opens straight into a specific screen, with an example story installed, in
 * the requested theme and language.
 *
 * It exists for the website's screen capture (`apps/desktop/scripts/capture-screens.ts`). The
 * alternative would be the capturer clicking through the opening - language, name, story selection,
 * installing the example, drawer, screen - a dozen steps that break whenever a label changes. Here the
 * capture becomes "open a URL and wait".
 *
 * It only exists on the web and only with the parameter in the URL: on any other path, `null`.
 */
export interface ShowcaseRequest {
  /** The story's folder in `exampleStories/content`. */
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
 * A navigator's initial route when the showcase asked for one of its screens - and the app's default
 * in every other case.
 *
 * An initial route, and not imperative navigation: it does not depend on the navigator already being
 * mounted, it does not race the data loading and it does not let the previous screen flash before the
 * capture.
 */
export function showcaseInitialRoute<T extends string>(stack: string, fallback: T): T {
  const request = readShowcaseRequest();
  if (!request || request.stack !== stack || !request.screen) return fallback;
  return request.screen as T;
}
