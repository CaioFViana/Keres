import { useCallback, useRef, useState } from 'react';

/**
 * Reentrancy guard for async commands (save, delete, send-to-server).
 *
 * The ref rejects repeated presses synchronously - before the next render - while
 * `pending` drives the UI's disabled/spinner state. The guard always releases in
 * `finally`, so a throwing operation cannot wedge the button forever.
 */
export function useAsyncOperation() {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async (operation: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await operation();
    } finally {
      running.current = false;
      setPending(false);
    }
  }, []);
  return { pending, run };
}
