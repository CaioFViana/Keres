import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openBlob, sealBlob } from '../src/crypto/seal';
import { destroySubmission } from '../src/crypto/destroy';
import { BlobRefused, BlobUnreadable, readBlob, storeBlob } from '../src/store/blobs';
import { startVerification } from '../src/verifications';
import { bytesContain, harness, type Harness } from './helpers/harness';

describe('AES-256-GCM sealing', () => {
  it('round-trips, prefixes a 12-byte nonce, and appends a 16-byte tag', () => {
    const plain = Buffer.from('a document image, pretend');
    const sealed = sealBlob(plain);
    expect(sealed.key).toHaveLength(32);
    expect(sealed.ciphertext.length).toBe(12 + plain.length + 16);
    expect(Buffer.from(sealed.ciphertext).includes(plain)).toBe(false);
    expect(Buffer.from(openBlob(sealed.ciphertext, sealed.key)).equals(plain)).toBe(true);
  });

  it('uses a fresh nonce per call, so the same plain text never gives the same bytes', () => {
    const key = randomBytes(32);
    const plain = Buffer.from('same input');
    const first = sealBlob(plain, key).ciphertext;
    const second = sealBlob(plain, key).ciphertext;
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(false);
  });

  it('refuses a ciphertext altered by one bit, anywhere in it', () => {
    const sealed = sealBlob(Buffer.from('tamper me'));
    for (const index of [0, 13, sealed.ciphertext.length - 1]) {
      const altered = Buffer.from(sealed.ciphertext);
      altered[index] = (altered[index] as number) ^ 0x01;
      expect(() => openBlob(altered, sealed.key)).toThrow();
    }
  });

  it('refuses another key, a truncated ciphertext and a key of the wrong size', () => {
    const sealed = sealBlob(Buffer.from('keyed'));
    expect(() => openBlob(sealed.ciphertext, randomBytes(32))).toThrow();
    expect(() => openBlob(sealed.ciphertext.subarray(0, 20), sealed.key)).toThrow();
    expect(() => sealBlob(Buffer.from('x'), randomBytes(16))).toThrow('32 bytes');
    expect(() => openBlob(sealed.ciphertext, randomBytes(16))).toThrow('32 bytes');
  });

  it('reuses the given key for a second blob of the same submission', () => {
    const key = randomBytes(32);
    const sealed = sealBlob(Buffer.from('front'), key);
    expect(Buffer.from(sealed.key).equals(key)).toBe(true);
    expect(
      Buffer.from(openBlob(sealBlob(Buffer.from('photo'), key).ciphertext, key)).toString(),
    ).toBe('photo');
  });
});

describe('submission blobs and crypto-shredding', () => {
  let h: Harness;
  const PLAIN = Buffer.from('FRONT OF THE DOCUMENT - a distinctive pretend image body 0123456789');

  beforeEach(() => {
    h = harness();
  });
  afterEach(() => {
    h.close();
  });

  function pendingSubmission(verificationId = 'v-blob'): string {
    const started = startVerification(h.state, {
      verificationId,
      subject: { userId: 'user-1', username: 'ana' },
      language: 'pt-BR',
    });
    return started.row.id;
  }

  it('stores an image encrypted and reads it back with the submission key', () => {
    const id = pendingSubmission();
    const meta = storeBlob(h.state.stores, id, {
      role: 'document-front',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1024 * 1024,
    });
    expect(meta.size).toBe(12 + PLAIN.length + 16);
    expect(existsSync(join(h.state.stores.blobDir, meta.fileName))).toBe(true);
    expect(
      Buffer.from(readBlob(h.state.stores, id, 'document-front') as Uint8Array).equals(PLAIN),
    ).toBe(true);
    // The plain image is nowhere on disk.
    expect(bytesContain(h.root, PLAIN)).toBe(false);
  });

  it('refuses an empty image, an oversized one, and one for a submission that no longer takes files', () => {
    const id = pendingSubmission();
    expect(() =>
      storeBlob(h.state.stores, id, {
        role: 'photo',
        plain: new Uint8Array(0),
        contentType: 'image/png',
        maxBytes: 10,
      }),
    ).toThrow(BlobRefused);
    expect(() =>
      storeBlob(h.state.stores, id, {
        role: 'photo',
        plain: PLAIN,
        contentType: 'image/png',
        maxBytes: 10,
      }),
    ).toThrow(BlobRefused);
    h.setNow(h.now() + 1);
    destroySubmission(h.state.stores, id);
    expect(() =>
      storeBlob(h.state.stores, id, {
        role: 'photo',
        plain: PLAIN,
        contentType: 'image/png',
        maxBytes: 1 << 20,
      }),
    ).toThrow(BlobRefused);
  });

  it('replaces the file of a role and removes the old one', () => {
    const id = pendingSubmission();
    const first = storeBlob(h.state.stores, id, {
      role: 'photo',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    const second = storeBlob(h.state.stores, id, {
      role: 'photo',
      plain: Buffer.from('second'),
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    expect(existsSync(join(h.state.stores.blobDir, first.fileName))).toBe(false);
    expect(existsSync(join(h.state.stores.blobDir, second.fileName))).toBe(true);
    expect(Buffer.from(readBlob(h.state.stores, id, 'photo') as Uint8Array).toString()).toBe(
      'second',
    );
  });

  it('makes a copy of the ciphertext useless once the key is destroyed: nothing left on disk can open it', () => {
    const id = pendingSubmission();
    const meta = storeBlob(h.state.stores, id, {
      role: 'document-front',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    const original = join(h.state.stores.blobDir, meta.fileName);

    // A backup of the data taken before the decision: the ciphertext, copied out.
    const backup = join(h.root, 'backup-of-the-blob.bin');
    copyFileSync(original, backup);
    // Positive control: before destruction the blob opens with the key the service holds.
    expect(
      Buffer.from(readBlob(h.state.stores, id, 'document-front') as Uint8Array).equals(PLAIN),
    ).toBe(true);
    const keyBeforeDestruction = h.state.stores.keys.get(id) as Uint8Array;
    expect(Buffer.from(openBlob(readFileSync(backup), keyBeforeDestruction)).equals(PLAIN)).toBe(
      true,
    );

    destroySubmission(h.state.stores, id);

    // The key is gone from the key store and from every byte on disk, the file is overwritten and removed.
    expect(h.state.stores.keys.get(id)).toBeUndefined();
    expect(existsSync(original)).toBe(false);
    expect(bytesContain(h.state.config.keyDir, keyBeforeDestruction)).toBe(false);
    expect(bytesContain(h.root, keyBeforeDestruction)).toBe(false);
    expect(readBlob(h.state.stores, id, 'document-front')).toBeUndefined();
    // The backup copy is still there: it is ciphertext with no key anywhere the service can reach.
    expect(existsSync(backup)).toBe(true);
    expect(h.state.stores.submissions.byId(id)?.blobsJson).toBeNull();
  });

  it('refuses to read a file whose key is gone, even while its metadata still names it', () => {
    const id = pendingSubmission('v-key-gone');
    storeBlob(h.state.stores, id, {
      role: 'photo',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    // The state a crash between the two steps of destruction would leave: key removed, metadata and file still there.
    h.state.stores.keys.delete(id);
    expect(() => readBlob(h.state.stores, id, 'photo')).toThrow(BlobUnreadable);
  });

  it('destroys idempotently: a second run finds nothing and does nothing', () => {
    const id = pendingSubmission();
    storeBlob(h.state.stores, id, {
      role: 'photo',
      plain: PLAIN,
      contentType: 'image/jpeg',
      maxBytes: 1 << 20,
    });
    destroySubmission(h.state.stores, id);
    expect(() => destroySubmission(h.state.stores, id)).not.toThrow();
    expect(() => destroySubmission(h.state.stores, 'no-such-submission')).not.toThrow();
    expect(readdirSync(h.state.stores.blobDir)).toHaveLength(0);
  });
});
