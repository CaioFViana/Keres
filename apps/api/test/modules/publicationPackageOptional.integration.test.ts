import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { chapters, scenes, showcaseSettings, storyPublications } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

// Packaging a publication writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

let ana: TestUser;

async function publish(storyId: string, extra: Record<string, unknown> = {}) {
  const stored = await db.query.stories.findFirst({
    where: (stories, { eq: equals }) => equals(stories.id, storyId),
  });
  return request('POST', `/stories/${storyId}/publications`, {
    token: ana.token,
    body: { operationVersion: stored!.lastOperationVersion, labelMode: 'both', ...extra },
  });
}

async function storedFiles(storyId: string): Promise<string[]> {
  try {
    return (
      await readdir(path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId))
    ).sort();
  } catch {
    return [];
  }
}

async function seededStory(): Promise<string> {
  const story = await uploadTestStory(ana.token);
  const chapterId = newId();
  await db.insert(chapters).values({ id: chapterId, storyId: story.id, name: 'One', index: 1 });
  await db.insert(scenes).values({
    id: newId(),
    storyId: story.id,
    chapterId,
    name: 'Filed',
    index: 1,
    body: 'Filed body.',
  });
  return story.id;
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: true })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: true } });
});

describe('publishing without the story package', () => {
  it('publishes the online reader alone: no .zip is made or stored, and the row says so', async () => {
    const storyId = await seededStory();

    const { status, data } = await publish(storyId, { includePackage: false, reader: {} });

    expect(status).toBe(200);
    expect(data).toMatchObject({ packageIncluded: false, byteSize: 0, mediaIncluded: 0 });
    expect(data.readerByteSize).toBeGreaterThan(0);
    const files = await storedFiles(storyId);
    expect(files.some((file) => file.endsWith('.zip'))).toBe(false);
    expect(files.some((file) => file.endsWith('.reader.html'))).toBe(true);
  });

  it('publishes a manuscript alone', async () => {
    const storyId = await seededStory();

    const { status, data } = await publish(storyId, {
      includePackage: false,
      manuscript: { format: 'md' },
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ packageIncluded: false, manuscriptFormat: 'md' });
    expect((await storedFiles(storyId)).some((file) => file.endsWith('.zip'))).toBe(false);
  });

  it('refuses a version with nothing in it, and writes nothing', async () => {
    const storyId = await seededStory();

    const refused = await publish(storyId, { includePackage: false });

    expect(refused.status).toBe(400);
    expect(refused.data.message).toMatch(/at least one/);
    expect(await storedFiles(storyId)).toEqual([]);
    expect(
      await db.select().from(storyPublications).where(eq(storyPublications.storyId, storyId)),
    ).toHaveLength(0);
  });

  it('still includes the package unless told otherwise', async () => {
    const storyId = await seededStory();

    const { data } = await publish(storyId);

    expect(data.packageIncluded).toBe(true);
    expect(data.byteSize).toBeGreaterThan(0);
    expect((await storedFiles(storyId)).some((file) => file.endsWith('.zip'))).toBe(true);
  });

  it('tells the site which versions carry a package, and refuses to serve one that has none', async () => {
    const storyId = await seededStory();
    const { data: full } = await publish(storyId);
    const { data: bare } = await publish(storyId, { includePackage: false, reader: {} });

    const detail = await request('GET', `/public/stories/${storyId}`);
    const byId = new Map(
      detail.data.versions.map((version: { id: string; packageIncluded: boolean }) => [
        version.id,
        version.packageIncluded,
      ]),
    );
    expect(byId.get(full.id)).toBe(true);
    expect(byId.get(bare.id)).toBe(false);

    const base = `/public/stories/${storyId}/publications`;
    expect((await request('POST', `${base}/${full.id}/download-url`)).status).toBe(200);
    expect((await request('POST', `${base}/${bare.id}/download-url`)).status).toBe(404);
    expect((await request('GET', `${base}/${bare.id}/download`)).status).toBe(404);
  });

  it('deletes such a version like any other, its reader with it', async () => {
    const storyId = await seededStory();
    const { data } = await publish(storyId, { includePackage: false, reader: {} });

    const removed = await request('DELETE', `/stories/${storyId}/publications/${data.id}`, {
      token: ana.token,
    });

    expect(removed.status).toBe(200);
    expect(await storedFiles(storyId)).toEqual([]);
  });

  it('lists the flag to the owner too', async () => {
    const storyId = await seededStory();
    await publish(storyId, { includePackage: false, reader: {} });

    const list = await request('GET', '/stories/publications/mine', { token: ana.token });

    expect(list.status).toBe(200);
    expect(list.data[0]).toMatchObject({ packageIncluded: false });
    expect(list.data[0].readerByteSize).toBeGreaterThan(0);
  });
});
