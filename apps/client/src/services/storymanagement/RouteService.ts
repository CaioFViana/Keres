import type { Route, RouteStep } from '@keres/shared';
import { validateRouteSteps } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient, RouteInsert, RouteStepInsert } from '../../db';
import { choices, routeSteps, routes, scenes, stories } from '../../db/schema';
import { createULID, getChangedFields } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

export type SaveRoute = Pick<Route, 'storyId' | 'name' | 'details'> & { id?: string };

export const createRouteService = (db: AppDrizzleClient) => {
  const server = createServerService(db);
  const getSteps = (routeId: string) =>
    db.query.routeSteps.findMany({
      where: and(eq(routeSteps.routeId, routeId), eq(routeSteps.isDeleted, false)),
      orderBy: [asc(routeSteps.position)],
    });
  const validate = async (storyId: string, steps: RouteStep[]) => {
    const [story, storyScenes, storyChoices] = await Promise.all([
      db.query.stories.findFirst({ where: eq(stories.id, storyId) }),
      db.query.scenes.findMany({
        where: and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
      }),
      db.query.choices.findMany({
        where: and(eq(choices.storyId, storyId), eq(choices.isDeleted, false)),
      }),
    ]);
    if (!story || story.isDeleted || story.type !== 'branching')
      throw new Error('Routes are only available for branching stories.');
    const issues = validateRouteSteps(
      steps,
      storyScenes.map((scene) => scene.id),
      storyChoices,
    );
    if (issues.length) throw new Error(`Invalid route: ${issues.join(', ')}.`);
  };
  return {
    getById: (routeId: string) =>
      db.query.routes.findFirst({
        where: and(eq(routes.id, routeId), eq(routes.isDeleted, false)),
      }),
    getAllByStoryId: (storyId: string) =>
      db.query.routes.findMany({
        where: and(eq(routes.storyId, storyId), eq(routes.isDeleted, false)),
        orderBy: [asc(routes.name)],
      }),
    getSteps,
    async save(userId: string, value: SaveRoute): Promise<Route> {
      await assertStoryIsWritable(db, value.storyId);
      const story = await db.query.stories.findFirst({ where: eq(stories.id, value.storyId) });
      if (!story || story.isDeleted || story.type !== 'branching') {
        throw new Error('Routes are only available for branching stories.');
      }
      const now = new Date();
      if (!value.id) {
        const row: RouteInsert = {
          id: createULID(),
          storyId: value.storyId,
          name: value.name.trim(),
          details: value.details,
          createdAt: now,
          updatedAt: now,
          version: 1,
          isDeleted: false,
          deletedAt: null,
        };
        const [created] = await db.insert(routes).values(row).returning();
        const logUser = await getUserIdForOperation(db, server, row.storyId, userId);
        await recordLocalOperation(db, row.storyId, logUser, 'create', 'Route', row.id, row);
        entityEventEmitter.emit('route_changed', row.storyId, row.id);
        return created!;
      }
      const original = await db.query.routes.findFirst({ where: eq(routes.id, value.id) });
      if (!original || original.isDeleted) throw new Error('Route not found.');
      const [updated] = await db
        .update(routes)
        .set({
          name: value.name.trim(),
          details: value.details,
          updatedAt: now,
          version: sql`${routes.version} + 1`,
        })
        .where(eq(routes.id, value.id))
        .returning();
      const logUser = await getUserIdForOperation(db, server, original.storyId, userId);
      await recordLocalOperation(
        db,
        original.storyId,
        logUser,
        'update',
        'Route',
        original.id,
        getChangedFields(original, updated!),
      );
      entityEventEmitter.emit('route_changed', original.storyId, original.id);
      return updated!;
    },
    async replaceSteps(
      userId: string,
      routeId: string,
      steps: Array<Pick<RouteStep, 'sceneId' | 'selectedChoiceId'>>,
    ) {
      const route = await db.query.routes.findFirst({ where: eq(routes.id, routeId) });
      if (!route || route.isDeleted) throw new Error('Route not found.');
      await assertStoryIsWritable(db, route.storyId);
      const rows: RouteStep[] = steps.map((step, index) => ({
        id: createULID(),
        storyId: route.storyId,
        routeId,
        position: index + 1,
        ...step,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
      }));
      await validate(route.storyId, rows);
      const old = await getSteps(routeId);
      const logUser = await getUserIdForOperation(db, server, route.storyId, userId);
      for (const step of old) {
        await db
          .update(routeSteps)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${routeSteps.version} + 1`,
          })
          .where(eq(routeSteps.id, step.id));
        await recordLocalOperation(db, route.storyId, logUser, 'delete', 'RouteStep', step.id, {
          id: step.id,
          isDeleted: true,
          version: step.version + 1,
        });
      }
      for (const row of rows as RouteStepInsert[]) {
        await db.insert(routeSteps).values(row);
        await recordLocalOperation(db, route.storyId, logUser, 'create', 'RouteStep', row.id, row);
      }
      entityEventEmitter.emit('route_step_changed', route.storyId, routeId);
    },
    async delete(userId: string, routeId: string): Promise<void> {
      const route = await db.query.routes.findFirst({ where: eq(routes.id, routeId) });
      if (!route || route.isDeleted) return;
      await assertStoryIsWritable(db, route.storyId);
      const logUser = await getUserIdForOperation(db, server, route.storyId, userId);
      const now = new Date();
      const steps = await getSteps(routeId);
      for (const step of steps) {
        const [deletedStep] = await db
          .update(routeSteps)
          .set({
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
            version: sql`${routeSteps.version} + 1`,
          })
          .where(eq(routeSteps.id, step.id))
          .returning();
        if (deletedStep) {
          await recordLocalOperation(db, route.storyId, logUser, 'delete', 'RouteStep', step.id, {
            id: step.id,
            isDeleted: true,
            version: deletedStep.version,
          });
        }
      }
      const [deleted] = await db
        .update(routes)
        .set({
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
          version: sql`${routes.version} + 1`,
        })
        .where(eq(routes.id, routeId))
        .returning();
      if (deleted) {
        await recordLocalOperation(db, route.storyId, logUser, 'delete', 'Route', routeId, {
          id: routeId,
          isDeleted: true,
          version: deleted.version,
        });
        entityEventEmitter.emit('route_changed', route.storyId, routeId);
      }
    },
  };
};
