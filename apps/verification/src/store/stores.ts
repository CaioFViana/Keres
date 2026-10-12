import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { VerificationConfig } from '../config';
import { AuditLog } from './audit';
import { KeyStore } from './keyStore';
import { DATA_PRAGMAS, DATA_SCHEMA, KEY_PRAGMAS, KEY_SCHEMA } from './schema';
import { SubmissionStore } from './submissions';
import { EventOutbox } from './outbox';
import { ReviewerStore, SessionStore } from './reviewers';
import { type Database, openDatabase } from './sql';

/** Every store the service uses, opened on the configured directories. */
export interface Stores {
  /** `DATA_DIR/data.sqlite`: everything but the keys. */
  data: Database;
  /** `KEY_DIR/keys.sqlite`: the data keys only. */
  keys: KeyStore;
  keyDatabase: Database;
  submissions: SubmissionStore;
  audit: AuditLog;
  reviewers: ReviewerStore;
  sessions: SessionStore;
  outbox: EventOutbox;
  /** `DATA_DIR/blobs`: the encrypted images, one random file name each. */
  blobDir: string;
  close(): void;
}

export function openStores(config: Pick<VerificationConfig, 'dataDir' | 'keyDir'>): Stores {
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  mkdirSync(config.keyDir, { recursive: true, mode: 0o700 });
  const blobDir = join(config.dataDir, 'blobs');
  mkdirSync(blobDir, { recursive: true, mode: 0o700 });

  const data = openDatabase(join(config.dataDir, 'data.sqlite'), DATA_PRAGMAS, DATA_SCHEMA);
  const keyDatabase = openDatabase(join(config.keyDir, 'keys.sqlite'), KEY_PRAGMAS, KEY_SCHEMA);
  return {
    data,
    keys: new KeyStore(keyDatabase),
    keyDatabase,
    submissions: new SubmissionStore(data),
    audit: new AuditLog(data),
    reviewers: new ReviewerStore(data),
    sessions: new SessionStore(data),
    outbox: new EventOutbox(data),
    blobDir,
    close(): void {
      data.close();
      keyDatabase.close();
    },
  };
}
