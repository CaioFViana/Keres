/**
 * @jest-environment node
 */
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ showNotification: jest.fn() }) },
}));
jest.mock('../../src/services/MediaSyncService', () => ({
  createMediaSyncService: () => ({
    syncStoryMedia: async () => ({ uploaded: 0, downloaded: 0, failed: 0, offline: false }),
  }),
}));

import { and, eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createCollaborationEdits } from '../helpers/syncFuzzCollaboration';
import { createNarrativeEdits } from '../helpers/syncFuzzNarrative';
import { createWorldEdits } from '../helpers/syncFuzzWorld';
import {
  ApiSyncBackend,
  contentOf,
  MODELLED_ENTITY_TYPES,
  type SeedRow,
  STORY_ID,
  SyncHarness,
  type SyncDevice,
  USER_ID,
} from '../helpers/syncDevices';

/**
 * Randomized convergence: several devices edit, delete and create characters; create, rename,
 * delete, reorder and move scenes across two chapters; reorder and rename the chapters; create,
 * rename, delete and reorder stats; hand a linear story's start scene around; and make the things
 * two devices easily make twice offline - tags of the same few names, the same tag on the same
 * character, one character's value for a custom field, a relation between the same two
 * characters; collaborate around the story - favourites, comments, chapter anchors and, in a
 * branching story (every other seed), routes whose path is replaced whole; and edit every other
 * kind of row the story syncs (`syncFuzzWorld.ts`, `syncFuzzNarrative.ts`) - while syncing in
 * random interleavings: pulls failing
 * while pushes go through, push answers lost after the server applied them, the user typing while
 * a push is in flight, devices dropping offline, the server compacting its history, and every
 * conflict resolved by a random choice. Whatever happens, once the devices stop editing, resolve
 * what is left and sync, every device must hold exactly the server's rows - fields, ranks, derived
 * positions and versions - and no live row the server does not have. Seeds are fixed so a failure is reproducible: rerun the reported seed
 * alone.
 */

// A deeper run: SYNC_FUZZ_SEEDS=400 SYNC_FUZZ_STEPS=60 (and SYNC_FUZZ_FIRST_SEED to shift the
// window); SYNC_FUZZ_DEVICES sets how many devices share the story (3 by default, up to 6).
const FIRST_SEED = Number(process.env.SYNC_FUZZ_FIRST_SEED ?? 1);
const SEEDS = Array.from(
  { length: Number(process.env.SYNC_FUZZ_SEEDS ?? 24) },
  (_, index) => FIRST_SEED + index,
);
const STEPS = Number(process.env.SYNC_FUZZ_STEPS ?? 40);
const DEVICE_NAMES = ['ana', 'bia', 'caio', 'duda', 'edu', 'fabi'].slice(
  0,
  Number(process.env.SYNC_FUZZ_DEVICES ?? 3),
);
// SYNC_FUZZ_TRACE=1 appends every device's op log and the server's to a failure.
const TRACE = process.env.SYNC_FUZZ_TRACE === '1';
// SYNC_FUZZ_SHOW=1 prints every seed's history, passing or not - to see what a run exercised.
const SHOW = process.env.SYNC_FUZZ_SHOW === '1';
// SYNC_FUZZ_API=<origin> syncs with the real API instead of the reference model: see
// `scripts/sync-fuzz-api.ts`, which starts it on the test database and sets this.
const API = process.env.SYNC_FUZZ_API;
const FIELDS = ['name', 'title', 'description'] as const;

/** mulberry32: small, fast, deterministic. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const idFor = (index: number) => `01J0000000000000000FUZZ${String(index).padStart(3, '0')}`;
const sceneIdFor = (index: number) => `01J0000000000000000SC${String(index).padStart(5, '0')}`;
const statIdFor = (index: number) => `01J0000000000000000ST${String(index).padStart(5, '0')}`;
const CHAPTER_IDS = ['01J0000000000000000CHAPTR1', '01J0000000000000000CHAPTR2'] as const;
const FIELD_ID = '01J00000000000000000FYD001';
const tagIdFor = (index: number) => `01J0000000000000000TAG${String(index).padStart(4, '0')}`;
const relationIdFor = (index: number) => `01J0000000000000000REX${String(index).padStart(4, '0')}`;
/** Few names, so two devices often make the same tag offline. */
const TAG_NAMES = ['vilão', 'herói', 'mentor'] as const;
const RELATION_TYPES = ['irmãos', 'rivais', 'mentor'] as const;

async function liveIds(device: SyncDevice): Promise<string[]> {
  const rows = await device.database.db.query.characters.findMany({
    columns: { id: true, isDeleted: true, storyId: true },
  });
  return rows.filter((row) => row.storyId === STORY_ID && !row.isDeleted).map((row) => row.id);
}

async function liveChapters(device: SyncDevice) {
  return device.database.db.query.chapters.findMany({
    where: and(eq(schema.chapters.storyId, STORY_ID), eq(schema.chapters.isDeleted, false)),
  });
}

async function liveStats(device: SyncDevice) {
  return device.database.db.query.stats.findMany({
    where: and(eq(schema.stats.storyId, STORY_ID), eq(schema.stats.isDeleted, false)),
  });
}

/**
 * Resolves every open conflict at random. `insisting` false is a user who gave up: keeping their
 * own values again would resend what the server keeps refusing (a link to something deleted).
 */
async function resolveEverything(
  device: SyncDevice,
  random: () => number,
  log: string[],
  insisting = true,
) {
  for (const conflict of await device.pendingConflicts()) {
    const pick = random();
    const choice = !insisting
      ? 'keep-server'
      : pick < 0.45
        ? 'keep-local'
        : pick < 0.9
          ? 'keep-server'
          : 'dismiss';
    log.push(
      `  ${device.name} ${choice} on ${conflict.entityId} (${conflict.reason}, ` +
        `local ${JSON.stringify(conflict.localValues)}, ` +
        `server v${conflict.serverVersion} ${JSON.stringify(conflict.serverValues)})`,
    );
    if (choice === 'keep-local') await device.conflicts.resolveKeepLocal(conflict.id);
    else if (choice === 'keep-server') await device.conflicts.resolveKeepServer(conflict.id);
    else await device.conflicts.dismissConflict(conflict.id);
  }
}

describe('randomized convergence', () => {
  let harness: SyncHarness;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await harness?.dispose();
    jest.restoreAllMocks();
  });

  it.each(SEEDS)('converges for seed %i', async (seed) => {
    const random = prng(seed);
    const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
    const shuffled = <T>(items: readonly T[]): T[] => {
      const order = [...items];
      for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [order[index], order[swap]] = [order[swap]!, order[index]!];
      }
      return order;
    };
    const storyType = seed % 2 === 0 ? 'branching' : 'linear';
    harness = new SyncHarness(API ? new ApiSyncBackend(API) : undefined, storyType);
    harness.install();
    const seeds: SeedRow[] = [];
    let nextId = 0;
    for (; nextId < 3; nextId += 1) {
      seeds.push({
        entityType: 'Character',
        id: idFor(nextId),
        fields: { name: `C${nextId}`, title: null },
      });
    }
    for (const [position, id] of CHAPTER_IDS.entries()) {
      seeds.push({
        entityType: 'Chapter',
        id,
        fields: { name: `Cap${position + 1}`, index: position + 1, type: 'chapter' },
      });
    }
    let nextScene = 0;
    for (; nextScene < 4; nextScene += 1) {
      const chapterId = nextScene < 3 ? CHAPTER_IDS[0] : CHAPTER_IDS[1];
      seeds.push({
        entityType: 'Scene',
        id: sceneIdFor(nextScene),
        fields: {
          name: `S${nextScene}`,
          index: nextScene < 3 ? nextScene + 1 : 1,
          chapterId,
          isStart: false,
        },
      });
    }
    let nextStat = 0;
    for (; nextStat < 3; nextStat += 1) {
      seeds.push({
        entityType: 'Stat',
        id: statIdFor(nextStat),
        fields: { name: `Stat${nextStat}`, order: nextStat, isPrimary: false },
      });
    }
    seeds.push({
      entityType: 'StorySchemaField',
      id: FIELD_ID,
      fields: {
        entityType: 'Character',
        name: 'Idade',
        key: 'idade',
        type: 'text',
        description: null,
        targetEntityType: null,
        isRequired: false,
        defaultValue: null,
        order: 0,
      },
    });
    await harness.prepare(seeds);
    const devices: SyncDevice[] = [];
    for (const name of DEVICE_NAMES) devices.push(await harness.addDevice(name));
    for (const device of devices) await device.sync();

    const log: string[] = [];
    let counter = 0;
    const short = (id: string) => id.slice(-2);

    const sceneEdit = async (device: SyncDevice) => {
      const chapterId = pick(CHAPTER_IDS);
      const live = await device.liveScenes(chapterId);
      const roll = random();
      if (live.length === 0 || roll < 0.15) {
        const id = sceneIdFor(nextScene++);
        log.push(`${device.name} creates scene ${id} in ${short(chapterId)}`);
        await device.scenes.createScene(USER_ID, {
          id,
          storyId: STORY_ID,
          chapterId,
          name: `scene-${counter++}`,
        } as never);
        return;
      }
      const scene = pick(live);
      if (roll < 0.27) {
        log.push(`${device.name} deletes scene ${scene.id}`);
        await device.scenes.deleteScene(USER_ID, scene.id);
        return;
      }
      if (roll < 0.37) {
        const target = CHAPTER_IDS.find((id) => id !== chapterId)!;
        log.push(`${device.name} moves scene ${scene.id} to ${short(target)}`);
        await device.scenes.updateScene(USER_ID, scene.id, { chapterId: target } as never);
        return;
      }
      if (roll < 0.67) {
        const order = shuffled(live.map((row) => row.id));
        log.push(
          `${device.name} reorders ${short(chapterId)} scenes ${order.map(short).join(',')}`,
        );
        await device.scenes.reorderScenes(
          USER_ID,
          STORY_ID,
          chapterId,
          order.map((id, index) => ({ id, newIndex: index + 1 })),
        );
        return;
      }
      const name = `${device.name}-scene-${counter++}`;
      log.push(`${device.name} renames scene ${scene.id}=${name}`);
      await device.scenes.updateScene(USER_ID, scene.id, { name } as never);
    };

    const structureEdit = async (device: SyncDevice) => {
      const roll = random();
      if (roll < 0.2) {
        const order = shuffled((await liveChapters(device)).map((row) => row.id));
        if (order.length === 0) return;
        log.push(`${device.name} reorders chapters ${order.map(short).join(',')}`);
        await device.chapters.reorderChapters(
          USER_ID,
          STORY_ID,
          order.map((id, index) => ({ id, newIndex: index + 1 })),
        );
        return;
      }
      if (roll < 0.35) {
        const chapterId = pick(CHAPTER_IDS);
        const name = `${device.name}-chapter-${counter++}`;
        log.push(`${device.name} renames chapter ${short(chapterId)}=${name}`);
        await device.chapters.updateChapter(USER_ID, chapterId, { name } as never);
        return;
      }
      const stats = await liveStats(device);
      if (stats.length === 0 || roll < 0.45) {
        const id = statIdFor(nextStat++);
        log.push(`${device.name} creates stat ${id}`);
        await device.stats.createStat(USER_ID, {
          id,
          storyId: STORY_ID,
          name: `stat-${counter++}`,
          isPrimary: false,
          order: stats.length,
        } as never);
        return;
      }
      const stat = pick(stats);
      if (roll < 0.55) {
        log.push(`${device.name} deletes stat ${stat.id}`);
        await device.stats.deleteStat(USER_ID, stat.id);
        return;
      }
      if (roll < 0.8) {
        const order = shuffled(stats.map((row) => row.id));
        log.push(`${device.name} reorders stats ${order.map(short).join(',')}`);
        await device.stats.reorderStats(
          USER_ID,
          STORY_ID,
          order.map((id, index) => ({ id, order: index })),
        );
        return;
      }
      const name = `${device.name}-stat-${counter++}`;
      log.push(`${device.name} renames stat ${stat.id}=${name}`);
      await device.stats.updateStat(USER_ID, stat.id, { name });
    };

    let nextTag = 0;
    let nextRelation = 0;
    /** The things two devices make twice: the server keeps one, the other folds into it. */
    const keyedEdit = async (device: SyncDevice) => {
      const db = device.database.db;
      const roll = random();
      const tags = (await db.query.tags.findMany()).filter((tag) => !tag.isDeleted);
      const characters = await liveIds(device);
      if (roll < 0.14 || tags.length === 0) {
        const name = pick(TAG_NAMES);
        // As the screen does: no second live tag of a name this device already has.
        if (tags.some((tag) => tag.name === name)) return;
        const id = tagIdFor(nextTag++);
        log.push(`${device.name} creates tag ${id}=${name}`);
        await device.tags.createTag(USER_ID, {
          id,
          storyId: STORY_ID,
          name,
          color: null,
          isFavorite: false,
          extraNotes: null,
        } as never);
        return;
      }
      if (roll < 0.2) {
        const tag = pick(tags);
        const name = pick(TAG_NAMES);
        if (tags.some((other) => other.name === name)) return;
        log.push(`${device.name} renames tag ${tag.id}=${name}`);
        await device.tags.updateTag(USER_ID, tag.id, { name } as never);
        return;
      }
      if (roll < 0.25) {
        const tag = pick(tags);
        log.push(`${device.name} deletes tag ${tag.id}`);
        await device.tags.deleteTag(USER_ID, tag.id);
        return;
      }
      if (roll < 0.42 && characters.length > 0) {
        const tag = pick(tags);
        const character = pick(characters);
        log.push(`${device.name} tags ${short(character)} with ${tag.id}`);
        await device.tagRelations.addTagToEntity(USER_ID, STORY_ID, character, 'Character', tag.id);
        return;
      }
      if (roll < 0.5) {
        const relations = (await db.query.tagRelations.findMany()).filter((row) => !row.isDeleted);
        if (relations.length === 0) return;
        const relation = pick(relations);
        log.push(`${device.name} untags ${short(relation.relationId)} of ${relation.tagId}`);
        await device.tagRelations.removeTagFromEntity(
          USER_ID,
          STORY_ID,
          relation.relationId,
          relation.relationType as never,
          relation.tagId,
        );
        return;
      }
      if (roll < 0.7 && characters.length > 0) {
        const character = pick(characters);
        const value = pick(['20', '31', '47', null] as const);
        log.push(`${device.name} sets ${short(character)}.idade=${value}`);
        await device.attributes.saveValuesForEntity(USER_ID, STORY_ID, 'Character', character, {
          [FIELD_ID]: value,
        });
        return;
      }
      if (roll < 0.9 && characters.length > 1) {
        const [first, second] = shuffled(characters);
        const relations = (await db.query.characterRelations.findMany()).filter(
          (row) =>
            !row.isDeleted &&
            ((row.character1Id === first && row.character2Id === second) ||
              (row.character1Id === second && row.character2Id === first)),
        );
        const existing = relations[0];
        if (existing && random() < 0.3) {
          log.push(`${device.name} deletes relation ${existing.id}`);
          await device.characterRelations.deleteCharacterRelation(USER_ID, existing.id);
          return;
        }
        const relationType = pick(RELATION_TYPES);
        const id = existing?.id ?? relationIdFor(nextRelation++);
        log.push(
          `${device.name} relates ${short(first!)}-${short(second!)} as ${relationType} (${id})`,
        );
        await device.characterRelations.saveCharacterRelation(USER_ID, {
          ...(existing ?? {
            storyId: STORY_ID,
            character1Id: first!,
            character2Id: second!,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isDeleted: false,
            deletedAt: null,
          }),
          id,
          relationType,
        });
        return;
      }
      const scenes = (await db.query.scenes.findMany()).filter((scene) => !scene.isDeleted);
      if (scenes.length === 0) return;
      const scene = pick(scenes);
      log.push(`${device.name} starts the story at ${scene.id}`);
      await device.scenes.updateScene(USER_ID, scene.id, { isStart: true } as never);
    };

    const fuzzContext = {
      random,
      pick,
      log,
      storyType,
      chapterIds: CHAPTER_IDS,
      next: () => counter++,
    } as const;
    const collaborationEdit = createCollaborationEdits(fuzzContext);
    const worldEdit = createWorldEdits(fuzzContext);
    const narrativeEdit = createNarrativeEdits(fuzzContext);
    // The things the links link: made once, on one device, and shared before anyone edits.
    await worldEdit.prime(devices[0]!);
    await narrativeEdit.prime(devices[0]!);
    for (const device of devices) await device.sync();
    await devices[0]!.sync();

    const localEdit = async (device: SyncDevice) => {
      const kind = random();
      if (kind < 0.2) {
        await sceneEdit(device);
        return;
      }
      if (kind < 0.3) {
        await structureEdit(device);
        return;
      }
      if (kind < 0.44) {
        await keyedEdit(device);
        return;
      }
      if (kind < 0.58) {
        await collaborationEdit(device);
        return;
      }
      if (kind < 0.74) {
        await worldEdit(device);
        return;
      }
      if (kind < 0.9) {
        await narrativeEdit(device);
        return;
      }
      const ids = await liveIds(device);
      const roll = random();
      if (ids.length === 0 || roll < 0.1) {
        const id = idFor(nextId++);
        log.push(`${device.name} creates ${id}`);
        await device.characters.createCharacter(USER_ID, {
          id,
          storyId: STORY_ID,
          name: `new-${counter++}`,
        } as never);
        return;
      }
      const id = pick(ids);
      if (roll < 0.2) {
        log.push(`${device.name} deletes ${id}`);
        await device.remove(id);
        return;
      }
      const field = pick(FIELDS);
      const value = `${device.name}-${field}-${counter++}`;
      log.push(`${device.name} sets ${id}.${field}=${value}`);
      await device.edit(id, { [field]: value });
    };

    try {
      for (let step = 0; step < STEPS; step += 1) {
        const device = pick(devices);
        const roll = random();
        if (roll < 0.45) {
          await localEdit(device);
        } else if (roll < 0.68) {
          log.push(`${device.name} syncs`);
          await device.sync();
        } else if (roll < 0.71) {
          const keep = Math.floor(random() * 3);
          log.push(`server compacts (keeping ${keep} per entity)`);
          await harness.backend.compact(keep);
        } else if (roll < 0.78) {
          log.push(`${device.name} syncs with a failing pull`);
          harness.failingPulls.add(device);
          await device.sync();
          harness.failingPulls.delete(device);
        } else if (roll < 0.83) {
          log.push(`${device.name} syncs losing the push answers`);
          harness.losingPushResponses.add(device);
          await device.sync();
          harness.losingPushResponses.delete(device);
        } else if (roll < 0.9) {
          log.push(`${device.name} syncs while typing`);
          let typed = false;
          harness.beforeRequest = async (requester, kind) => {
            if (requester === device && kind === 'push' && !typed) {
              typed = true;
              await localEdit(device);
            }
          };
          await device.sync();
          harness.beforeRequest = null;
        } else if (roll < 0.95) {
          log.push(`${device.name} resolves its conflicts`);
          await resolveEverything(device, random, log);
        } else {
          log.push(`${device.name} syncs offline`);
          harness.offline.add(device);
          await device.sync();
          harness.offline.delete(device);
        }
      }

      // Quiesce: nobody edits any more; conflicts get resolved and everyone syncs until still.
      log.push('-- quiesce --');
      for (let round = 0; round < 6; round += 1) {
        for (const device of devices) await resolveEverything(device, random, log, round < 3);
        await harness.settle();
        const open = await Promise.all(devices.map((device) => device.pendingConflicts()));
        const unsynced = await Promise.all(devices.map((device) => device.unsyncedOperations()));
        if (open.every((list) => list.length === 0) && unsynced.every((ops) => ops.length === 0)) {
          break;
        }
      }

      for (const device of devices) {
        expect({ device: device.name, conflicts: await device.pendingConflicts() }).toEqual({
          device: device.name,
          conflicts: [],
        });
        expect({ device: device.name, unsynced: await device.unsyncedOperations() }).toEqual({
          device: device.name,
          unsynced: [],
        });
      }
      /**
       * Every row of every device against the server's: content, rank, derived position and
       * version alike - every write rests on its row's version, so nothing may drift. And the
       * other way: a live row only a device holds is work the server never got.
       */
      const divergences = async () => {
        const diverged: string[] = [];
        const serverRows = await harness.backend.rows();
        for (const device of devices) {
          for (const entityType of MODELLED_ENTITY_TYPES) {
            for (const row of await device.rowsOf(entityType)) {
              if (!row.isDeleted && !serverRows.has(`${entityType}:${row.id}`)) {
                diverged.push(`${device.name} ${entityType}:${row.id} is live only there`);
              }
            }
          }
        }
        for (const [key, serverRow] of serverRows) {
          const [entityType, id] = key.split(':') as [string, string];
          const view = (row: Record<string, unknown> | null | undefined) =>
            contentOf(row, entityType);
          const expected = view(serverRow);
          for (const device of devices) {
            const actual = view(await device.row(entityType, id));
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              diverged.push(
                `${device.name} ${key}: ${JSON.stringify(actual)} != server ${JSON.stringify(expected)}`,
              );
            }
          }
        }
        return diverged;
      };
      expect(await divergences()).toEqual([]);

      // A write of every live arranged row from one device: nothing may conflict, and every row
      // still matches the server's afterwards.
      log.push('-- rewrite --');
      const healer = devices[0]!;
      for (const chapterId of CHAPTER_IDS) {
        for (const scene of await healer.liveScenes(chapterId)) {
          await healer.scenes.updateScene(USER_ID, scene.id, { name: `${scene.name}*` } as never);
        }
      }
      for (const chapter of await liveChapters(healer)) {
        await healer.chapters.updateChapter(USER_ID, chapter.id, {
          name: `${chapter.name}*`,
        } as never);
      }
      for (const stat of await liveStats(healer)) {
        await healer.stats.updateStat(USER_ID, stat.id, { name: `${stat.name}*` });
      }
      await harness.settle();
      for (const device of devices) {
        expect({ device: device.name, conflicts: await device.pendingConflicts() }).toEqual({
          device: device.name,
          conflicts: [],
        });
      }
      expect(await divergences()).toEqual([]);
      if (SHOW) process.stdout.write(`Seed ${seed} history:\n  ${log.join('\n  ')}\n`);
    } catch (error) {
      if (TRACE) {
        for (const device of devices) {
          const ops = await device.database.db.query.operationLogs.findMany();
          log.push(
            `${device.name} op log: ${JSON.stringify(
              ops
                .filter((op) => op.entityType !== 'Character')
                .map((op) => [
                  op.operationVersion,
                  op.operationType,
                  `${op.entityType}:${short(op.entityId)}`,
                  op.payload,
                  op.isSynced,
                  op.serverOperationVersion,
                  op.conflictState,
                ]),
            )}`,
          );
        }
        log.push(
          `server log: ${JSON.stringify(
            (await harness.backend.log()).filter(([, , entity]) => !entity.startsWith('Character')),
          )}`,
        );
      }
      (error as Error).message += `\n\nSeed ${seed} history:\n  ${log.join('\n  ')}`;
      throw error;
    }
  });
});
