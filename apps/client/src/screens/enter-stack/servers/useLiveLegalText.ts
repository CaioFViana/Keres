import { useEffect, useState } from 'react';
import {
  fetchServerPrivacy,
  fetchServerTerms,
  type ServerTerms,
} from '@/src/services/servers/ServerTermsService';

/**
 * A server's terms or privacy policy in the language the app has NOW, for reading.
 *
 * The device keeps one copy, in the language of the day it was saved; switching the app to another language would
 * leave the text in the old one. While the screen showing the text is open and the server answers, the same version
 * is asked for in the current language and shown instead. It is only for reading: nothing is saved, and a different
 * version than the one the account accepted is ignored (that is the re-agreement flow's, not this one's).
 */
export function useLiveLegalText(
  kind: 'tos' | 'privacy',
  serverUrl: string | undefined,
  storedVersion: string | null | undefined,
  language: string,
  enabled: boolean,
): ServerTerms | null {
  const [live, setLive] = useState<{ key: string; document: ServerTerms } | null>(null);
  const key = `${kind}|${serverUrl}|${language}`;

  useEffect(() => {
    if (!enabled || !serverUrl || !storedVersion) return;
    let cancelled = false;
    void (async () => {
      const document =
        kind === 'tos'
          ? await fetchServerTerms(serverUrl, language)
          : await fetchServerPrivacy(serverUrl, language);
      if (cancelled || !document || String(document.version) !== String(storedVersion)) return;
      setLive({ key, document });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, kind, serverUrl, storedVersion, language, key]);

  return live?.key === key ? live.document : null;
}

/** The server's terms and its privacy policy, each read in the language of the day while its modal is open. */
export function useLiveServerLegalTexts(
  server: { url: string; tosVersion?: string | null; privacyVersion?: string | null } | undefined,
  language: string,
  open: { terms: boolean; privacy: boolean },
) {
  return {
    liveTerms: useLiveLegalText('tos', server?.url, server?.tosVersion, language, open.terms),
    livePrivacy: useLiveLegalText(
      'privacy',
      server?.url,
      server?.privacyVersion,
      language,
      open.privacy,
    ),
  };
}
