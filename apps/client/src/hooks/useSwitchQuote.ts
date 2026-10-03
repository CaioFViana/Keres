import type { SwitchQuote } from '@keres/shared';
import { useEffect, useState } from 'react';
import type { ServerSelect } from '../db/schema';
import { getSwitchQuote } from '../services/PaymentService';

/**
 * What changing to the chosen plan would do to the time left on the current one, asked of the server (which is
 * what will also apply it when the payment arrives, so the numbers are the same). Only while `enabled` - a
 * running subscription on another plan - and only for the choice that was asked about: an answer that arrives
 * after the choice moved on is not shown. `null` while unknown, when nothing converts, or when it cannot be asked.
 */
export function useSwitchQuote(
  server: ServerSelect | undefined,
  tierId: string | null,
  interval: string | null,
  enabled: boolean,
): SwitchQuote | null {
  const key = `${server?.id ?? ''}|${tierId ?? ''}|${interval ?? ''}`;
  // Kept with the choice it answers, so a stale answer never has to be cleared: it just stops matching.
  const [answer, setAnswer] = useState<{ key: string; quote: SwitchQuote | null } | null>(null);

  useEffect(() => {
    if (!server || !enabled || !tierId || !interval) return;
    let ignore = false;
    getSwitchQuote(server, tierId, interval)
      .then((quote) => {
        if (!ignore) setAnswer({ key, quote });
      })
      .catch(() => {
        // Not being able to preview is not a reason to stop somebody paying.
        if (!ignore) setAnswer({ key, quote: null });
      });
    return () => {
      ignore = true;
    };
  }, [server, enabled, tierId, interval, key]);

  return enabled && answer?.key === key ? answer.quote : null;
}
