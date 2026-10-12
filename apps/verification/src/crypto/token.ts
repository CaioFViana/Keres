import { createHash, randomBytes } from 'node:crypto';

/**
 * The one-time upload token that opens a person's upload page (`/v/<token>`). 256 random bits, shown once in the URL,
 * and only its SHA-256 is kept: a copy of the database opens no upload page.
 */

export interface UploadToken {
  /** What goes in the URL. Never stored. */
  token: string;
  /** What is stored. */
  hash: string;
}

export function newUploadToken(): UploadToken {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashUploadToken(token) };
}

export const hashUploadToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
