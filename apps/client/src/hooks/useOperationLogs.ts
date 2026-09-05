import { OperationLogEntityType, type FavoriteBehavior } from '@keres/shared';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';
import { and, eq, inArray } from 'drizzle-orm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle, worldRules } from '../db';
import type { OperationLogSelect } from '../db/schema';
import { createOperationLogService } from '../services/OperationLogService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';

interface UseOperationLogsOptions {
  storyId: string;
  limit?: number;
  paginated?: boolean;
  pageSize?: number;
  shouldRefetch?: boolean;
}

export function useOperationLogs({
  storyId,
  limit,
  paginated,
  pageSize = 20,
  shouldRefetch,
}: UseOperationLogsOptions) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const [logs, setLogs] = useState<OperationLogSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [favoriteBehavior, setFavoriteBehavior] = useState<FavoriteBehavior>('individual');
  const [worldPieceSections, setWorldPieceSections] = useState<Record<string, WorldPieceSection>>(
    {},
  );
  const operationLogService = useMemo(
    () => (drizzleDb ? createOperationLogService(drizzleDb) : null),
    [drizzleDb],
  );

  const fetchLogs = useCallback(
    async (currentPage: number = 1) => {
      if (!operationLogService || !storyId) return;

      setLoading(true);
      setError(null);
      try {
        let fetchedLogs: OperationLogSelect[] = [];
        let total = 0;

        if (paginated) {
          const result = await operationLogService.getPaginatedOperationLogs(
            storyId,
            currentPage,
            pageSize,
            userId ?? undefined,
          );
          fetchedLogs = result.logs;
          total = result.total;
        } else if (limit) {
          fetchedLogs = await operationLogService.getRecentOperationLogs(
            storyId,
            limit,
            userId ?? undefined,
          );
          total = fetchedLogs.length;
        }

        setFavoriteBehavior(await operationLogService.getFavoriteBehavior(storyId));
        setLogs((currentLogs) => {
          if (!paginated || currentPage === 1) return fetchedLogs;
          const knownIds = new Set(currentLogs.map((log) => log.id));
          return [...currentLogs, ...fetchedLogs.filter((log) => !knownIds.has(log.id))];
        });
        setTotalLogs(total);
      } catch (err) {
        console.error('Failed to fetch operation logs:', err);
        setError(t('failed_to_load_operation_logs'));
      } finally {
        setLoading(false);
      }
    },
    [limit, operationLogService, pageSize, paginated, storyId, t, userId],
  );

  const loadFirstPage = useCallback(() => {
    setPage(1);
    void fetchLogs(1);
  }, [fetchLogs]);

  useEntityInitialLoad(loadFirstPage);

  useEffect(() => {
    const handleOperationLogUpdated = (updatedStoryId: string) => {
      if (updatedStoryId === storyId) {
        setPage(1);
        fetchLogs(1);
      }
    };
    entityEventEmitter.on('operation_log_updated', handleOperationLogUpdated);
    return () => {
      entityEventEmitter.off('operation_log_updated', handleOperationLogUpdated);
    };
  }, [fetchLogs, storyId]);

  useEffect(() => {
    const worldPieceIds = logs
      .filter((log) => log.entityType === OperationLogEntityType.WorldRule)
      .map((log) => log.entityId);
    if (worldPieceIds.length === 0) {
      setWorldPieceSections({});
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rows = await drizzleDb
          .select({ id: worldRules.id, section: worldRules.section })
          .from(worldRules)
          .where(
            and(
              eq(worldRules.storyId, storyId),
              inArray(worldRules.id, [...new Set(worldPieceIds)]),
            ),
          )
          .all();
        if (!cancelled) {
          setWorldPieceSections(Object.fromEntries(rows.map((row) => [row.id, row.section])));
        }
      } catch (lookupError) {
        console.warn('Could not resolve World Piece appearances for operation logs.', lookupError);
        if (!cancelled) setWorldPieceSections({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [drizzleDb, logs, storyId]);

  useEffect(() => {
    if (shouldRefetch) {
      setPage(1);
      fetchLogs(1);
    }
  }, [fetchLogs, shouldRefetch]);

  const loadMore = useCallback(() => {
    if (paginated && !loading && logs.length < totalLogs) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLogs(nextPage);
    }
  }, [fetchLogs, loading, logs.length, page, paginated, totalLogs]);

  return { logs, loading, error, favoriteBehavior, worldPieceSections, loadMore };
}
