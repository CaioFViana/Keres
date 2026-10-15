import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { chapters, scenes, showcaseSettings } from '@/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '@/db/schema/tables/showcaseSettings';
import { publicationStorageService } from '@/services/PublicationStorageService';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '@test/helpers/app';
import { installBunShim } from '@test/helpers/bunShim';
import { truncateAll } from '@test/helpers/database';

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

/** One filed scene, so the server-compiled side of a mixed publish has something to work with. */
async function seedLinearContent(storyId: string): Promise<void> {
  const chapterId = newId();
  await db.insert(chapters).values({ id: chapterId, storyId, name: 'One', index: 1 });
  await db
    .insert(scenes)
    .values({ id: newId(), storyId, chapterId, name: 'Filed', index: 1, body: 'Filed body.' });
}

interface UploadedFile {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}

async function publishMultipart(
  token: string,
  storyId: string,
  extra: Record<string, unknown> = {},
  files: { manuscript?: UploadedFile; reader?: UploadedFile } = {},
) {
  const form = new FormData();
  form.append(
    'data',
    JSON.stringify({ operationVersion: await serverOperationVersion(storyId), ...extra }),
  );
  if (files.manuscript) {
    form.append(
      'manuscript',
      new File([Buffer.from(files.manuscript.bytes)], files.manuscript.filename, {
        type: files.manuscript.mimeType,
      }),
    );
  }
  if (files.reader) {
    form.append(
      'reader',
      new File([Buffer.from(files.reader.bytes)], files.reader.filename, {
        type: files.reader.mimeType,
      }),
    );
  }
  return request('POST', `/stories/${storyId}/publications`, { token, body: form });
}

function mdFile(bytes = new TextEncoder().encode('# The Book\n\nFiled body.\n')): UploadedFile {
  return { bytes, filename: 'book.md', mimeType: 'text/markdown' };
}

function readerFile(
  bytes = new TextEncoder().encode(
    '<!DOCTYPE html><html><head></head><body>Filed body.</body></html>',
  ),
): UploadedFile {
  return { bytes, filename: 'reader.html', mimeType: 'text/html' };
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await enableShowcase();
});

describe('publishing with client-compiled bytes', () => {
  it('stores a client-compiled manuscript as-is beside the server-built package', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);
    const file = mdFile();

    const { status, data } = await publishMultipart(
      ana.token,
      story.id,
      { manuscript: { format: 'md' } },
      { manuscript: file },
    );

    expect(status).toBe(200);
    expect(data.manuscriptFormat).toBe('md');
    expect(data.manuscriptByteSize).toBe(file.bytes.byteLength);
    expect(data.byteSize).toBeGreaterThan(0);

    const files = await storedPublicationFiles(story.id);
    expect(files).toHaveLength(2);
    const manuscriptName = files.find((name) => name.includes('.manuscript.'));
    expect(manuscriptName).toMatch(/\.manuscript\.md$/);
    const stored = await readFile(
      path.join(process.env.MEDIA_STORAGE_PATH!, 'publications', story.id, manuscriptName!),
    );
    expect(new Uint8Array(stored)).toEqual(file.bytes);
  });

  it('stores a client-compiled reader page as-is', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);
    const file = readerFile();

    const { status, data } = await publishMultipart(
      ana.token,
      story.id,
      { reader: {} },
      { reader: file },
    );

    expect(status).toBe(200);
    expect(data.readerByteSize).toBe(file.bytes.byteLength);
    expect(data.manuscriptFormat).toBeNull();
    const blob = await publicationStorageService.readReader(story.id, data.id);
    expect(new Uint8Array(await (blob as Blob).arrayBuffer())).toEqual(file.bytes);
  });

  it('mixes an uploaded manuscript with a server-compiled reader', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);
    const file = mdFile();

    const { status, data } = await publishMultipart(
      ana.token,
      story.id,
      { manuscript: { format: 'md' }, reader: {} },
      { manuscript: file },
    );

    expect(status).toBe(200);
    expect(data.manuscriptByteSize).toBe(file.bytes.byteLength);
    expect(data.readerByteSize).toBeGreaterThan(0);
    expect(await storedPublicationFiles(story.id)).toHaveLength(3);
  });

  it('publishes an uploaded manuscript without the package when asked', async () => {
    const story = await uploadTestStory(ana.token);
    const file = mdFile();

    const { status, data } = await publishMultipart(
      ana.token,
      story.id,
      { includePackage: false, manuscript: { format: 'md' } },
      { manuscript: file },
    );

    expect(status).toBe(200);
    expect(data.byteSize).toBe(0);
    expect(data.manuscriptByteSize).toBe(file.bytes.byteLength);
    const files = await storedPublicationFiles(story.id);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.manuscript\.md$/);
  });

  it('refuses bytes that do not match the format and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status, data } = await publishMultipart(
      ana.token,
      story.id,
      { manuscript: { format: 'md' } },
      {
        manuscript: {
          bytes: new TextEncoder().encode('%PDF-1.7\n%fake\n'),
          filename: 'book.md',
          mimeType: 'text/markdown',
        },
      },
    );

    expect(status).toBe(400);
    expect(data.message).toMatch(/not.*as the "md" format requires/i);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('refuses a reader that is not HTML and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status } = await publishMultipart(
      ana.token,
      story.id,
      { reader: {} },
      {
        reader: {
          bytes: new TextEncoder().encode('Just some words.\n'),
          filename: 'reader.html',
          mimeType: 'text/html',
        },
      },
    );

    expect(status).toBe(400);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('refuses an upload without its options and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status, data } = await publishMultipart(
      ana.token,
      story.id,
      {},
      { manuscript: mdFile() },
    );

    expect(status).toBe(400);
    expect(data.message).toMatch(/needs its manuscript options/);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('refuses an empty upload and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status } = await publishMultipart(
      ana.token,
      story.id,
      { manuscript: { format: 'md' } },
      { manuscript: { bytes: new Uint8Array(0), filename: 'book.md', mimeType: 'text/markdown' } },
    );

    expect(status).toBe(400);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('refuses malformed data and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const form = new FormData();
    form.append('data', '{not json');
    form.append(
      'manuscript',
      new File([Buffer.from(mdFile().bytes)], 'book.md', { type: 'text/markdown' }),
    );
    const { status } = await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: form,
    });

    expect(status).toBe(400);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('refuses invalid data options and writes nothing', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status } = await publishMultipart(
      ana.token,
      story.id,
      { labelMode: 'sometimes' },
      { manuscript: mdFile() },
    );

    expect(status).toBe(400);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('rejects a stale multipart publish before storing anything', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status, data } = await publishMultipart(
      ana.token,
      story.id,
      {
        operationVersion: (await serverOperationVersion(story.id)) + 1,
        manuscript: { format: 'md' },
      },
      { manuscript: mdFile() },
    );

    expect(status).toBe(409);
    expect(data.message).toMatch(/not in sync/i);
    expect(await storedPublicationFiles(story.id)).toEqual([]);
  });

  it('keeps the JSON path server-compiling both artifacts', async () => {
    const story = await uploadTestStory(ana.token);
    await seedLinearContent(story.id);

    const { status, data } = await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: {
        operationVersion: await serverOperationVersion(story.id),
        manuscript: { format: 'md' },
        reader: {},
      },
    });

    expect(status).toBe(200);
    expect(data.manuscriptFormat).toBe('md');
    expect(data.manuscriptByteSize).toBeGreaterThan(0);
    expect(data.readerByteSize).toBeGreaterThan(0);
    expect(await storedPublicationFiles(story.id)).toHaveLength(3);
  });
});
