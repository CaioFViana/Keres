import { useEffect, useRef, useState } from 'react';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { fetchVerificationStatus } from '@/src/services/api/AgeVerificationApiService';

/** The states in which the person still has to do something about the age check of the account on a server. */
export type VerificationNotice = 'pending' | 'rejected' | 'expired';

function noticeFor(status: string): VerificationNotice | null {
  return status === 'pending' || status === 'rejected' || status === 'expired' ? status : null;
}

/**
 * Whether the account on this server still needs its age check finished, asked while `enabled` (the caller passes
 * "online and in front": a server that cannot be reached is not asked, and the answer is read again when the screen
 * comes back, since the approval may have happened on the verification screen). Null when nothing is to be done,
 * when the answer is not known yet, and when the server does not say (an older server has no such route).
 */
export function useAccountVerificationNotice(
  server: ServerSelect | undefined,
  enabled: boolean,
): VerificationNotice | null {
  const serverId = server?.id;
  const [settled, setSettled] = useState<{
    serverId: string;
    notice: VerificationNotice | null;
  } | null>(null);
  // The effect reads the latest server row through this ref: a refreshed row must not ask the server again.
  const latest = useRef(server);
  useEffect(() => {
    latest.current = server;
  }, [server]);
  const wanted = enabled && serverId ? serverId : null;

  useEffect(() => {
    const target = latest.current;
    if (!wanted || !target) return;
    let cancelled = false;
    fetchVerificationStatus(target).then(
      ({ status }) => {
        if (!cancelled) setSettled({ serverId: wanted, notice: noticeFor(status) });
      },
      () => {
        if (!cancelled) setSettled({ serverId: wanted, notice: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  return wanted !== null && settled?.serverId === wanted ? settled.notice : null;
}
