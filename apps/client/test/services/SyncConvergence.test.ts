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

import { contentOf, SyncHarness, type SyncDevice } from '../helpers/syncDevices';

/**
 * End-to-end convergence: two real devices and one reference server. Every scenario ends with
 * the same assertion - once the devices settle, each local row equals the server's row, fields
 * AND version. A version behind the server is not cosmetic: the next local edit would rest on
 * it and conflict with the device's own history.
 */

const X = '01J0000000000000000000CHRX';

let harness: SyncHarness;
let ana: SyncDevice;
let bia: SyncDevice;

async function expectConverged(entityId = X) {
  const server = contentOf(harness.server.row('Character', entityId));
  for (const device of harness.devices) {
    expect({ device: device.name, row: contentOf(await device.character(entityId)) }).toEqual({
      device: device.name,
      row: server,
    });
  }
}

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  harness = new SyncHarness();
  harness.install();
  harness.server.seed('Character', X, { name: 'Keres', title: 'Deusa', description: 'Origem' });
  ana = await harness.addDevice('ana');
  bia = await harness.addDevice('bia');
  await ana.sync();
  await bia.sync();
});

afterEach(async () => {
  await harness.dispose();
  jest.restoreAllMocks();
});

describe('baseline', () => {
  it('exchanges disjoint edits and converges', async () => {
    await ana.edit(X, { name: 'Ana' });
    await bia.edit(X, { description: 'Bia' });
    await harness.settle();

    await expectConverged();
    expect(harness.server.row('Character', X)).toMatchObject({ name: 'Ana', description: 'Bia' });
  });
});

describe('open conflicts and later remote operations', () => {
  it('keep-server takes the newest server value, not the snapshot taken when the conflict opened', async () => {
    await ana.edit(X, { name: 'Ana' });
    await bia.edit(X, { name: 'Bia 1' });
    await bia.sync();
    await ana.sync(); // pull-side conflict on `name`
    expect(await ana.pendingConflicts()).toHaveLength(1);

    await bia.edit(X, { name: 'Bia 2' });
    await bia.sync();
    await ana.sync(); // a later remote rename arrives while the conflict is open

    const [conflict] = await ana.pendingConflicts();
    await ana.conflicts.resolveKeepServer(conflict!.id);
    await harness.settle();

    await expectConverged();
    expect(harness.server.row('Character', X)?.name).toBe('Bia 2');
  });

  it('keep-local after a later remote operation still lands the local value everywhere', async () => {
    await ana.edit(X, { name: 'Ana' });
    await bia.edit(X, { name: 'Bia 1' });
    await bia.sync();
    await ana.sync();
    await bia.edit(X, { description: 'Bia desc' });
    await bia.sync();
    await ana.sync();

    const [conflict] = await ana.pendingConflicts();
    await ana.conflicts.resolveKeepLocal(conflict!.id);
    await harness.settle();

    await expectConverged();
    expect(harness.server.row('Character', X)).toMatchObject({
      name: 'Ana',
      description: 'Bia desc',
    });
  });

  it('keep-server does not strand the uncontested local edits of the same entity', async () => {
    await ana.edit(X, { name: 'Ana', description: 'Ana desc' });
    await bia.edit(X, { name: 'Bia' });
    await bia.sync();
    await ana.sync();

    const [conflict] = await ana.pendingConflicts();
    await ana.conflicts.resolveKeepServer(conflict!.id);
    await harness.settle();

    await expectConverged();
  });

  it('keep-server on a local delete brings the entity back, as the server still has it', async () => {
    await ana.remove(X);
    await bia.edit(X, { name: 'Bia' });
    await bia.sync();
    await ana.sync(); // edited_on_server

    const [conflict] = await ana.pendingConflicts();
    await ana.conflicts.resolveKeepServer(conflict!.id);
    await harness.settle();

    await expectConverged();
    expect((await ana.character(X))?.isDeleted).toBe(false);
  });

  it('dismissing a conflict leaves the device agreeing with the server', async () => {
    await ana.edit(X, { name: 'Ana', description: 'Ana desc' });
    await bia.edit(X, { name: 'Bia' });
    await bia.sync();
    await ana.sync();
    await bia.edit(X, { name: 'Bia 2' });
    await bia.sync();
    await ana.sync();

    const [conflict] = await ana.pendingConflicts();
    await ana.conflicts.dismissConflict(conflict!.id);
    await harness.settle();

    await expectConverged();
  });
});

describe('a pull lagging behind the push', () => {
  it('does not let an older remote edit overwrite a newer accepted local one', async () => {
    await bia.edit(X, { name: 'Bia' });
    await bia.sync();

    // Ana's pulls fail (reachable server, 500) while her pushes still go through.
    harness.failingPulls.add(ana);
    await ana.edit(X, { name: 'Ana' });
    await ana.sync(); // push-side version_conflict on `name`
    const [conflict] = await ana.pendingConflicts();
    expect(conflict).toBeDefined();
    await ana.conflicts.resolveKeepLocal(conflict!.id);
    await ana.sync(); // the rebased edit is accepted; the pull still fails

    harness.failingPulls.delete(ana);
    await harness.settle();

    await expectConverged();
    expect(harness.server.row('Character', X)?.name).toBe('Ana');
  });

  it('keeps the version in step after a silent merge made while the pull was failing', async () => {
    await bia.edit(X, { description: 'Bia' });
    await bia.sync();

    harness.failingPulls.add(ana);
    await ana.edit(X, { name: 'Ana' });
    await ana.sync(); // disjoint fields: silent merge + rebase, accepted in round two
    harness.failingPulls.delete(ana);
    await harness.settle();
    await expectConverged();

    // The next edit rests on the right base: no conflict against Ana's own history.
    await ana.edit(X, { name: 'Ana 2' });
    await harness.settle();
    expect(await ana.pendingConflicts()).toEqual([]);
    await expectConverged();
  });
});

describe('interrupted cycles', () => {
  it('does not re-apply a pulled operation as a conflict after the cycle is aborted before the cursor moved', async () => {
    await bia.edit(X, { name: 'Bia' });
    await bia.sync();

    // The pull is applied, then the cycle is aborted before the cursor is written.
    await ana.syncAbortingAfterPullApply();
    expect((await ana.character(X))?.name).toBe('Bia');

    // Ana edits on top of what she saw; the next cycle must not dispute Bia's operation again.
    await ana.edit(X, { name: 'Ana' });
    await harness.settle();

    expect(await ana.pendingConflicts()).toEqual([]);
    await expectConverged();
    expect(harness.server.row('Character', X)?.name).toBe('Ana');
  });
});

describe('local edits racing the push', () => {
  it('rebases an edit made while the push was in flight instead of conflicting with its own history', async () => {
    await bia.edit(X, { description: 'Bia' });
    await bia.sync();

    await ana.edit(X, { name: 'Ana 1' });
    let typed = false;
    harness.beforeRequest = async (device, kind) => {
      if (device === ana && kind === 'push' && !typed) {
        typed = true;
        await ana.edit(X, { name: 'Ana 2' }); // the user keeps typing during the request
      }
    };
    // Ana's pull fails so the push meets Bia's newer version (version_conflict, disjoint).
    harness.failingPulls.add(ana);
    await ana.sync();
    harness.failingPulls.delete(ana);
    harness.beforeRequest = null;

    expect((await ana.character(X))?.name).toBe('Ana 2');
    await harness.settle();

    expect(await ana.pendingConflicts()).toEqual([]);
    await expectConverged();
    expect(harness.server.row('Character', X)).toMatchObject({
      name: 'Ana 2',
      description: 'Bia',
    });
  });
});

describe('content created on another device', () => {
  it('arrives for every entity scoped to the story, not only the ones whose handler sets it', async () => {
    const chapterId = '01J0000000000000000CHAPTR1';
    const sceneId = '01J0000000000000000SC00001';
    harness.server.seed('Chapter', chapterId, { name: 'Um', index: 1, type: 'chapter' });
    await ana.sync();
    await bia.sync();

    // The pull never carries `storyId`; the Scene handler inserts `data` as it comes.
    await bia.scenes.createScene('server-user', {
      id: sceneId,
      storyId: '01J00000000000000000STORY0',
      chapterId,
      name: 'Nova cena',
    } as never);
    await harness.settle();

    expect(await ana.row('Scene', sceneId)).toMatchObject({ name: 'Nova cena', chapterId });
    expect(contentOf(await ana.row('Scene', sceneId), 'Scene')).toEqual(
      contentOf(harness.server.row('Scene', sceneId), 'Scene'),
    );
  });
});

describe('the same thing made twice offline', () => {
  const STORY = '01J00000000000000000STORY0';
  const ANA_TAG = '01J0000000000000000TAG0ANA';
  const BIA_TAG = '01J0000000000000000TAG0B1A';

  const makeTag = (device: SyncDevice, id: string, name: string, color: string | null = null) =>
    device.tags.createTag('server-user', {
      id,
      storyId: STORY,
      name,
      color,
      isFavorite: false,
      extraNotes: null,
    } as never);

  const serverLive = (entityType: string) =>
    [...harness.server.rows.entries()]
      .filter(([key, row]) => key.startsWith(`${entityType}:`) && !row.isDeleted)
      .map(([, row]) => row);

  const localLive = async (device: SyncDevice, entityType: 'tags' | 'tagRelations') => {
    const { db } = device.database;
    const rows: { isDeleted: boolean }[] =
      entityType === 'tags'
        ? await db.query.tags.findMany()
        : await db.query.tagRelations.findMany();
    return rows.filter((row) => !row.isDeleted);
  };

  it('keeps one tag of a name, and the second device tags with the first one', async () => {
    await makeTag(ana, ANA_TAG, 'vilão');
    await ana.tagRelations.addTagToEntity('server-user', STORY, X, 'Character', ANA_TAG);
    await makeTag(bia, BIA_TAG, 'vilão');
    await bia.tagRelations.addTagToEntity('server-user', STORY, X, 'Character', BIA_TAG);

    await ana.sync();
    await harness.settle();

    expect(serverLive('Tag').map((row) => row.id)).toEqual([ANA_TAG]);
    expect(serverLive('TagRelation')).toEqual([
      expect.objectContaining({ tagId: ANA_TAG, relationId: X }),
    ]);
    for (const device of [ana, bia]) {
      expect(await device.row('Tag', BIA_TAG)).toBeUndefined();
      expect(await localLive(device, 'tags')).toEqual([expect.objectContaining({ id: ANA_TAG })]);
      expect(await localLive(device, 'tagRelations')).toEqual([
        expect.objectContaining({ tagId: ANA_TAG, relationId: X }),
      ]);
      expect(await device.pendingConflicts()).toEqual([]);
      expect(await device.unsyncedOperations()).toEqual([]);
    }
  });

  it('asks only where the two disagree: the twin, with this device values as mine', async () => {
    await makeTag(ana, ANA_TAG, 'vilão', 'red');
    await makeTag(bia, BIA_TAG, 'vilão', 'blue');

    await ana.sync();
    await harness.settle();

    const [conflict] = await bia.pendingConflicts();
    expect(conflict).toMatchObject({ entityType: 'Tag', entityId: ANA_TAG });
    expect(conflict!.localValues).toEqual({ color: 'blue' });

    await bia.conflicts.resolveKeepLocal(conflict!.id);
    await harness.settle();

    expect(harness.server.row('Tag', ANA_TAG)).toMatchObject({ name: 'vilão', color: 'blue' });
    for (const device of [ana, bia]) {
      expect(await device.row('Tag', ANA_TAG)).toMatchObject({
        color: 'blue',
        version: harness.server.row('Tag', ANA_TAG)!.version,
      });
    }
  });

  it('merges a tag renamed into a name another device just made, relations and all', async () => {
    const OLD = '01J0000000000000000TAG0DEF';
    harness.server.seed('Tag', OLD, { storyId: STORY, name: 'herói', isFavorite: false });
    harness.server.seed('TagRelation', '01J0000000000000000TRX0001', {
      storyId: STORY,
      tagId: OLD,
      relationId: X,
      relationType: 'Character',
    });
    await ana.sync();
    await bia.sync();

    await makeTag(ana, ANA_TAG, 'mentor');
    await bia.tags.updateTag('server-user', OLD, { name: 'mentor' } as never);
    await ana.sync();
    await harness.settle();

    expect(serverLive('Tag').map((row) => row.id)).toEqual([ANA_TAG]);
    expect(harness.server.row('Tag', OLD)).toMatchObject({ isDeleted: true });
    expect(serverLive('TagRelation')).toEqual([
      expect.objectContaining({ tagId: ANA_TAG, relationId: X }),
    ]);
    for (const device of [ana, bia]) {
      expect(await localLive(device, 'tags')).toEqual([expect.objectContaining({ id: ANA_TAG })]);
      expect(await localLive(device, 'tagRelations')).toEqual([
        expect.objectContaining({ tagId: ANA_TAG, relationId: X }),
      ]);
      expect(contentOf(await device.row('Tag', OLD), 'Tag')).toEqual(
        contentOf(harness.server.row('Tag', OLD), 'Tag'),
      );
      expect(await device.unsyncedOperations()).toEqual([]);
    }
  });

  it('returns a restored tag to the server tombstone when a live one took its name', async () => {
    const OLD = '01J0000000000000000TAG0DEF';
    harness.server.seed('Tag', OLD, { storyId: STORY, name: 'herói', isFavorite: false });
    await ana.sync();
    await bia.sync();

    await ana.tags.deleteTag('server-user', OLD);
    await makeTag(ana, ANA_TAG, 'herói');
    await ana.sync();
    await bia.tags.updateTag('server-user', OLD, { color: 'red' } as never);
    await bia.sync();
    const [deleted] = await bia.pendingConflicts();
    expect(deleted).toMatchObject({ entityId: OLD, reason: 'deleted_on_server' });

    await bia.conflicts.resolveKeepLocal(deleted!.id);
    await harness.settle();

    // The restore folds into the live twin: the old tag stays deleted, exactly as the server has it.
    expect(harness.server.row('Tag', OLD)).toMatchObject({ isDeleted: true });
    for (const device of [ana, bia]) {
      expect(contentOf(await device.row('Tag', OLD), 'Tag')).toEqual(
        contentOf(harness.server.row('Tag', OLD), 'Tag'),
      );
      expect(await localLive(device, 'tags')).toEqual([expect.objectContaining({ id: ANA_TAG })]);
      expect(await device.unsyncedOperations()).toEqual([]);
    }
    // Only where the two differ does bia get asked: the colour, on the twin.
    const [differs] = await bia.pendingConflicts();
    expect(differs).toMatchObject({ entityId: ANA_TAG, localValues: { color: 'red' } });
  });

  it('still deletes a tag renamed into a taken name and then deleted, before either was sent', async () => {
    const OLD = '01J0000000000000000TAG0DEF';
    harness.server.seed('Tag', OLD, { storyId: STORY, name: 'herói', isFavorite: false });
    await ana.sync();
    await bia.sync();

    await makeTag(ana, ANA_TAG, 'mentor');
    await ana.sync();
    await bia.tags.updateTag('server-user', OLD, { name: 'mentor' } as never);
    await bia.tags.deleteTag('server-user', OLD);
    await harness.settle();

    expect(harness.server.row('Tag', OLD)).toMatchObject({ isDeleted: true, name: 'herói' });
    for (const device of [ana, bia]) {
      expect(contentOf(await device.row('Tag', OLD), 'Tag')).toEqual(
        contentOf(harness.server.row('Tag', OLD), 'Tag'),
      );
      expect(await device.pendingConflicts()).toEqual([]);
      expect(await device.unsyncedOperations()).toEqual([]);
    }
  });
});

describe('one route, two new paths', () => {
  const STORY = '01J00000000000000000STORY0';
  const ROUTE = '01J0000000000000000RTE00001';
  const CHAPTER = '01J0000000000000000CHAPTR1';
  const [S1, S2, S3] = [
    '01J0000000000000000SC00001',
    '01J0000000000000000SC00002',
    '01J0000000000000000SC00003',
  ];
  const CHOICE = '01J0000000000000000CH000012';

  const serverPath = () =>
    [...harness.server.rows.entries()]
      .filter(
        ([key, row]) => key.startsWith('RouteStep:') && !row.isDeleted && row.routeId === ROUTE,
      )
      .map(([, row]) => row)
      .sort((left, right) => Number(left.position) - Number(right.position))
      .map((row) => row.sceneId);
  const localPath = async (device: SyncDevice) =>
    (await device.database.db.query.routeSteps.findMany())
      .filter((row) => !row.isDeleted && row.routeId === ROUTE)
      .sort((left, right) => left.position - right.position)
      .map((row) => row.sceneId);

  beforeEach(async () => {
    await harness.dispose();
    harness = new SyncHarness(undefined, 'branching');
    harness.install();
    harness.server.seed('Chapter', CHAPTER, {
      storyId: STORY,
      name: 'Um',
      index: 1,
      type: 'chapter',
    });
    for (const [position, id] of [S1, S2, S3].entries()) {
      harness.server.seed('Scene', id, {
        storyId: STORY,
        chapterId: CHAPTER,
        name: `S${position + 1}`,
        index: position + 1,
      });
    }
    harness.server.seed('Choice', CHOICE, {
      storyId: STORY,
      sceneId: S1,
      nextSceneId: S2,
      text: 'Seguir',
    });
    harness.server.seed('Route', ROUTE, { storyId: STORY, name: 'Fuga', details: null });
    ana = await harness.addDevice('ana');
    bia = await harness.addDevice('bia');
    await ana.sync();
    await bia.sync();
  });

  it('keeps one whole path and asks about the other, never mixing them', async () => {
    await ana.routes.replaceSteps('server-user', ROUTE, [{ sceneId: S3, selectedChoiceId: null }]);
    await bia.routes.replaceSteps('server-user', ROUTE, [
      { sceneId: S1, selectedChoiceId: CHOICE },
      { sceneId: S2, selectedChoiceId: null },
    ]);
    await ana.sync();
    await harness.settle();

    // Ana's path stands whole: none of Bia's steps stayed behind it.
    expect(serverPath()).toEqual([S3]);
    for (const device of [ana, bia]) expect(await localPath(device)).toEqual([S3]);
    const [decision] = await bia.pendingConflicts();
    expect(decision).toMatchObject({ entityType: 'Route', entityId: ROUTE });
    expect(decision!.localValues.steps).toEqual([
      { sceneId: S1, selectedChoiceId: CHOICE },
      { sceneId: S2, selectedChoiceId: null },
    ]);

    await bia.conflicts.resolveKeepLocal(decision!.id);
    await harness.settle();

    expect(serverPath()).toEqual([S1, S2]);
    for (const device of [ana, bia]) {
      expect(await localPath(device)).toEqual([S1, S2]);
      expect(await device.pendingConflicts()).toEqual([]);
      expect(await device.unsyncedOperations()).toEqual([]);
    }
  });
});
