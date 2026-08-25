import { useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import { createServerService } from '../services/ServerService';
import { entityEventEmitter } from '../utils/EventEmitter';

/**
 * Whether this device has at least one registered server.
 *
 * The honest source is the `servers` table (`activeServer` only exists while a server-linked story is
 * open, and `stories.serverId` is per story), but reading it is asynchronous - hence a hook rather than
 * a store selector. It reacts to `server_connection_changed`, the same event `SyncInitializer` already
 * listens to when a server is registered or removed.
 */
export function useHasRegisteredServer(): boolean {
  const drizzleDb = useDrizzle();
  const [hasServers, setHasServers] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const servers = await createServerService(drizzleDb).getAllServers();
        if (!cancelled) {
          setHasServers(servers.length > 0);
        }
      } catch (error) {
        // A read failure must not take navigation down; it assumes "none" and tries again on the next event.
        console.log('useHasRegisteredServer: could not read servers.', error);
        if (!cancelled) {
          setHasServers(false);
        }
      }
    };

    check();
    entityEventEmitter.on('server_connection_changed', check);
    return () => {
      cancelled = true;
      entityEventEmitter.off('server_connection_changed', check);
    };
  }, [drizzleDb]);

  return hasServers;
}
