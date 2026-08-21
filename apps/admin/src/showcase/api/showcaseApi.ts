import type { ShowcaseStoryCard, ShowcaseStoryDetail, ShowcaseStoryResponse } from '@keres/shared';

/**
 * O cliente HTTP do site público.
 *
 * `fetch` puro em vez do axios do painel: aqui não existe sessão, interceptador de 401 nem
 * token em `localStorage` - misturar os dois traria justamente o que este site não deve ter.
 * A única credencial que circula é o token de desbloqueio de uma história protegida, guardado
 * em `sessionStorage` (some ao fechar a aba) e escopado a uma história só.
 */

const UNLOCK_TOKEN_PREFIX = 'keres_showcase_unlock_';

export function readUnlockToken(storyId: string): string | null {
  return sessionStorage.getItem(`${UNLOCK_TOKEN_PREFIX}${storyId}`);
}

export function storeUnlockToken(storyId: string, token: string): void {
  sessionStorage.setItem(`${UNLOCK_TOKEN_PREFIX}${storyId}`, token);
}

export function clearUnlockToken(storyId: string): void {
  sessionStorage.removeItem(`${UNLOCK_TOKEN_PREFIX}${storyId}`);
}

function unlockHeaders(storyId: string): Record<string, string> {
  const token = readUnlockToken(storyId);
  return token ? { Authorization: `Showcase ${token}` } : {};
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.message === 'string'
      ? body.message
      : `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

export interface ShowcaseConfig {
  showcaseEnabled: boolean;
  serverVersion: string;
}

export async function fetchConfig(): Promise<ShowcaseConfig> {
  const response = await fetch('/public/config');
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export interface StoryListResult {
  /** `null` quando o servidor respondeu 304 - a lista em mãos continua válida. */
  stories: ShowcaseStoryCard[] | null;
  etag: string | null;
}

/**
 * A listagem, com `If-None-Match`. A página consulta em intervalo, e sem isto cada consulta
 * baixaria o catálogo inteiro de novo só para descobrir que nada mudou.
 */
export async function fetchStories(previousEtag: string | null): Promise<StoryListResult> {
  const response = await fetch('/public/stories', {
    headers: previousEtag ? { 'If-None-Match': previousEtag } : {},
  });
  if (response.status === 304) {
    return { stories: null, etag: previousEtag };
  }
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return { stories: await response.json(), etag: response.headers.get('etag') };
}

export async function fetchStory(storyId: string): Promise<ShowcaseStoryResponse> {
  const response = await fetch(`/public/stories/${encodeURIComponent(storyId)}`, {
    headers: unlockHeaders(storyId),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function unlockStory(storyId: string, password: string): Promise<ShowcaseStoryDetail> {
  const response = await fetch(`/public/stories/${encodeURIComponent(storyId)}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const { token } = (await response.json()) as { token: string };
  storeUnlockToken(storyId, token);

  const detail = await fetchStory(storyId);
  if ('protected' in detail) {
    // Não deveria acontecer: o token acabou de ser emitido para esta história.
    clearUnlockToken(storyId);
    throw new Error('Could not open this story.');
  }
  return detail;
}

/**
 * O endereço de download de uma versão.
 *
 * Um `<a download>` não manda cabeçalho, então para uma história protegida o servidor devolve
 * um link com um token de 60 segundos embutido, em vez de aceitar o token de uma hora numa URL
 * que ficaria no histórico do navegador.
 */
export async function fetchDownloadUrl(storyId: string, publicationId: string): Promise<string> {
  const response = await fetch(
    `/public/stories/${encodeURIComponent(storyId)}/publications/${encodeURIComponent(
      publicationId,
    )}/download-url`,
    { method: 'POST', headers: unlockHeaders(storyId) },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const { url } = (await response.json()) as { url: string };
  return url;
}
