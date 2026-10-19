import { randomUUID } from 'node:crypto';
import type { Database } from './sql';
import { one, run } from './sql';

/**
 * Reviewer accounts and their sessions. A password is never stored: the row holds the scrypt hash
 * (`crypto/password.ts`). A session is held by the hash of its cookie token, so a copied database opens no session.
 */

export interface ReviewerRow {
  id: string;
  name: string;
  passwordHash: string;
  createdAt: number;
}

interface RawReviewer {
  id: string;
  name: string;
  password_hash: string;
  created_at: number;
}

export class ReviewerStore {
  constructor(private readonly db: Database) {}

  /** Adds a reviewer and returns the id. A name taken by another reviewer throws (the column is unique). */
  add(name: string, passwordHash: string, now: number): string {
    const id = randomUUID();
    run(
      this.db,
      'INSERT INTO reviewers (id, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
      id,
      name,
      passwordHash,
      now,
    );
    return id;
  }

  byName(name: string): ReviewerRow | undefined {
    const raw = one<RawReviewer>(
      this.db,
      'SELECT id, name, password_hash, created_at FROM reviewers WHERE name = ?',
      name,
    );
    return raw && toReviewer(raw);
  }

  byId(id: string): ReviewerRow | undefined {
    const raw = one<RawReviewer>(
      this.db,
      'SELECT id, name, password_hash, created_at FROM reviewers WHERE id = ?',
      id,
    );
    return raw && toReviewer(raw);
  }
}

function toReviewer(raw: RawReviewer): ReviewerRow {
  return {
    id: raw.id,
    name: raw.name,
    passwordHash: raw.password_hash,
    createdAt: raw.created_at,
  };
}

export interface SessionRow {
  reviewerId: string;
  expiresAt: number;
}

export class SessionStore {
  constructor(private readonly db: Database) {}

  create(tokenHash: string, reviewerId: string, now: number, expiresAt: number): void {
    run(
      this.db,
      'INSERT INTO sessions (token_hash, reviewer_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      tokenHash,
      reviewerId,
      now,
      expiresAt,
    );
  }

  /** The session a cookie token opens, or undefined when it is unknown or past its end. */
  find(tokenHash: string, now: number): SessionRow | undefined {
    const raw = one<{ reviewer_id: string; expires_at: number }>(
      this.db,
      'SELECT reviewer_id, expires_at FROM sessions WHERE token_hash = ?',
      tokenHash,
    );
    if (!raw || raw.expires_at <= now) return undefined;
    return { reviewerId: raw.reviewer_id, expiresAt: raw.expires_at };
  }

  delete(tokenHash: string): void {
    run(this.db, 'DELETE FROM sessions WHERE token_hash = ?', tokenHash);
  }
}
