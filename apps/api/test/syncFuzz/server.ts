/**
 * The real API, served over HTTP for the client's convergence fuzz (`SyncConvergenceFuzz.test.ts`
 * with `SYNC_FUZZ_API` set - see `scripts/sync-fuzz-api.ts`). The fuzz drives several real client
 * sync engines against it; it only needs a few test-only controls on top of the API, served under
 * `/__fuzz/` by this process and never by the application itself:
 *
 * - `POST /__fuzz/reset {storyId, type}` empties the database, registers a user and uploads an
 *   empty story of that id and type (linear by default) - answers `{ token, userId }`;
 * - `GET /__fuzz/rows?storyId=` the story row and its modelled entities (characters, chapters, scenes,
 *   stats, schema fields, attribute values, tags, relations, favorites, comments, anchors, routes,
 *   the world's things and links, choices with their checks and effects...), keyed `Type:id`,
 *   and the story's last operation version;
 * - `POST /__fuzz/compact {storyId, keep}` runs the history compaction with no age gate;
 * - `GET /__fuzz/log?storyId=` the story's operation log, for a failing seed's trace.
 *
 * Runs on the disposable test database (`docker-compose.test.yml`) - `../setup` points every
 * connection there before anything loads - and only ever under Bun: `bun test/syncFuzz/server.ts`.
 */
import '../setup';
import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { asc, eq, max } from 'drizzle-orm';
import { db } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import {
  attributeValues,
  boards,
  chapterAnchors,
  characterScenes,
  choiceCheckGroups,
  choiceChecks,
  choices,
  effects,
  galleries,
  galleryRelations,
  itemJourneys,
  items,
  locationMaps,
  locationRelations,
  locations,
  modes,
  noteRelations,
  notes,
  plotScenes,
  plots,
  seeAlsoRelations,
  statRelations,
  statStrengths,
  storyArcs,
  storyCalendars,
  suggestions,
  worldRules,
  chapters,
  characterRelations,
  characters,
  comments,
  favorites,
  operationLog,
  routeSteps,
  routes,
  scenes,
  stats,
  stories,
  storySchemaFields,
  tagRelations,
  tags,
} from '../../src/db/schema';
import { compactStoryUpdateHistory } from '../../src/services/sync/SyncHistoryCompaction';
import { getApp, registerUser, request } from '../helpers/app';
import { truncateAll } from '../helpers/database';

await runMigrations();
const app = await getApp();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function reset(storyId: string, type: 'linear' | 'branching') {
  await truncateAll();
  const user = await registerUser('fuzz');
  const now = new Date().toISOString();
  const row = { createdAt: now, updatedAt: now, version: 1, isDeleted: false, deletedAt: null };
  const packageData = {
    story: { id: storyId, userId: user.userId, title: 'Convergence', type, ...row },
    chapters: [],
    scenes: [],
    choices: [],
    characters: [],
    locations: [],
    worldRules: [],
    notes: [],
    noteRelations: [],
    tags: [],
    tagRelations: [],
    suggestions: [],
    characterRelations: [],
    characterScenes: [],
    galleryItems: [],
    itemJourneys: [],
    // No arcs: every arc the devices hold goes through sync, as on a story made on a device.
    storyArcs: [],
    serverLastOperationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
  };
  const upload = await request('POST', '/stories/import', {
    token: user.token,
    body: packageData,
    query: { storyId },
  });
  if (upload.status !== 200) {
    throw new Error(
      `Could not upload the fuzz story (${upload.status}): ${JSON.stringify(upload.data)}`,
    );
  }
  return { token: user.token, userId: user.userId };
}

async function rows(storyId: string) {
  const keyed: Record<string, Record<string, unknown>> = {};
  const add = (entityType: string, list: Record<string, unknown>[]) => {
    for (const entity of list) keyed[`${entityType}:${entity.id}`] = entity;
  };
  add('Character', await db.select().from(characters).where(eq(characters.storyId, storyId)));
  add('Chapter', await db.select().from(chapters).where(eq(chapters.storyId, storyId)));
  add('Scene', await db.select().from(scenes).where(eq(scenes.storyId, storyId)));
  add('Stat', await db.select().from(stats).where(eq(stats.storyId, storyId)));
  add('Story', await db.select().from(stories).where(eq(stories.id, storyId)));
  add(
    'StorySchemaField',
    await db.select().from(storySchemaFields).where(eq(storySchemaFields.storyId, storyId)),
  );
  add(
    'AttributeValue',
    await db.select().from(attributeValues).where(eq(attributeValues.storyId, storyId)),
  );
  add('Tag', await db.select().from(tags).where(eq(tags.storyId, storyId)));
  add('TagRelation', await db.select().from(tagRelations).where(eq(tagRelations.storyId, storyId)));
  add(
    'CharacterRelation',
    await db.select().from(characterRelations).where(eq(characterRelations.storyId, storyId)),
  );
  add('Favorite', await db.select().from(favorites).where(eq(favorites.storyId, storyId)));
  add('Comment', await db.select().from(comments).where(eq(comments.storyId, storyId)));
  add(
    'ChapterAnchor',
    await db.select().from(chapterAnchors).where(eq(chapterAnchors.storyId, storyId)),
  );
  add('Route', await db.select().from(routes).where(eq(routes.storyId, storyId)));
  add('RouteStep', await db.select().from(routeSteps).where(eq(routeSteps.storyId, storyId)));
  const byStory = {
    Location: locations,
    LocationRelation: locationRelations,
    LocationMap: locationMaps,
    Item: items,
    ItemJourney: itemJourneys,
    Note: notes,
    NoteRelation: noteRelations,
    WorldRule: worldRules,
    SeeAlsoRelation: seeAlsoRelations,
    Suggestion: suggestions,
    Board: boards,
    Plot: plots,
    PlotScene: plotScenes,
    StoryCalendar: storyCalendars,
    Gallery: galleries,
    GalleryRelation: galleryRelations,
    CharacterScene: characterScenes,
    Mode: modes,
    StatRelation: statRelations,
    StatStrength: statStrengths,
    Choice: choices,
    ChoiceCheckGroup: choiceCheckGroups,
    ChoiceCheck: choiceChecks,
    Effect: effects,
  } as const;
  for (const [entityType, table] of Object.entries(byStory)) {
    add(entityType, await db.select().from(table).where(eq(table.storyId, storyId)));
  }
  add('StoryArc', await db.select().from(storyArcs).where(eq(storyArcs.storyId, storyId)));
  const [last] = await db
    .select({ last: max(operationLog.operationVersion) })
    .from(operationLog)
    .where(eq(operationLog.storyId, storyId));
  return { rows: keyed, lastOperationVersion: Number(last?.last ?? 0) };
}

async function log(storyId: string) {
  return db
    .select({
      operationVersion: operationLog.operationVersion,
      operationType: operationLog.operationType,
      entityType: operationLog.entityType,
      entityId: operationLog.entityId,
      payload: operationLog.payload,
      entityVersion: operationLog.entityVersion,
    })
    .from(operationLog)
    .where(eq(operationLog.storyId, storyId))
    .orderBy(asc(operationLog.operationVersion));
}

async function control(url: URL, req: Request): Promise<Response> {
  const body = req.method === 'POST' ? ((await req.json()) as Record<string, any>) : {};
  const storyId = String(body.storyId ?? url.searchParams.get('storyId') ?? '');
  switch (url.pathname) {
    case '/__fuzz/reset':
      return json(await reset(storyId, body.type === 'branching' ? 'branching' : 'linear'));
    case '/__fuzz/rows':
      return json(await rows(storyId));
    case '/__fuzz/compact':
      // Every row counts as old: the fuzz decides when history is compacted, not the clock.
      return json(
        await compactStoryUpdateHistory(storyId, {
          olderThan: new Date(Date.now() + 24 * 60 * 60 * 1000),
          keepRecentPerEntity: Number(body.keep ?? 0),
        }),
      );
    case '/__fuzz/log':
      return json(await log(storyId));
    default:
      return json({ message: 'unknown control' }, 404);
  }
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.SYNC_FUZZ_PORT ?? 0),
  async fetch(req) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/__fuzz/')) return app.handle(req);
    try {
      return await control(url, req);
    } catch (error) {
      return json({ message: (error as Error).message }, 500);
    }
  },
});

console.log(`SYNC_FUZZ_READY http://127.0.0.1:${server.port}`);
