import type { AgeVerificationInfo } from '@keres/shared';
import { useEffect, useState } from 'react';
import { fetchAgeVerificationInfo } from '@/src/services/api/AgeVerificationApiService';

/**
 * How a server handles age right now, read while `enabled`. Null until it answers, and when it cannot be read:
 * the screens say nothing then, and the server itself still decides what it accepts.
 */
export function useAgeVerificationInfo(
  serverUrl: string | undefined,
  enabled: boolean,
): AgeVerificationInfo | null {
  // What was read is kept with the address it was read for, so an answer for an earlier address is never shown.
  const [settled, setSettled] = useState<{ url: string; info: AgeVerificationInfo | null } | null>(
    null,
  );
  const wanted = serverUrl && enabled ? serverUrl : null;

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    void fetchAgeVerificationInfo(wanted).then((next) => {
      if (!cancelled) setSettled({ url: wanted, info: next });
    });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  return wanted !== null && settled?.url === wanted ? settled.info : null;
}
