import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption of what a person sends (document images, the live photo), one random data key per submission.
 *
 * AES-256-GCM with a random 96-bit nonce per call, stored as `nonce || ciphertext || tag`. GCM authenticates: a
 * ciphertext changed on disk is refused by `openBlob`, never decrypted into garbage. The key does not live beside
 * the ciphertext: it is in the key store (see `store/keyStore.ts`), and destroying that row is what makes every copy
 * of the ciphertext unreadable (crypto-shredding).
 */

const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export interface SealedBlob {
  /** `nonce || encrypted || tag`. */
  ciphertext: Uint8Array;
  /** The data key. The caller stores it in the key store and nowhere else. */
  key: Uint8Array;
}

/**
 * Encrypts `plain`. Without `key` a fresh data key is generated: that is the first blob of a submission. Later blobs of
 * the same submission pass the submission's key, so one key stays the one that is destroyed.
 */
export function sealBlob(plain: Uint8Array, key: Uint8Array = randomBytes(KEY_BYTES)): SealedBlob {
  if (key.length !== KEY_BYTES) throw new Error('A data key is 32 bytes.');
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([nonce, encrypted, tag]), key };
}

/** Decrypts a blob sealed by `sealBlob`. Throws when the key is wrong or the bytes were altered. */
export function openBlob(ciphertext: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length !== KEY_BYTES) throw new Error('A data key is 32 bytes.');
  if (ciphertext.length < NONCE_BYTES + TAG_BYTES) throw new Error('Ciphertext too short.');
  const bytes = Buffer.from(ciphertext);
  const nonce = bytes.subarray(0, NONCE_BYTES);
  const tag = bytes.subarray(bytes.length - TAG_BYTES);
  const encrypted = bytes.subarray(NONCE_BYTES, bytes.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/** A fresh data key, for a submission created before anything is sent. */
export const newDataKey = (): Uint8Array => randomBytes(KEY_BYTES);
