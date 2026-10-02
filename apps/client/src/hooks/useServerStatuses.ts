import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { pingServer, type ServerWithStatus } from '../services/ServerStatusService';
import { createServerService } from '../services/ServerService';

/** How often the servers are read again and pinged while the screen is in front. */
const REFRESH_INTERVAL_MS = 7000;

/**
 * The registered servers with whether each one answers, kept fresh while the screen is focused.
 * With `serverId` only that server is followed (the detail screen); without it, every one.
 *
 * The servers are re-read from the local DB (so fields like `lastSyncDate`, kept fresh by the
 * background sync engine, show up without leaving and re-entering the screen) and pinged right away
 * - not on a delay, so the status is not stuck "checking" until the first interval tick.
 */
export function useServerStatuses(serverId?: string) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const [serverService] = useState(() => createServerService(drizzleDb));
  const isFocused = useIsFocused();

  const [servers, setServers] = useState<ServerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAndPingServers = useCallback(async () => {
    try {
      const all = await serverService.getAllServers();
      const wanted = serverId ? all.filter((server) => server.id === serverId) : all;
      // What was known stays while it is asked again: a status that went back to "checking" every
      // few seconds would blink. A server seen for the first time is "checking" until it answers.
      setServers((previous) =>
        wanted.map((server) => {
          const known = previous.find((candidate) => candidate.id === server.id);
          return {
            ...server,
            pingStatus: known?.pingStatus ?? 'pending',
            apiVersion: known?.apiVersion ?? null,
          };
        }),
      );
      setError(null);

      if (wanted.length > 0) {
        setServers(await Promise.all(wanted.map(pingServer)));
      }
    } catch (err) {
      console.error('Failed to load servers:', err);
      setError(t('failed_to_load_servers'));
    }
  }, [serverService, serverId, t]);

  const [prevIsFocused, setPrevIsFocused] = useState(isFocused);
  const [prevLoadAndPingServers, setPrevLoadAndPingServers] = useState(() => loadAndPingServers);
  if (isFocused !== prevIsFocused || loadAndPingServers !== prevLoadAndPingServers) {
    setPrevIsFocused(isFocused);
    // Wrapped: the state holds the callback itself, and an unwrapped function argument would
    // run as a state updater instead - invoking a DB read during render on every focus change
    // and looping into "Too many re-renders".
    setPrevLoadAndPingServers(() => loadAndPingServers);
    if (isFocused) {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `loadAndPingServers` only reaches setState after `await`; the rule cannot verify across the callback boundary.
    loadAndPingServers().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    const intervalId = setInterval(loadAndPingServers, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isFocused, loadAndPingServers]);

  /** Shows a new tag right away, without waiting for the next read. */
  const updateTag = useCallback((changedId: string, tag: string | null) => {
    setServers((current) =>
      current.map((server) => (server.id === changedId ? { ...server, tag } : server)),
    );
  }, []);

  return { servers, loading, error, updateTag };
}
