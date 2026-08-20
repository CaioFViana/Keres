const TRUSTED_RENDERER_SCHEME = 'app:';
const TRUSTED_RENDERER_HOST = 'app';
const SERVER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Verifica a origem antes de aceitar uma chamada IPC do renderer. */
export function isTrustedRendererUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === TRUSTED_RENDERER_SCHEME &&
      parsed.hostname === TRUSTED_RENDERER_HOST &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

/** IDs de servidor também viram nome de chave no cofre local; não podem conter caminhos. */
export function assertValidServerId(serverId: string): void {
  if (!SERVER_ID_PATTERN.test(serverId)) throw new Error('Invalid server identifier.');
}

/**
 * Endereços que devem sair do app e abrir no navegador do sistema.
 *
 * O Keres desktop é a janela de um app, não um navegador: abrir a página pública de uma
 * história (ou qualquer outro site) dentro dela deixaria a pessoa presa num Chromium sem barra
 * de endereço, sem histórico e sem os logins que ela já tem. Só `http`/`https` saem - qualquer
 * outro esquema (`file:`, `app:`, e principalmente coisas como `javascript:`) é recusado, para
 * um link não virar um jeito de mandar o sistema operacional executar algo.
 */
export function isExternalBrowserUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Se esta navegação sai da aplicação - ou seja, não é o próprio renderer confiável. */
export function isInAppNavigation(url: string | undefined): boolean {
  return isTrustedRendererUrl(url);
}
