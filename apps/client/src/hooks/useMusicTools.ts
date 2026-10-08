import { useEffect } from 'react';
import { useMusicToolsStore } from '../state/musicToolsStore';

/** Whether the music tools are on (chords, sheet, accompaniment, files). Reads what was kept the first time. */
export function useMusicTools(): boolean {
  const enabled = useMusicToolsStore((state) => state.enabled);
  const hydrate = useMusicToolsStore((state) => state.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return enabled;
}
