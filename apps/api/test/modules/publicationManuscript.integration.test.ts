import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  chapters,
  routes,
  routeSteps,
  scenes,
  showcaseSettings,
  storyPublications,
} from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

// Packaging a publication writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

async function storedPublicationFiles(storyId: string): Promise<string[]> {
  const directory = path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId);
  try {
    return (await readdir(directory)).sort();
  } catch {
    return [];
  }
}

let ana: TestUser;

async function enableShowcase(enabled = true): Promise<void> {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: enabled })
    .onConflictDoUpdate({
      target: showcaseSettings.id,
      set: { isShowcaseEnabled: enabled },
    });
}

async function serverOperationVersion(storyId: string): Promise<number> {
  const story = await db.query.stories.findFirst({
    where: (stories, { eq: equals }) => equals(stories.id, storyId),
  });
  return story!.lastOperationVersion;
}

async function publish(
  token: string,
  storyId: string,
  extra: Record<string, unknown> = {},
  labelMode = 'both',
) {
  return request('POST', `/stories/${storyId}/publications`, {
    token,
    body: { operationVersion: await serverOperationVersion(storyId), labelMode, ...extra },
  });
}

/** One filed scene plus one chapterless fragment, so loose-scene switches have an effect. */
async function seedLinearContent(storyId: string): Promise<void> {
  const chapterId = newId();
  await db.insert(chapters).values({ id: chapterId, storyId, name: 'One', index: 1 });
  await db.insert(scenes).values([
    { id: newId(), storyId, chapterId, name: 'Filed', index: 1, body: 'Filed body.' },
    { id: newId(), storyId, chapterId: null, name: 'Loose', index: 2, body: 'Loose body.' },
  ]);
}

async function seedBranchingContent(storyId: string): Promise<{ routeId: string }> {
  const firstSceneId = newId();
  const secondSceneId = newId();
  await db.insert(scenes).values([
    { id: firstSceneId, storyId, chapterId: null, name: 'Start', index: 1, body: 'Start body.' },
    { id: secondSceneId, storyId, chapterId: null, name: 'End', index: 2, body: 'End body.' },
  ]);
  const routeId = newId();
  await db.insert(routes).values({ id: routeId, storyId, name: 'Main' });
  await db.insert(routeSteps).values([
    { id: newId(), storyId, routeId, position: 1, sceneId: firstSceneId },
    { id: newId(), storyId, routeId, position: 2, sceneId: secondSceneId },
  ]);
  return { routeId };
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await enableShowcase();
});

describe('publishing with a manuscript', () => {
  it('publishes without a manuscript by default', async () => {
    const story = await uploadTestStory(ana.token);

    const { status, data } = await publish(ana.token, story.id);
    expect(status).toBe(200);
    expect(data.manuscriptFormat).toBeNull();
    expect(data.manuscriptByteSize).toBeNull();
    expect(await storedPublicationFiles(story.id)).toHaveLength(1);
  });

  it('publishes a linear manuscript with loose scenes by default', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md' },
    });
    expect(status).toBe(200);
    expect(data.manuscriptFormat).toBe('md');
    expect(data.manuscriptByteSize).toBeGreaterThan(0);

    const files = await storedPublicationFiles(story.id);
    expect(files).toHaveLength(2);
    expect(files.find((file) => file.includes('.manuscript.'))).toMatch(/\.manuscript\.md$/);

    const listed = await request('GET', `/stories/${story.id}/publications`, { token: ana.token });
    expect(listed.data.publications[0].manuscriptFormat).toBe('md');
    expect(listed.data.publications[0].manuscriptByteSize).toBe(data.manuscriptByteSize);
  });

  it('omits loose scenes from a linear manuscript when asked', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const withLoose = await publish(ana.token, story.id, {
      manuscript: { format: 'md' },
      labelMode: 'date',
    });
    const withoutLoose = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeLooseScenes: false },
      labelMode: 'date',
    });

    expect(withLoose.status).toBe(200);
    expect(withoutLoose.status).toBe(200);
    expect(withoutLoose.data.manuscriptByteSize).toBeLessThan(
      withLoose.data.manuscriptByteSize,
    );
  });

  it('publishes a branching manuscript along its route, ignoring includeLooseScenes', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    const { routeId } = await seedBranchingContent(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', routeId, includeLooseScenes: false },
    });

    expect(status).toBe(200);
    expect(data.manuscriptFormat).toBe('md');
    expect(data.manuscriptByteSize).toBeGreaterThan(0);
  });

  it('requires a routeId for a branching manuscript', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    await seedBranchingContent(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md' },
    });

    expect(status).toBe(400);
    expect(data.message).toMatch(/routeId/i);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('refuses a routeId on a linear story', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', routeId: newId() },
    });

    expect(status).toBe(400);
    expect(data.message).toMatch(/branching/i);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('refuses a route from another story', async () => {
    const first = await uploadTestStory(ana.token, 'First', 'branching');
    const { routeId } = await seedBranchingContent(first.id);
    const second = await uploadTestStory(ana.token, 'Second', 'branching');
    await seedBranchingContent(second.id);

    const { status, data } = await publish(ana.token, second.id, {
      manuscript: { format: 'md', routeId },
    });

    expect(status).toBe(400);
    expect(data.message).toMatch(/does not belong/i);
    expect(await storedPublicationFiles(second.id)).toEqual([]);
  });

  it('refuses an oversized manuscript and writes no package', async () => {
    const story = await uploadTestStory(ana.token);
    // 600 scenes at the per-scene body cap: ~18 MB of prose, past the 15 MB manuscript cap.
    const body = 'y'.repeat(30000);
    const rows = Array.from({ length: 600 }, (_, index) => ({
      id: newId(),
      storyId: story.id,
      chapterId: null,
      name: `Scene ${index + 1}`,
      index: index + 1,
      body,
    }));
    for (let at = 0; at < rows.length; at += 100) {
      await db.insert(scenes).values(rows.slice(at, at + 100));
    }

    const { status, data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md' },
    });

    expect(status).toBe(400);
    expect(data.message).toMatch(/exceed|limit/i);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
    const kept = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, story.id));
    expect(kept).toEqual([]);
  });
});

describe('manuscript blob lifetime', () => {
  it('prunes the manuscript blob along with its version', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const ids: string[] = [];
    for (let index = 0; index < 6; index++) {
      const published = await publish(
        ana.token,
        story.id,
        { manuscript: { format: 'txt' } },
        'date',
      );
      expect(published.status).toBe(200);
      ids.push(published.data.id);
    }

    const rows = await db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, story.id));
    expect(rows).toHaveLength(5);

    const files = await storedPublicationFiles(story.id);
    expect(files.filter((file) => file.endsWith('.zip'))).toHaveLength(5);
    const manuscripts = files.filter((file) => file.includes('.manuscript.'));
    expect(manuscripts).toHaveLength(5);
    // The pruned version is the oldest one, and neither of its blobs survived.
    expect(files.some((file) => file.startsWith(ids[0]))).toBe(false);
  });

  it('deletes the manuscript blob when a version is deleted', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);
    const only = await publish(ana.token, story.id, { manuscript: { format: 'md' } });
    expect(await storedPublicationFiles(story.id)).toHaveLength(2);

    const { status } = await request(
      'DELETE',
      `/stories/${story.id}/publications/${only.data.id}`,
      { token: ana.token },
    );
    expect(status).toBe(200);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('deletes manuscript blobs on unpublish', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);
    await publish(ana.token, story.id, { manuscript: { format: 'md' } }, 'date');
    await publish(ana.token, story.id, { manuscript: { format: 'md' } }, 'date');
    expect(await storedPublicationFiles(story.id)).toHaveLength(4);

    const { status } = await request('DELETE', `/stories/${story.id}/publications`, {
      token: ana.token,
    });
    expect(status).toBe(200);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });
});
