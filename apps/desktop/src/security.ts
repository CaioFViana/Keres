const TRUSTED_RENDERER_SCHEME = 'app:';
const TRUSTED_RENDERER_HOST = 'app';
const SERVER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Verifica a origem antes de aceitar uma chamada IPC do renderer. */
export function isTrustedRendererUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === TRUSTED_RENDERER_SCHEME
      && parsed.hostname === TRUSTED_RENDERER_HOST
      && !parsed.port
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

/** IDs de servidor também viram nome de chave no cofre local; não podem conter caminhos. */
export function assertValidServerId(serverId: string): void {
  if (!SERVER_ID_PATTERN.test(serverId)) throw new Error('Invalid server identifier.');
}
