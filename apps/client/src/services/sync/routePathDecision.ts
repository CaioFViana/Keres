import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { createRouteService } from '../storymanagement/RouteService';

/**
 * The decision about a route's whole path (`routePaths.ts` records it): what it looks like, and how
 * keeping this device's path lands.
 */

export interface RoutePathStep {
  sceneId: string;
  selectedChoiceId: string | null;
}

/** A conflict about a route's whole path: `localValues.steps` is this device's path. */
export function isRoutePathConflict(conflict: {
  entityType: string;
  localValues: Record<string, unknown>;
}): boolean {
  return conflict.entityType === 'Route' && Array.isArray(conflict.localValues.steps);
}

/**
 * Keep mine on a route's path: this device's path replaces the route's again (steps it no longer
 * holds deleted, its own created). A path no longer valid (a scene of it deleted meanwhile) cannot
 * land, and the decision stays closed.
 */
export async function landRoutePath(
  db: AppDrizzleClient,
  conflict: { storyId: string; entityId: string; localValues: Record<string, unknown> },
): Promise<void> {
  const story = await db.query.stories.findFirst({
    where: eq(schema.stories.id, conflict.storyId),
    columns: { userId: true },
  });
  try {
    await createRouteService(db).replaceSteps(
      story?.userId ?? 'local_user',
      conflict.entityId,
      conflict.localValues.steps as RoutePathStep[],
    );
  } catch (error) {
    console.warn(`The path of Route ${conflict.entityId} cannot land:`, error);
  }
}
