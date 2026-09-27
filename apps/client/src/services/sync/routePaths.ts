import type { SyncConflict as SharedSyncConflict } from '@keres/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { recordLocalOperationSync } from '../../utils/syncUtils';
import { isFoldableDuplicate } from './duplicateFold';
import type { SyncContext } from './SyncContext';
import { type RoutePathStep } from './routePathDecision';
import { syncEntityKey } from './syncPure';

/**
 * A route's path as one thing.
 *
 * Replacing a path writes its steps at positions 1..N, and the server refuses a step at a position
 * another device's path already holds (`duplicate`). Folded step by step, two paths of different
 * lengths would mix - the first one's steps with the second one's tail. Instead, this device lets
 * its whole path go (the server's stands) and records one decision on the route: keep mine
 * replaces the path with this device's again, keep the server's leaves it.
 */

/**
 * Folds the paths of every route a step of which the server refused as a `duplicate`. Runs under
 * the story's op-log lock. Answers the refused entities it settled (never judged one by one) and
 * how many decisions it recorded.
 */
export async function foldRoutePaths(
  context: SyncContext,
  refused: readonly { entityType: string; entityId: string; group: SharedSyncConflict[] }[],
  pushedOperations: readonly OperationLogSelect[],
): Promise<{ handled: Set<string>; conflicts: number }> {
  const db = context.db()!;
  const storyId = context.storyId()!;
  const handled = new Set<string>();
  const twinsByRoute = new Map<string, Record<string, any>[]>();
  for (const { entityType, entityId, group } of refused) {
    if (entityType !== 'RouteStep') continue;
    const duplicate = group.find(isFoldableDuplicate);
    if (!duplicate) continue;
    const local = await db.query.routeSteps.findFirst({
      where: eq(schema.routeSteps.id, entityId),
    });
    const routeId = local?.routeId ?? duplicate.serverEntity!.routeId;
    if (typeof routeId !== 'string') continue;
    twinsByRoute.set(routeId, [...(twinsByRoute.get(routeId) ?? []), duplicate.serverEntity!]);
  }
  if (twinsByRoute.size === 0) return { handled, conflicts: 0 };

  const refusedKeys = new Set(
    refused.map(({ entityType, entityId }) => syncEntityKey(entityType, entityId)),
  );
  const userId =
    (
      await db.query.stories.findFirst({
        where: eq(schema.stories.id, storyId),
        columns: { userId: true },
      })
    )?.userId ?? 'local_user';
  let conflicts = 0;

  // This device's path: the steps it created in this push, or has queued to create. A step it
  // pulled is the other path's.
  const pushedCreates = new Set(
    pushedOperations
      .filter((op) => op.entityType === 'RouteStep' && op.operationType === 'create')
      .map((op) => op.entityId),
  );
  const queuedCreates = new Set(
    (
      await db.query.operationLogs.findMany({
        where: and(
          eq(schema.operationLogs.storyId, storyId),
          eq(schema.operationLogs.entityType, 'RouteStep'),
          eq(schema.operationLogs.operationType, 'create'),
          eq(schema.operationLogs.isSynced, false),
        ),
        columns: { entityId: true },
      })
    ).map((op) => op.entityId),
  );

  for (const [routeId, twins] of twinsByRoute) {
    const steps = (
      await db.query.routeSteps.findMany({
        where: and(eq(schema.routeSteps.routeId, routeId), eq(schema.routeSteps.isDeleted, false)),
        orderBy: asc(schema.routeSteps.position),
      })
    ).filter((step) => pushedCreates.has(step.id) || queuedCreates.has(step.id));
    const localPath: RoutePathStep[] = steps.map((step) => ({
      sceneId: step.sceneId,
      selectedChoiceId: step.selectedChoiceId ?? null,
    }));

    // This device's path goes: a step the server never took is dropped, one it took is deleted.
    for (const step of steps) {
      const key = syncEntityKey('RouteStep', step.id);
      if (refusedKeys.has(key)) handled.add(key);
      const pending = (
        await db.query.operationLogs.findMany({
          where: and(
            eq(schema.operationLogs.storyId, storyId),
            eq(schema.operationLogs.entityType, 'RouteStep'),
            eq(schema.operationLogs.entityId, step.id),
            eq(schema.operationLogs.isSynced, false),
          ),
        })
      ).filter((op) => op.conflictState !== 'abandoned');
      if (pending.length > 0) {
        await db
          .update(schema.operationLogs)
          .set({ conflictState: 'abandoned', isSynced: true })
          .where(
            inArray(
              schema.operationLogs.id,
              pending.map((op) => op.id),
            ),
          )
          .run();
      }
      if (pending.some((op) => op.operationType === 'create')) {
        await db.delete(schema.routeSteps).where(eq(schema.routeSteps.id, step.id)).run();
        continue;
      }
      const version = step.version + 1;
      await db
        .update(schema.routeSteps)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version })
        .where(eq(schema.routeSteps.id, step.id))
        .run();
      recordLocalOperationSync(db, storyId, userId, 'delete', 'RouteStep', step.id, {
        id: step.id,
        isDeleted: true,
        version,
      });
    }

    const route = await db.query.routes.findFirst({ where: eq(schema.routes.id, routeId) });
    if (!route || route.isDeleted) continue;
    const serverPath: RoutePathStep[] = [...twins]
      .sort((left, right) => Number(left.position) - Number(right.position))
      .map((twin) => ({
        sceneId: String(twin.sceneId),
        selectedChoiceId: (twin.selectedChoiceId as string | null) ?? null,
      }));
    await context.conflictService().recordConflict({
      storyId,
      entityType: 'Route',
      entityId: routeId,
      reason: 'concurrent_edit',
      localOperationType: 'update',
      localOperationIds: [],
      localValues: { steps: localPath },
      serverValues: { name: route.name, details: route.details, steps: serverPath },
      clientVersion: route.version,
      serverVersion: route.version,
      message: `Another device replaced the path of Route ${routeId} as this one did.`,
    });
    conflicts += 1;
  }
  return { handled, conflicts };
}
