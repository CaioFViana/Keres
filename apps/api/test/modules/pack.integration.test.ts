import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { showcaseSettings } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/** The whole `/public` group answers 404 while the Showcase is off - packs included. */
async function enableShowcase(enabled = true): Promise<void> {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: enabled })
    .onConflictDoUpdate({
      target: showcaseSettings.id,
      set: { isShowcaseEnabled: enabled },
    });
}

/**
 * Sharing packs over ordinary REST.
 *
 * What these assert, beyond the happy path, is the shape of the decision to *not* reuse the
 * publication flow: no synchronization state is consulted, a pack is replaced wholesale by its
 * author rather than merged, and deleting one leaves nothing behind. The listing is also asserted
 * to be metadata-only, because that is the reason those columns exist at all.
 */

let ana: TestUser;
let bia: TestUser;

const validContent = () => ({
  formatVersion: 1,
  storySchemaFields: [],
  suggestions: [],
  tags: [],
  stats: [],
  statStrengths: [],
  settings: { statSystem: false, statNotation: 'letter' },
});

/** A tag row shaped as the story export already shapes one - a pack carries whole entities. */
const tag = (name: string) => ({
  id: newId(),
  storyId: newId(),
  name,
  color: null,
  isFavorite: false,
  extraNotes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  isDeleted: false,
  deletedAt: null,
});

const upload = (who: TestUser, body: Record<string, unknown>) =>
  request('POST', '/packs/', { token: who.token, body });

const listPacks = (who: TestUser) => request('GET', '/packs/', { token: who.token });
const getPack = (who: TestUser, packId: string) =>
  request('GET', `/packs/${packId}`, { token: who.token });
const removePack = (who: TestUser, packId: string) =>
  request('DELETE', `/packs/${packId}`, { token: who.token });

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
});

describe('sharing a pack', () => {
  it('uploads one and gives it back whole', async () => {
    const packId = newId();
    const uploaded = await upload(ana, {
      id: packId,
      name: 'D&D stats',
      description: 'Six axes and a ladder',
      language: 'en',
      authorName: 'Ana',
      version: 2,
      content: validContent(),
    });
    expect(uploaded.status).toBe(200);

    const fetched = await getPack(bia, packId);
    expect(fetched.status).toBe(200);
    expect(fetched.data).toMatchObject({
      id: packId,
      name: 'D&D stats',
      language: 'en',
      authorName: 'Ana',
      version: 2,
      ownerId: ana.userId,
    });
    expect(fetched.data.content).toMatchObject({ formatVersion: 1 });
  });

  /** The columns exist so a listing never has to open a payload; this is what that buys. */
  it('lists metadata without the payload', async () => {
    await upload(ana, { id: newId(), name: 'One', content: validContent() });

    const { status, data } = await listPacks(bia);

    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ name: 'One' });
    expect(data[0].content).toBeUndefined();
  });

  it('refuses a payload that is not a pack', async () => {
    const { status } = await upload(ana, {
      id: newId(),
      name: 'Nonsense',
      content: { storySchemaFields: 'not an array' },
    });

    expect(status).toBe(422);
  });

  it('requires a token', async () => {
    const { status } = await request('GET', '/packs/');
    expect(status).toBe(401);
  });
});

describe('sharing a new version', () => {
  /**
   * A pack at a given version is immutable, so there is nothing to merge: the author replaces the
   * row. That is the whole reason this needs neither OCC nor a version negotiation.
   */
  it('replaces the author own pack wholesale', async () => {
    const packId = newId();
    await upload(ana, { id: packId, name: 'First', version: 1, content: validContent() });

    await upload(ana, {
      id: packId,
      name: 'Second',
      version: 2,
      content: { ...validContent(), tags: [] },
    });

    const { data } = await getPack(ana, packId);
    expect(data).toMatchObject({ name: 'Second', version: 2 });
    const list = await listPacks(ana);
    expect(list.data).toHaveLength(1);
  });

  it('refuses to let somebody else overwrite it', async () => {
    const packId = newId();
    await upload(ana, { id: packId, name: 'Ana pack', content: validContent() });

    const { status } = await upload(bia, {
      id: packId,
      name: 'Hijacked',
      content: validContent(),
    });

    expect(status).toBe(403);
    const { data } = await getPack(ana, packId);
    expect(data.name).toBe('Ana pack');
  });
});

describe('withdrawing a pack', () => {
  it('removes it outright', async () => {
    const packId = newId();
    await upload(ana, { id: packId, name: 'Doomed', content: validContent() });

    const removed = await removePack(ana, packId);

    expect(removed.status).toBe(200);
    expect((await getPack(ana, packId)).status).toBe(404);
    expect((await listPacks(ana)).data).toHaveLength(0);
  });

  it('refuses to remove somebody else pack', async () => {
    const packId = newId();
    await upload(ana, { id: packId, name: 'Ana pack', content: validContent() });

    expect((await removePack(bia, packId)).status).toBe(403);
    expect((await getPack(ana, packId)).status).toBe(200);
  });

  it('answers 404 for a pack that never existed', async () => {
    expect((await removePack(ana, newId())).status).toBe(404);
    expect((await getPack(ana, newId())).status).toBe(404);
  });
});

/**
 * The public Showcase.
 *
 * The rule mirrors the story listing exactly: sharing a pack with a server is not publishing it. The
 * author raises the flag, and until they do the pack is invisible to anyone without an account -
 * which is the whole reason the flag exists rather than every upload being public.
 */
describe('the public showcase', () => {
  const listPublic = () => request('GET', '/public/packs');
  const getPublic = (packId: string) => request('GET', `/public/packs/${packId}`);

  beforeEach(async () => {
    await enableShowcase();
  });

  it('offers nothing at all while the showcase is off', async () => {
    await enableShowcase(false);
    await upload(ana, {
      id: newId(),
      name: 'Public but hidden',
      visibility: 'public',
      content: validContent(),
    });

    expect((await listPublic()).status).toBe(404);
  });

  it('offers nothing shared privately, even to an account', async () => {
    await upload(ana, { id: newId(), name: 'Kept private', content: validContent() });

    const { status, data } = await listPublic();

    expect(status).toBe(200);
    expect(data).toHaveLength(0);
  });

  it('offers one the author flagged, with no account at all', async () => {
    const packId = newId();
    await upload(ana, {
      id: packId,
      name: 'Shared with the world',
      visibility: 'public',
      content: validContent(),
    });

    const { status, data } = await listPublic();

    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: packId, name: 'Shared with the world' });
  });

  it('gives a public pack back whole, without a token', async () => {
    const packId = newId();
    await upload(ana, {
      id: packId,
      name: 'Downloadable',
      visibility: 'public',
      content: validContent(),
    });

    const { status, data } = await getPublic(packId);

    expect(status).toBe(200);
    expect(data.content).toMatchObject({ formatVersion: 1 });
  });

  /** 404 rather than 403: saying "forbidden" would confirm the pack exists. */
  it('answers 404 for a private pack rather than admitting it exists', async () => {
    const packId = newId();
    await upload(ana, { id: packId, name: 'Hidden', content: validContent() });

    expect((await getPublic(packId)).status).toBe(404);
  });

  /**
   * The listing has no account behind it, so it has to carry what a visitor cannot look up: who is
   * offering the pack, and what is inside it without downloading it.
   */
  it('carries the owner and a count of the contents, without the payload', async () => {
    await upload(ana, {
      id: newId(),
      name: 'Six axes',
      authorName: 'Ana the GM',
      visibility: 'public',
      content: {
        ...validContent(),
        tags: [tag('Undead'), tag('Cursed')],
        settings: {
          statSystem: true,
          statNotation: 'number',
          vocabulary: {
            version: 1,
            language: 'en',
            terms: {
              Character: { singular: 'Hero', plural: 'Heroes', grammaticalGender: 'neutral' },
            },
          },
        },
      },
    });

    const { data } = await listPublic();

    expect(data[0]).toMatchObject({
      authorName: 'Ana the GM',
      owner: { username: ana.username },
      summary: {
        tagCount: 2,
        fieldCount: 0,
        hasVocabulary: true,
        statSystem: true,
        statNotation: 'number',
      },
    });
    expect(data[0].content).toBeUndefined();
  });

  /** An anonymous reader gains nothing from an account id, so it never leaves the server. */
  it('never exposes the owner account id', async () => {
    const packId = newId();
    await upload(ana, { id: packId, name: 'Anon', visibility: 'public', content: validContent() });

    expect((await listPublic()).data[0].ownerId).toBeUndefined();
    expect((await getPublic(packId)).data.ownerId).toBeUndefined();
  });

  it('stops offering one the author takes back to private', async () => {
    const packId = newId();
    await upload(ana, {
      id: packId,
      name: 'Was public',
      visibility: 'public',
      content: validContent(),
    });
    expect((await listPublic()).data).toHaveLength(1);

    await upload(ana, {
      id: packId,
      name: 'Was public',
      visibility: 'private',
      content: validContent(),
    });

    expect((await listPublic()).data).toHaveLength(0);
    expect((await getPublic(packId)).status).toBe(404);
  });
});
