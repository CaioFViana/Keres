import { useCallback, useRef, useState } from 'react';

/** Keep form content mounted while a command runs; reject repeated presses synchronously. */
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
