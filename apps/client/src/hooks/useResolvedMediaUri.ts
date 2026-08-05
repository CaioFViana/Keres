import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { DESKTOP_MEDIA_URI_PREFIX, resolveBlobUri } from '../services/webMediaStore';

/**
 * Resolve um `localPath`/`thumbnailPath` de mídia para algo que `<Image>`/`<video>`/
 * `<audio>` conseguem carregar.
 *
 * Nativo: o valor guardado já é um `file://` direto, devolvido sem mudança. Web: o valor
 * guardado é um path estável em disco (`desktop-media:media/...` - ver MediaFileService.ts),
 * que não é carregável diretamente; precisa virar um `blob:` URL primeiro, o que só pode
 * acontecer de forma assíncrona (ler o arquivo via IPC do processo main). Por isso o hook
 * começa em `null` (ainda resolvendo) até o efeito completar.
 */
export function useResolvedMediaUri(path: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setResolved(null);
      return;
    }

    if (Platform.OS !== 'web' || !path.startsWith(DESKTOP_MEDIA_URI_PREFIX)) {
      setResolved(path);
      return;
    }

    let cancelled = false;
    setResolved(null);
    resolveBlobUri(path)
      .then((blobUri) => {
        if (!cancelled) {
          setResolved(blobUri);
        }
      })
      .catch((error) => {
        console.warn('useResolvedMediaUri: failed to resolve', path, error);
        if (!cancelled) {
          setResolved(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return resolved;
}
