import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { boards, characters, galleries, locationMaps, notes } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import { installBunShim } from '../helpers/bunShim';

installBunShim();

let admin: TestUser;
let ana: TestUser;
let storyId: string;
let galleryId: string;

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PNG_HASH = createHash('md5').update(Buffer.from(PNG_BYTES)).digest('hex');
const UNKNOWN_HASH = createHash('md5').update('never-referenced').digest('hex');

const media = (story = storyId) =>
  request('GET', `/admin/api/stories/${story}/media`, { token: admin.token });
const boardsOf = (story = storyId) =>
  request('GET', `/admin/api/stories/${story}/boards`, { token: admin.token });
const mapsOf = (story = storyId) =>
  request('GET', `/admin/api/stories/${story}/location-maps`, { token: admin.token });
const blob = (hash: string, story = storyId, token?: string) =>
  request('GET', `/admin/api/stories/${story}/blobs/${hash}`, { token });

async function seedContent() {
  const now = new Date();
  galleryId = newId();
  await db.insert(galleries).values({
    id: galleryId,
    storyId,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: 'retrato.png',
    hash: PNG_HASH,
    sizeBytes: PNG_BYTES.length,
    title: 'Retrato',
    isFavorite: false,
    extraNotes: 'rascunho do herói',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  } as never);
  // The bytes themselves travel the owner upload path, like the client does.
  const form = new FormData();
  form.append('file', new File([Buffer.from(PNG_BYTES)], 'retrato.png', { type: 'image/png' }));
  form.append('mimeType', 'image/png');
  const uploaded = await request('POST', `/media/${storyId}/blobs/${PNG_HASH}`, {
    token: ana.token,
    body: form,
  });
  expect(uploaded.status).toBe(200);

  await db.insert(boards).values({
    id: newId(),
    storyId,
    name: 'Relações',
    description: 'quem conhece quem',
    content: {
      nodes: [
        {
          id: 'AAAAAAAA',
          kind: 'entity',
          x: 0,
          y: 0,
          entityType: 'Character',
          entityId: 'char-1',
          labelAtPin: 'Herói',
          displayMode: 'compact',
          cardNote: 'protagonista',
        },
        {
          id: 'BBBBBBBB',
          kind: 'note',
          x: 10,
          y: 10,
          title: 'Ideia',
          body: 'revelar no capítulo 3',
        },
      ],
      edges: [
        { id: 'CCCCCCCC', from: 'AAAAAAAA', to: 'BBBBBBBB', directed: true, label: 'inspira' },
      ],
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  } as never);

  await db.insert(locationMaps).values({
    id: newId(),
    storyId,
    name: 'Reino',
    description: 'mapa geral',
    content: {
      images: [
        {
          id: 'DDDDDDDD',
          galleryId,
          x: 0,
          y: 0,
          width: 400,
          height: 300,
          locked: false,
        },
      ],
      nodes: [
        {
          id: 'EEEEEEEE',
          locationId: 'loc-1',
          x: 5,
          y: 5,
          icon: 'pin',
          color: '#ffffff',
          labelAtPin: 'Taverna',
        },
      ],
      markers: [
        {
          id: 'FFFFFFFF',
          x: 9,
          y: 9,
          title: 'Tesouro',
          note: 'atrás da porta',
          icon: 'star',
          color: '#ffffff',
        },
      ],
      relationTexts: [
        { sourceLocationId: 'loc-1', destinationLocationId: 'loc-2', text: 'estrada de terra' },
      ],
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  } as never);
}

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token, 'A Queda')).id;
  await seedContent();
});

describe('admin story content review', () => {
  it('lists the live media metadata of a story', async () => {
    const { status, data } = await media();

    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      fileName: 'retrato.png',
      title: 'Retrato',
      mediaType: 'image',
      mimeType: 'image/png',
      hash: PNG_HASH,
      extraNotes: 'rascunho do herói',
    });
  });

  it('hides deleted media from the moderation listing', async () => {
    await db.update(galleries).set({ isDeleted: true } as never);

    const { status, data } = await media();

    expect(status).toBe(200);
    expect(data).toHaveLength(0);
  });

  it('summarizes boards without requiring the canvas', async () => {
    const { status, data } = await boardsOf();

    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Relações');
    expect(data[0].summary).toMatchObject({
      nodeCount: 2,
      edgeCount: 1,
      edgeLabels: ['inspira'],
    });
    expect(data[0].summary.entityPins).toEqual([
      { entityType: 'Character', entityId: 'char-1', label: 'Herói', note: 'protagonista' },
    ]);
    expect(data[0].summary.notes).toEqual([{ title: 'Ideia', body: 'revelar no capítulo 3' }]);
  });

  it('summarizes location maps with marker texts and base images', async () => {
    const { status, data } = await mapsOf();

    expect(status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Reino');
    expect(data[0].summary).toMatchObject({
      imageCount: 1,
      nodeCount: 1,
      baseGalleryIds: [galleryId],
      locationIds: ['loc-1'],
      markers: [{ title: 'Tesouro', note: 'atrás da porta' }],
      relationTexts: ['estrada de terra'],
    });
  });

  it('serves a referenced blob to the administrator', async () => {
    const { status, headers } = await blob(PNG_HASH, storyId, admin.token);

    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('image/png');
  });

  it('refuses a hash the story never referenced, even to an administrator', async () => {
    const { status } = await blob(UNKNOWN_HASH, storyId, admin.token);

    expect(status).toBe(404);
  });

  it('rejects a malformed hash', async () => {
    const { status } = await blob('hash-invalido', storyId, admin.token);

    expect(status).toBe(400);
  });

  it('answers 404 for an unknown story on every content route', async () => {
    const ghost = newId();

    expect(
      (await request('GET', `/admin/api/stories/${ghost}/media`, { token: admin.token })).status,
    ).toBe(404);
    expect(
      (await request('GET', `/admin/api/stories/${ghost}/boards`, { token: admin.token })).status,
    ).toBe(404);
    expect(
      (await request('GET', `/admin/api/stories/${ghost}/location-maps`, { token: admin.token }))
        .status,
    ).toBe(404);
    expect((await blob(PNG_HASH, ghost, admin.token)).status).toBe(404);
  });

  describe('admin story entity browser', () => {
    const entityTypes = (story = storyId, token?: string) =>
      request('GET', `/admin/api/stories/${story}/entities`, { token });
    const entitiesOf = (type: string, story = storyId, token?: string, query = '') =>
      request('GET', `/admin/api/stories/${story}/entities/${type}${query}`, { token });

    async function seedStoryEntities() {
      const now = new Date();
      await db.insert(characters).values({
        id: newId(),
        storyId,
        name: 'Herói',
        description: 'protagonista',
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      } as never);
      await db.insert(characters).values({
        id: newId(),
        storyId,
        name: 'Apagado',
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: true,
        deletedAt: now,
      } as never);
      await db.insert(notes).values({
        id: newId(),
        storyId,
        title: 'Ideia',
        body: 'revelar no capítulo 3',
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      } as never);
    }

    it('lists every browsable entity type with live counts', async () => {
      await seedStoryEntities();

      const { status, data } = await entityTypes(storyId, admin.token);

      expect(status).toBe(200);
      const byType = new Map(
        data.map((entry: { entityType: string; liveCount: number }) => [
          entry.entityType,
          entry.liveCount,
        ]),
      );
      expect(byType.get('Character')).toBe(1);
      expect(byType.get('Note')).toBe(1);
      expect(byType.get('Story')).toBe(1);
      expect(byType.get('Gallery')).toBe(1);
      expect(byType.get('Board')).toBe(1);
      expect(byType.get('LocationMap')).toBe(1);
      // Tables with no story binding stay out of the browser.
      expect(byType.has('User')).toBe(false);
    });

    it('returns the raw stored fields of one entity type', async () => {
      await seedStoryEntities();

      const { status, data } = await entitiesOf('Character', storyId, admin.token);

      expect(status).toBe(200);
      expect(data).toMatchObject({ total: 1, page: 1, pageSize: 25 });
      expect(data.items).toHaveLength(1);
      expect(data.items[0]).toMatchObject({ name: 'Herói', description: 'protagonista' });
    });

    it('paginates entity rows without repeating or skipping them', async () => {
      const now = new Date();
      for (let index = 0; index < 3; index += 1) {
        await db.insert(notes).values({
          id: newId(),
          storyId,
          title: `Nota ${index}`,
          createdAt: now,
          updatedAt: now,
          version: 1,
          isDeleted: false,
          deletedAt: null,
        } as never);
      }

      const first = await entitiesOf('Note', storyId, admin.token, '?page=1&pageSize=2');
      const second = await entitiesOf('Note', storyId, admin.token, '?page=2&pageSize=2');

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.data).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(second.data).toMatchObject({ total: 3, page: 2, pageSize: 2 });
      expect(first.data.items).toHaveLength(2);
      expect(second.data.items).toHaveLength(1);
      const seen = [...first.data.items, ...second.data.items].map((row: { id: string }) => row.id);
      expect(new Set(seen).size).toBe(3);
    });

    it('rejects out-of-range pages', async () => {
      expect((await entitiesOf('Note', storyId, admin.token, '?page=0')).status).toBe(400);
      expect((await entitiesOf('Note', storyId, admin.token, '?pageSize=101')).status).toBe(400);
    });

    it('reads the story row itself through the Story type', async () => {
      const { status, data } = await entitiesOf('Story', storyId, admin.token);

      expect(status).toBe(200);
      expect(data.total).toBe(1);
      expect(data.items[0]).toMatchObject({ id: storyId, title: 'A Queda' });
    });

    it('rejects unknown and non-story entity types', async () => {
      expect((await entitiesOf('Inventado', storyId, admin.token)).status).toBe(400);
      expect((await entitiesOf('User', storyId, admin.token)).status).toBe(400);
    });

    it('answers 404 for an unknown story and keeps the browser administrator-only', async () => {
      const ghost = newId();

      expect((await entityTypes(ghost, admin.token)).status).toBe(404);
      expect((await entitiesOf('Character', ghost, admin.token)).status).toBe(404);
      expect((await entityTypes(storyId, ana.token)).status).toBe(403);
      expect((await entitiesOf('Character', storyId, ana.token)).status).toBe(403);
      expect((await entityTypes(storyId, undefined)).status).toBe(401);
    });
  });

  describe('admin story content routes', () => {
    it('keeps every content route administrator-only', async () => {
      expect((await media()).status).toBe(200);

      const paths = ['media', 'boards', 'location-maps'];
      for (const path of paths) {
        expect(
          (await request('GET', `/admin/api/stories/${storyId}/${path}`, { token: ana.token }))
            .status,
        ).toBe(403);
      }
      expect((await blob(PNG_HASH, storyId, ana.token)).status).toBe(403);
      // The owner downloads through the story route, never through the admin one.
      expect((await blob(PNG_HASH, storyId, undefined)).status).toBe(401);
    });
  });
});
