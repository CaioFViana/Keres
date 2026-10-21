import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchShowcaseEnabled } from '../api/landing';
import { isLandingBuild } from '../variant';

const ShowcaseAvailability = createContext(false);

/**
 * Whether the server hosting this page has its public showcase on, asked once for the whole page. Only the
 * landing build has a server to ask: the project site on GitHub Pages never offers the showcase, and a
 * server that answers badly or is down offers it no more than one that has it off.
 */
export function ShowcaseAvailabilityProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isLandingBuild) return;
    let current = true;
    void fetchShowcaseEnabled().then((value) => {
      if (current) setEnabled(value);
    });
    return () => {
      current = false;
    };
  }, []);

  return <ShowcaseAvailability.Provider value={enabled}>{children}</ShowcaseAvailability.Provider>;
}

export function useShowcaseAvailable(): boolean {
  return useContext(ShowcaseAvailability);
}
