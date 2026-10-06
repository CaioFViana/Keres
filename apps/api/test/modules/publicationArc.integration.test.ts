import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  chapters,
  scenes,
  showcaseSettings,
  stories,
  storyArcs,
  storyPublications,
  tiers,
  users,
} from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { MAX_PUBLICATIONS_PER_STORY } from '../../src/services/StoryPublicationService';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

// Packaging a publication writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

let ana: TestUser;

async function serverOperationVersion(storyId: string): Promise<number> {
  const story = await db.query.stories.findFirst({
    where: (stories, { eq: equals }) => equals(stories.id, storyId),
  });
  return story!.lastOperationVersion;
}

async function publish(token: string, storyId: string, extra: Record<string, unknown> = {}) {
  return request('POST', `/stories/${storyId}/publications`, {
    token,
    body: {
      operationVersion: await serverOperationVersion(storyId),
      labelMode: 'both',
      ...extra,
    },
  });
}

/** Two works, a chapter and a scene in each, and one scene filed in no chapter at all. */
async function seedTwoWorks(storyId: string) {
  const bookOne = newId();
  const bookTwo = newId();
  await db.insert(storyArcs).values([
    {
      id: bookOne,
      storyId,
      title: 'Book One',
      sortOrder: 0,
      isDefault: true,
      medium: 'comic',
      author: 'Ana Illustrator',
    },
    { id: bookTwo, storyId, title: 'Book Two', sortOrder: 1 },
  ]);
  const chapterOne = newId();
  const chapterTwo = newId();
  await db.insert(chapters).values([
    { id: chapterOne, storyId, name: 'One', index: 1, arcId: bookOne },
    { id: chapterTwo, storyId, name: 'Two', index: 2, arcId: bookTwo },
  ]);
  await db.insert(scenes).values([
    {
      id: newId(),
      storyId,
      chapterId: chapterOne,
      name: 'First',
      index: 1,
      body: 'BODY-OF-BOOK-ONE',
    },
    {
      id: newId(),
      storyId,
      chapterId: chapterTwo,
      name: 'Second',
      index: 1,
      body: 'BODY-OF-BOOK-TWO',
    },
    { id: newId(), storyId, chapterId: null, name: 'Loose', index: 2, body: 'BODY-LOOSE' },
  ]);
  return { bookOne, bookTwo };
}

async function storedFiles(storyId: string): Promise<string[]> {
  const directory = path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId);
  try {
    return (await readdir(directory)).sort();
  } catch {
    return [];
  }
}

async function manuscriptOf(storyId: string, publicationId: string): Promise<string> {
  const files = await storedFiles(storyId);
  const file = files.find(
    (name) => name.startsWith(publicationId) && name.includes('.manuscript.'),
  );
  if (!file) throw new Error('Expected a stored manuscript for the release.');
  return readFile(
    path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId, file),
    'utf8',
  );
}

/** The `dc:creator` of a stored EPUB: where the book's author is written. */
async function creditOf(storyId: string, publicationId: string): Promise<string | null> {
  const files = await storedFiles(storyId);
  const file = files.find((name) => name.startsWith(publicationId) && name.endsWith('.epub'));
  if (!file) throw new Error('Expected a stored EPUB for the release.');
  const archive = await JSZip.loadAsync(
    await readFile(path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId, file)),
  );
  const opf = Object.keys(archive.files).find((name) => name.endsWith('.opf'));
  const xml = opf ? await archive.files[opf].async('string') : '';
  return xml.match(/<dc:creator>([^<]*)<\/dc:creator>/)?.[1] ?? null;
}

async function seedTier(maxPublishedArcs: number | null, assignTo: string) {
  const id = newId();
  await db.insert(tiers).values({
    id,
    name: `Tier ${id}`,
    isDefault: false,
    maxStories: null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
    maxPublicationsPerDay: null,
    maxPublishedArcs,
  } as never);
  await db.update(users).set({ tierId: id }).where(eq(users.id, assignTo));
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: true })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: true } });
});

describe('releasing one work (arc)', () => {
  it('publishes the manuscript of that work only, with no package and none of the others', async () => {
    const story = await uploadTestStory(ana.token);
    const { bookOne } = await seedTwoWorks(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'md' },
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ arcId: bookOne, packageIncluded: false, byteSize: 0 });
    const text = await manuscriptOf(story.id, data.id);
    expect(text).toContain('BODY-OF-BOOK-ONE');
    expect(text).not.toContain('BODY-OF-BOOK-TWO');
    // Scenes filed in no chapter belong to no work: they are out unless the publisher asks.
    expect(text).not.toContain('BODY-LOOSE');
    // No package was written beside it.
    expect((await storedFiles(story.id)).some((name) => name.endsWith('.zip'))).toBe(false);
  });

  it('forces the manuscript and the reader onto the released work', async () => {
    const story = await uploadTestStory(ana.token);
    const { bookOne, bookTwo } = await seedTwoWorks(story.id);

    const mismatch = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'md', arcId: bookTwo },
    });
    expect(mismatch.status).toBe(400);

    const sameArc = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'md', arcId: bookOne },
    });
    expect(sameArc.status).toBe(200);
  });

  it('refuses the package, an empty release and a work the story does not have', async () => {
    const story = await uploadTestStory(ana.token);
    const { bookOne } = await seedTwoWorks(story.id);

    const withPackage = await publish(ana.token, story.id, {
      arcId: bookOne,
      includePackage: true,
      manuscript: { format: 'md' },
    });
    expect(withPackage.status).toBe(400);
    expect(withPackage.data.message).toMatch(/never the story package/);

    const empty = await publish(ana.token, story.id, { arcId: bookOne });
    expect(empty.status).toBe(400);

    const stranger = await publish(ana.token, story.id, {
      arcId: newId(),
      manuscript: { format: 'md' },
    });
    expect(stranger.status).toBe(400);
    expect(await db.select().from(storyPublications)).toHaveLength(0);
  });

  it("credits the work's own author, then the story's, then the owner's handle", async () => {
    const story = await uploadTestStory(ana.token);
    const { bookOne, bookTwo } = await seedTwoWorks(story.id);

    const own = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'epub' },
    });
    expect(await creditOf(story.id, own.data.id)).toBe('Ana Illustrator');

    // Book Two has no author of its own, and neither has the story: the owner's handle is used.
    const handle = await publish(ana.token, story.id, {
      arcId: bookTwo,
      manuscript: { format: 'epub' },
    });
    expect(await creditOf(story.id, handle.data.id)).toBe('@ana');

    // With the story's author named, that one comes before the handle.
    await db.update(stories).set({ author: 'The Studio' }).where(eq(stories.id, story.id));
    const studio = await publish(ana.token, story.id, {
      arcId: bookTwo,
      manuscript: { format: 'epub' },
    });
    expect(await creditOf(story.id, studio.data.id)).toBe('The Studio');
  });

  it('keeps five versions of each work and five of the universe, separately', async () => {
    const story = await uploadTestStory(ana.token);
    const { bookOne } = await seedTwoWorks(story.id);

    const universe = await publish(ana.token, story.id);
    expect(universe.status).toBe(200);
    for (let release = 0; release < MAX_PUBLICATIONS_PER_STORY + 1; release += 1) {
      const result = await publish(ana.token, story.id, {
        arcId: bookOne,
        manuscript: { format: 'md' },
      });
      expect(result.status).toBe(200);
    }

    const rows = await db.select().from(storyPublications);
    expect(rows.filter((row) => row.arcId === bookOne)).toHaveLength(MAX_PUBLICATIONS_PER_STORY);
    // The universe's one version was not pushed out by the work's releases.
    expect(rows.filter((row) => row.arcId === null)).toHaveLength(1);
  });

  it('names the work on the version the public page lists', async () => {
    const story = await uploadTestStory(ana.token);
    const { bookOne } = await seedTwoWorks(story.id);
    await publish(ana.token, story.id);
    await publish(ana.token, story.id, { arcId: bookOne, manuscript: { format: 'md' } });

    const page = await request('GET', `/public/stories/${story.id}`);
    expect(page.status).toBe(200);
    const versions = page.data.versions as { arc: { id: string; title: string } | null }[];
    expect(versions).toHaveLength(2);
    expect(versions.find((version) => version.arc)?.arc).toMatchObject({
      id: bookOne,
      title: 'Book One',
      medium: 'comic',
    });
    expect(versions.find((version) => !version.arc)).toBeTruthy();
  });
});

describe('works on show (tier)', () => {
  it('lets a plan show as many works as it names and refuses the next with a 429', async () => {
    await seedTier(1, ana.userId);
    const story = await uploadTestStory(ana.token);
    const { bookOne, bookTwo } = await seedTwoWorks(story.id);

    const first = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'md' },
    });
    // A second version of a work already on show takes no new slot.
    const again = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'md' },
    });
    const second = await publish(ana.token, story.id, {
      arcId: bookTwo,
      manuscript: { format: 'md' },
    });

    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.data.message).toMatch(/Published works limit reached/);
  });

  it('gives the slot back when the last version of a work is removed', async () => {
    await seedTier(1, ana.userId);
    const story = await uploadTestStory(ana.token);
    const { bookOne, bookTwo } = await seedTwoWorks(story.id);

    const first = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'md' },
    });
    const removed = await request('DELETE', `/stories/${story.id}/publications/${first.data.id}`, {
      token: ana.token,
    });
    expect(removed.status).toBeLessThan(300);

    const second = await publish(ana.token, story.id, {
      arcId: bookTwo,
      manuscript: { format: 'md' },
    });
    expect(second.status).toBe(200);
  });

  it('forbids releasing a single work at zero, without touching the universe', async () => {
    await seedTier(0, ana.userId);
    const story = await uploadTestStory(ana.token);
    const { bookOne } = await seedTwoWorks(story.id);

    const work = await publish(ana.token, story.id, {
      arcId: bookOne,
      manuscript: { format: 'md' },
    });
    const universe = await publish(ana.token, story.id);

    expect(work.status).toBe(429);
    expect(universe.status).toBe(200);
  });

  it('leaves a plan with no ceiling unlimited', async () => {
    await seedTier(null, ana.userId);
    const story = await uploadTestStory(ana.token);
    const { bookOne, bookTwo } = await seedTwoWorks(story.id);

    for (const arcId of [bookOne, bookTwo]) {
      const result = await publish(ana.token, story.id, { arcId, manuscript: { format: 'md' } });
      expect(result.status).toBe(200);
    }
  });
});
