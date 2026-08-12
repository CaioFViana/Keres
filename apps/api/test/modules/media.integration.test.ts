import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { galleries } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { truncateAll } from '../helpers/database';

installBunShim();

let ana: TestUser;
let bia: TestUser;
let storyId: string;

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

/** O servidor recalcula o hash dos bytes recebidos; é MD5 porque é o que o cliente consegue calcular. */
const md5 = (bytes: Uint8Array) => createHash('md5').update(Buffer.from(bytes)).digest('hex');

const PNG_HASH = md5(PNG_BYTES);

function upload(token: string, hash: string, bytes: Uint8Array, mimeType = 'image/png', story = storyId) {
  const form = new FormData();
  form.append('file', new File([Buffer.from(bytes)], 'retrato.png', { type: mimeType }));
  form.append('mimeType', mimeType);
  return request('POST', `/media/${story}/blobs/${hash}`, { token, body: form });
}

const blobStatus = (token: string, hashes: string[], story = storyId) =>
  request('POST', `/media/${story}/blobs/status`, { token, body: { hashes } });

const download = (token: string, hash: string, story = storyId) =>
  request('GET', `/media/${story}/blobs/${hash}`, { token });

/** Registra a mídia na galeria da história - é o que autoriza a leitura dos bytes. */
async function referenceInGallery(hash: string, story = storyId, mimeType = 'image/png') {
  const now = new Date();
  await db.insert(galleries).values({
    id: newId(),
    storyId: story,
    mediaType: 'image',
    mimeType,
    fileName: 'retrato.png',
    hash,
    sizeBytes: PNG_BYTES.length,
    title: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  } as never);
}

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  const { data } = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'A Queda', type: 'linear' },
  });
  storyId = data.id;
});

describe('POST /media/:storyId/blobs/status', () => {
  it('reports every hash as missing on an empty server', async () => {
    const { status, data } = await blobStatus(ana.token, [PNG_HASH]);

    expect(status).toBe(200);
    expect(data).toEqual({ present: [], missing: [PNG_HASH] });
  });

  it('reports a hash as present once it was uploaded', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);

    const { data } = await blobStatus(ana.token, [PNG_HASH]);

    expect(data).toEqual({ present: [PNG_HASH], missing: [] });
  });

  it('rejects a hash that is not a 32-character digest', async () => {
    const { status } = await blobStatus(ana.token, ['nao-e-um-hash']);

    expect(status).toBe(400);
  });

  it('accepts an empty list', async () => {
    const { status, data } = await blobStatus(ana.token, []);

    expect(status).toBe(200);
    expect(data).toEqual({ present: [], missing: [] });
  });

  it('hides another user story behind a 404', async () => {
    const { status } = await blobStatus(bia.token, [PNG_HASH]);

    expect(status).toBe(404);
  });

  it('requires a session', async () => {
    const { status } = await request('POST', `/media/${storyId}/blobs/status`, { body: { hashes: [] } });

    expect(status).toBe(401);
  });
});

describe('POST /media/:storyId/blobs/:hash', () => {
  it('stores the bytes and reports what it stored', async () => {
    const { status, data } = await upload(ana.token, PNG_HASH, PNG_BYTES);

    expect(status).toBe(200);
    expect(data).toMatchObject({ hash: PNG_HASH, sizeBytes: PNG_BYTES.length, mimeType: 'image/png' });
  });

  it('is idempotent, since the same bytes always have the same hash', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);

    const { status } = await upload(ana.token, PNG_HASH, PNG_BYTES);

    expect(status).toBe(200);
  });

  /** O servidor recalcula o hash: um cliente não consegue registrar bytes sob um hash alheio. */
  it('rejects an upload whose bytes do not match the hash', async () => {
    const outrosBytes = new Uint8Array([9, 9, 9]);

    const { status } = await upload(ana.token, PNG_HASH, outrosBytes);

    expect(status).toBe(400);
  });

  it('rejects a malformed hash', async () => {
    const { status } = await upload(ana.token, 'hash-invalido', PNG_BYTES);

    expect(status).toBe(400);
  });

  it('rejects a media type the app cannot display', async () => {
    const { status } = await upload(ana.token, md5(PNG_BYTES), PNG_BYTES, 'application/x-msdownload');

    expect(status).toBe(415);
  });

  it('refuses an upload from a reader', async () => {
    await befriend(ana, bia);
    await request('POST', '/story-permissions/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });

    const { status } = await upload(bia.token, PNG_HASH, PNG_BYTES);

    expect(status).toBe(404);
  });

  it('allows an upload from a writer', async () => {
    await befriend(ana, bia);
    await request('POST', '/story-permissions/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'writer' },
    });

    const { status } = await upload(bia.token, PNG_HASH, PNG_BYTES);

    expect(status).toBe(200);
  });

  it('requires a session', async () => {
    const form = new FormData();
    form.append('file', new File([Buffer.from(PNG_BYTES)], 'retrato.png', { type: 'image/png' }));

    const { status } = await request('POST', `/media/${storyId}/blobs/${PNG_HASH}`, { body: form });

    expect(status).toBe(401);
  });
});

describe('GET /media/:storyId/blobs/:hash', () => {
  it('serves the bytes when the story references the media', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);
    await referenceInGallery(PNG_HASH);

    const { status, headers } = await download(ana.token, PNG_HASH);

    expect(status).toBe(200);
    expect(headers.get('content-type')).toContain('image/png');
  });

  it('marks the content as immutable, since a hash never changes', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);
    await referenceInGallery(PNG_HASH);

    const { headers } = await download(ana.token, PNG_HASH);

    expect(headers.get('cache-control')).toContain('immutable');
  });

  /**
   * A propriedade que mais importa nesta rota: o armazenamento é deduplicado globalmente por
   * hash, então permissão na história não basta - a história precisa referenciar aquele hash.
   * Sem essa segunda checagem, conhecer um hash daria acesso à mídia de qualquer usuário.
   */
  it('refuses a hash the story does not reference, even to its owner', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);

    const { status } = await download(ana.token, PNG_HASH);

    expect(status).toBe(404);
  });

  it('does not let a second story borrow media it never referenced', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);
    await referenceInGallery(PNG_HASH);
    const { data: outra } = await request('POST', '/stories/', {
      token: ana.token,
      body: { title: 'Outra', type: 'linear' },
    });

    const { status } = await download(ana.token, PNG_HASH, outra.id);

    expect(status).toBe(404);
  });

  it('stops serving media whose gallery entry was deleted', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);
    await referenceInGallery(PNG_HASH);
    await db.update(galleries).set({ isDeleted: true } as never);

    const { status } = await download(ana.token, PNG_HASH);

    expect(status).toBe(404);
  });

  it('answers 404 when the story references a hash the server never received', async () => {
    await referenceInGallery(PNG_HASH);

    const { status } = await download(ana.token, PNG_HASH);

    expect(status).toBe(404);
  });

  it('rejects a malformed hash', async () => {
    const { status } = await download(ana.token, 'hash-invalido');

    expect(status).toBe(400);
  });

  it('hides another user story behind a 404', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);
    await referenceInGallery(PNG_HASH);

    const { status } = await download(bia.token, PNG_HASH);

    expect(status).toBe(404);
  });

  it('lets a reader download', async () => {
    await upload(ana.token, PNG_HASH, PNG_BYTES);
    await referenceInGallery(PNG_HASH);
    await befriend(ana, bia);
    await request('POST', '/story-permissions/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });

    const { status } = await download(bia.token, PNG_HASH);

    expect(status).toBe(200);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', `/media/${storyId}/blobs/${PNG_HASH}`);

    expect(status).toBe(401);
  });
});
