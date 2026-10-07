import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  chapters,
  choiceCheckGroups,
  choiceChecks,
  choices,
  effects,
  galleries,
  items,
  scenePages,
  sceneMusic,
  scenes,
  showcaseSettings,
  songs,
  storyArcs,
  storyPublications,
} from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { mediaStorageService } from '../../src/services/MediaStorageService';
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

async function storedManuscript(storyId: string): Promise<string> {
  const files = await storedPublicationFiles(storyId);
  const manuscript = files.find((file) => file.includes('.manuscript.'));
  if (!manuscript) throw new Error('Expected a stored manuscript file.');
  return readFile(
    path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId, manuscript),
    'utf8',
  );
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

/** Two flagged starts, each with one way on, and a scene nothing leads to. */
async function seedBranchingContent(storyId: string): Promise<void> {
  const firstSceneId = newId();
  const secondSceneId = newId();
  const thirdSceneId = newId();
  await db.insert(scenes).values([
    {
      id: firstSceneId,
      storyId,
      chapterId: null,
      name: 'Start',
      index: 1,
      body: 'Start body.',
      isStart: true,
    },
    { id: secondSceneId, storyId, chapterId: null, name: 'End', index: 2, body: 'End body.' },
    { id: thirdSceneId, storyId, chapterId: null, name: 'Attic', index: 3, body: 'Attic body.' },
  ]);
}

/** A choice from the first scene to the second, gated by an item the choice itself grants. */
async function seedChoiceAnnotations(storyId: string): Promise<void> {
  const [start, end] = await db.query.scenes.findMany({
    where: (sceneRows, { eq: equals }) => equals(sceneRows.storyId, storyId),
    orderBy: (sceneRows, { asc }) => [asc(sceneRows.index)],
  });
  const choiceId = newId();
  await db.insert(choices).values({
    id: choiceId,
    storyId,
    sceneId: start.id,
    nextSceneId: end.id,
    text: 'Go on',
  });
  const itemId = newId();
  await db.insert(items).values({ id: itemId, storyId, name: 'Brass Key' });
  const groupId = newId();
  await db
    .insert(choiceCheckGroups)
    .values({ id: groupId, storyId, choiceId, combinator: 'AND', order: 1 });
  await db.insert(choiceChecks).values({
    id: newId(),
    storyId,
    groupId,
    mode: 'enable',
    type: 'inventory',
    order: 1,
    itemId,
    itemPresence: 'has',
  });
  await db.insert(effects).values({
    id: newId(),
    storyId,
    entityType: 'Choice',
    entityId: choiceId,
    effectType: 'itemGrant',
    itemId,
  });
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

  it('publishes a linear manuscript', async () => {
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

  it('leaves loose scenes out by default, like the device export, and adds them when asked', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const withoutLoose = await publish(ana.token, story.id, {
      manuscript: { format: 'md' },
      labelMode: 'date',
    });
    const withLoose = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeLooseScenes: true },
      labelMode: 'date',
    });

    expect(withLoose.status).toBe(200);
    expect(withoutLoose.status).toBe(200);
    expect(withoutLoose.data.manuscriptByteSize).toBeLessThan(withLoose.data.manuscriptByteSize);
  });

  it('publishes the same shape the device exports', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);
    await db
      .insert(scenes)
      .values({ id: newId(), storyId: story.id, chapterId: null, name: 'Tail', index: 3 });
    const [chapter] = await db.select().from(chapters).where(eq(chapters.storyId, story.id));
    await db.update(scenes).set({ chapterId: chapter.id }).where(eq(scenes.name, 'Tail'));

    const { status } = await publish(ana.token, story.id, {
      manuscript: {
        format: 'md',
        includeSceneNames: true,
        includeToc: true,
        style: { sceneSeparator: 'asterisks', chapterNumbering: 'roman', quotes: 'curly' },
      },
    });

    expect(status).toBe(200);
    const manuscript = await storedManuscript(story.id);
    expect(manuscript).toContain('## Contents');
    expect(manuscript).toContain('## I. One');
    expect(manuscript).toContain('### 1. Filed');
    expect(manuscript).toContain('\n* * *\n');
    expect(manuscript).not.toContain('Loose body.');
  });

  it('refuses a style the shared schema rejects', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', style: { fontSize: 99 } },
    });

    expect(status).toBe(400);
    expect(data.message).toMatch(/style\.fontSize/);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('publishes one arc under its title', async () => {
    const story = await uploadTestStory(ana.token);
    const arcId = newId();
    await db.insert(storyArcs).values({ id: arcId, storyId: story.id, title: 'Book Two' });
    const chapterId = newId();
    await db
      .insert(chapters)
      .values({ id: chapterId, storyId: story.id, name: 'Two', index: 2, arcId });
    await db.insert(scenes).values({
      id: newId(),
      storyId: story.id,
      chapterId,
      name: 'Second',
      index: 1,
      body: 'Second book body.',
    });
    await seedLinearContent(story.id);

    const { status } = await publish(ana.token, story.id, { manuscript: { format: 'md', arcId } });

    expect(status).toBe(200);
    const manuscript = await storedManuscript(story.id);
    expect(manuscript.startsWith('# Book Two')).toBe(true);
    expect(manuscript).toContain('Second book body.');
    expect(manuscript).not.toContain('Filed body.');
  });

  it('refuses an arc from another story', async () => {
    const first = await uploadTestStory(ana.token, 'First');
    const arcId = newId();
    await db.insert(storyArcs).values({ id: arcId, storyId: first.id, title: 'Elsewhere' });
    const second = await uploadTestStory(ana.token, 'Second');
    await seedLinearContent(second.id);

    const { status, data } = await publish(ana.token, second.id, {
      manuscript: { format: 'md', arcId },
    });

    expect(status).toBe(400);
    expect(data.message).toMatch(/Arc .* does not belong/);
    expect(await storedPublicationFiles(second.id)).toEqual([]);
  });

  it('publishes a branching manuscript as a whole gamebook, ignoring includeLooseScenes', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    await seedBranchingContent(story.id);
    await seedChoiceAnnotations(story.id);

    const { status, data } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeLooseScenes: false, includeSceneNames: true },
    });

    expect(status).toBe(200);
    expect(data.manuscriptFormat).toBe('md');
    expect(data.manuscriptByteSize).toBeGreaterThan(0);
    const manuscript = await storedManuscript(story.id);
    expect(manuscript).toContain('Start body.');
    expect(manuscript).toContain('End body.');
    // Nothing leads to the attic, but reachability is a guess: it closes the book instead of vanishing.
    expect(manuscript).toContain('Attic body.');
  });

  it('embeds choice requirements and effects in the published manuscript', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    await seedBranchingContent(story.id);
    await seedChoiceAnnotations(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeSceneNames: true },
    });
    expect(status).toBe(200);

    const manuscript = await storedManuscript(story.id);
    expect(manuscript).toContain('- Go on');
    expect(manuscript).toContain('• Enables this choice if: "Brass Key" is in the inventory');
    expect(manuscript).toContain('Effects');
    expect(manuscript).toContain('• Grants item "Brass Key"');
  });

  it('opens a branching manuscript with a start page when several scenes are starts', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    await seedBranchingContent(story.id);
    await db.update(scenes).set({ isStart: true }).where(eq(scenes.name, 'Attic'));

    const { status } = await publish(ana.token, story.id, {
      manuscript: {
        format: 'md',
        includeSceneNames: true,
        labels: { chooseStart: 'Pick your start', beginAt: 'Begin' },
      },
    });

    expect(status).toBe(200);
    const manuscript = await storedManuscript(story.id);
    expect(manuscript).toContain('Pick your start');
    expect(manuscript).toContain('Attic body.');
  });

  it('accepts a shuffled order and a seed for a branching manuscript', async () => {
    const story = await uploadTestStory(ana.token, 'Branches', 'branching');
    await seedBranchingContent(story.id);
    await seedChoiceAnnotations(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', sceneOrder: 'shuffled', shuffleSeed: 'fixed' },
    });

    expect(status).toBe(200);
    const manuscript = await storedManuscript(story.id);
    expect(manuscript).toContain('Start body.');
    expect(manuscript).toContain('End body.');
  });

  it('refuses an oversized manuscript and writes no package', async () => {
    const story = await uploadTestStory(ana.token);
    // 1800 scenes at the per-scene body cap: ~54 MB of prose, past the 50 MB manuscript cap.
    const body = 'y'.repeat(30000);
    const rows = Array.from({ length: 1800 }, (_, index) => ({
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
      manuscript: { format: 'md', includeLooseScenes: true },
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

/** A real 6x4 PNG (opaque RGB), so every renderer can embed it. */
function realPng(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(6, 0);
  header.writeUInt32BE(4, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.concat(
    Array.from({ length: 4 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(6 * 3, 90)])),
  );
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** One scene with two pages: a Gallery picture stored on the server, and a page whose picture is gone. */
async function seedComicContent(storyId: string): Promise<void> {
  const chapterId = newId();
  await db.insert(chapters).values({ id: chapterId, storyId, name: 'Issue one', index: 1 });
  const sceneId = newId();
  await db
    .insert(scenes)
    .values({ id: sceneId, storyId, chapterId, name: 'Opening', index: 1, body: null });
  const png = realPng();
  const hash = createHash('md5').update(png).digest('hex');
  await mediaStorageService.store(
    hash,
    'image/png',
    png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer,
  );
  const galleryId = newId();
  await db.insert(galleries).values({
    id: galleryId,
    storyId,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'panel.png',
    hash,
    sizeBytes: png.byteLength,
  });
  await db.insert(scenePages).values([
    { id: newId(), storyId, sceneId, rank: 'a0', galleryId, fit: 'contain', text: 'First panel' },
    { id: newId(), storyId, sceneId, rank: 'a1', galleryId: null, fit: 'cover', text: 'Lost art' },
  ]);
}

async function storedManuscriptBytes(storyId: string): Promise<Buffer> {
  const files = await storedPublicationFiles(storyId);
  const manuscript = files.find((file) => file.includes('.manuscript.'));
  if (!manuscript) throw new Error('Expected a stored manuscript file.');
  return readFile(path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', storyId, manuscript));
}

describe('publishing the pages of a comic', () => {
  it('puts the stored pictures and the page texts in an HTML manuscript, leaving out the page whose picture is gone', async () => {
    const story = await uploadTestStory(ana.token);
    await seedComicContent(story.id);

    const { status } = await publish(ana.token, story.id, { manuscript: { format: 'html' } });

    expect(status).toBe(200);
    const html = (await storedManuscriptBytes(story.id)).toString('utf8');
    expect(html).toContain('<figcaption>Page 1</figcaption>');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('First panel');
    expect(html).not.toContain('Lost art');
    expect(html).not.toContain('Page 2');
  });

  it('captions the pages in the words and the noun the publisher sent', async () => {
    const story = await uploadTestStory(ana.token);
    await seedComicContent(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: {
        format: 'html',
        pageNoun: 'frame',
        labels: { frameLabel: 'Quadro', mediaRemoved: 'Imagem removida' },
      },
    });

    expect(status).toBe(200);
    const html = (await storedManuscriptBytes(story.id)).toString('utf8');
    expect(html).toContain('<figcaption>Quadro 1</figcaption>');
    expect(html).not.toContain('Frame 1');
  });

  it('embeds the picture in a PDF, in a frame the arc chose', async () => {
    const story = await uploadTestStory(ana.token);
    await seedComicContent(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: { format: 'pdf', pageFormat: 'wide' },
    });

    expect(status).toBe(200);
    const pdf = (await storedManuscriptBytes(story.id)).toString('latin1');
    expect(pdf).toContain('/Subtype /Image');
    expect(pdf).toContain('/XObject <<');
  });

  it('leaves the pictures out of a markdown manuscript but keeps each page and its text', async () => {
    const story = await uploadTestStory(ana.token);
    await seedComicContent(story.id);

    const { status } = await publish(ana.token, story.id, { manuscript: { format: 'md' } });

    expect(status).toBe(200);
    const md = (await storedManuscriptBytes(story.id)).toString('utf8');
    expect(md).toContain('**Page 1**');
    expect(md).toContain('First panel');
    expect(md).not.toContain('Lost art');
    expect(md).not.toContain('Image removed');
    expect(md).not.toContain('data:image');
  });

  it('refuses a book whose pictures alone would pass the limit, before reading them, and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedComicContent(story.id);
    await db
      .update(galleries)
      .set({ sizeBytes: 60 * 1024 * 1024 })
      .where(eq(galleries.storyId, story.id));

    const { status, data } = await publish(ana.token, story.id, { manuscript: { format: 'epub' } });

    expect(status).toBe(400);
    expect(data.message).toMatch(/exceeds the .* limit/);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });
});

/**
 * A tavern scene sung to a song with a chorus, an audio reference of the Gallery that plays under it,
 * and a second scene that sings only the chorus again.
 */
async function seedSongContent(storyId: string): Promise<void> {
  const chapterId = newId();
  await db.insert(chapters).values({ id: chapterId, storyId, name: 'One', index: 1 });
  const tavern = newId();
  const funeral = newId();
  await db.insert(scenes).values([
    { id: tavern, storyId, chapterId, name: 'Tavern', index: 1, body: 'The bard stands.' },
    { id: funeral, storyId, chapterId, name: 'Funeral', index: 2, body: 'They bury him.' },
  ]);
  const songId = newId();
  await db.insert(songs).values({
    id: songId,
    storyId,
    title: 'The Lantern Song',
    lyrics: '{sov: Verse 1}\n[G]Light the lantern\n{eov}\n{soc: Chorus}\nHome, home, home\n{eoc}',
    lyricsTranslation: '{sov: Verse 1}\nAcende o lampião\n{eov}',
  });
  const referenceId = newId();
  await db.insert(galleries).values({
    id: referenceId,
    storyId,
    mediaType: 'audio',
    mimeType: 'audio/mpeg',
    fileName: 'secret-reference.mp3',
    hash: createHash('md5').update('secret-reference').digest('hex'),
    sizeBytes: 1,
  });
  await db.insert(sceneMusic).values([
    {
      id: newId(),
      storyId,
      sceneId: tavern,
      rank: 'a0',
      songId,
      galleryId: null,
      role: 'in-world',
      cue: 'as the bard begins',
      sections: null,
    },
    {
      id: newId(),
      storyId,
      sceneId: tavern,
      rank: 'a1',
      songId: null,
      galleryId: referenceId,
      role: 'score',
      cue: 'comes in under the song',
      sections: null,
    },
    {
      id: newId(),
      storyId,
      sceneId: funeral,
      rank: 'a0',
      songId,
      galleryId: null,
      role: 'in-world',
      cue: null,
      sections: ['Chorus'],
    },
  ]);
}

describe('publishing the songs of a story', () => {
  it('leaves the songs out unless the publication asks for them', async () => {
    const story = await uploadTestStory(ana.token);
    await seedSongContent(story.id);

    const { status } = await publish(ana.token, story.id, { manuscript: { format: 'md' } });

    expect(status).toBe(200);
    const md = await storedManuscript(story.id);
    expect(md).toContain('The bard stands.');
    expect(md).not.toContain('Light the lantern');
  });

  it('gathers the songs in an appendix, each once and whole', async () => {
    const story = await uploadTestStory(ana.token);
    await seedSongContent(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeSongs: true },
    });

    expect(status).toBe(200);
    const md = await storedManuscript(story.id);
    expect(md).toContain('Songs');
    expect(md).toContain('The Lantern Song');
    expect(md).toContain('Light the lantern');
    expect(md.match(/Home, home, home/g)).toHaveLength(1);
  });

  it('prints each part of a song after the scene that sings it, and names it where it was sung before', async () => {
    const story = await uploadTestStory(ana.token);
    await seedSongContent(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeSongs: true, songsPlacement: 'after-scene' },
    });

    expect(status).toBe(200);
    const md = await storedManuscript(story.id);
    expect(md.indexOf('Light the lantern')).toBeGreaterThan(md.indexOf('The bard stands.'));
    expect(md.indexOf('Light the lantern')).toBeLessThan(md.indexOf('They bury him.'));
    expect(md.match(/Home, home, home/g)).toHaveLength(1);
    expect(md).toContain('The Lantern Song');
  });

  it('prints the translation when asked to', async () => {
    const story = await uploadTestStory(ana.token);
    await seedSongContent(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeSongs: true, songLanguage: 'both' },
    });

    expect(status).toBe(200);
    expect(await storedManuscript(story.id)).toContain('Acende o lampião');
  });

  it('never publishes a reference of the Gallery, the score or the cues, whatever the request says', async () => {
    const story = await uploadTestStory(ana.token);
    await seedSongContent(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: { format: 'md', includeSongs: true, includeMusicCues: true },
    });

    expect(status).toBe(200);
    const md = await storedManuscript(story.id);
    expect(md).not.toContain('secret-reference');
    expect(md).not.toContain('comes in under the song');
    expect(md).not.toContain('as the bard begins');
    expect(md).not.toContain('Music:');
  });

  it('writes the songs of a script as Fountain lyrics and no notes', async () => {
    const story = await uploadTestStory(ana.token);
    await seedSongContent(story.id);

    const { status } = await publish(ana.token, story.id, {
      manuscript: {
        format: 'fountain',
        includeSongs: true,
        screenplay: { includeMusicNotes: true },
      },
    });

    expect(status).toBe(200);
    const text = await storedManuscript(story.id);
    expect(text).toContain('~Light the lantern');
    expect(text).not.toContain('[[');
  });
});
