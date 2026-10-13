/**
 * Names and errors of the backup folders. A backup is `BACKUP_DIR/verification-<UTC stamp>/`; while it is being written
 * it sits under a temporary name (`.tmp-verification-<stamp>-<random>/`) and is renamed into place only when complete,
 * so an interrupted run leaves a temporary folder, never a `verification-*` folder that looks whole.
 *
 * Rotation deletes only entries whose names match these patterns, and judges their age by the stamp in the name (not by
 * the file system clock), which keeps it deterministic and keeps it off anything a person put in the folder by hand.
 */

export const BACKUP_PREFIX = 'verification-';
export const TEMP_PREFIX = '.tmp-verification-';
export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
/**
 * A temporary folder older than this belongs to a run that is no longer going: it holds the plain snapshot, so it is not
 * kept for the whole retention. A backup takes minutes, so a day is far past any run in progress.
 */
export const STALE_TEMP_MS = DAY_MS;

const BACKUP_NAME_PATTERN = /^verification-(\d{8}T\d{6}Z)$/;
const TEMP_NAME_PATTERN = /^\.tmp-verification-(\d{8}T\d{6}Z)-[0-9a-f]{8}$/;
const STAMP_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;

/** The file of the data store inside a backup folder: gzipped `VACUUM INTO` copy. */
export const SNAPSHOT_FILE = 'data.sqlite.gz';
export const BLOBS_DIR = 'blobs';

/** One refusal or failure of a backup, with a message that carries no personal data. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/** `20261012T120000Z` for the given instant (UTC, to the second). */
export function stampOf(now: number): string {
  return new Date(now).toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
}

/** The instant a stamp names, or `undefined` when the text is not a stamp (or names no real date). */
export function timeOfStamp(stamp: string): number | undefined {
  const match = STAMP_PATTERN.exec(stamp);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  const time = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  // Date.UTC rolls an impossible date (the 31st of April) into the next month: a round trip catches it.
  return stampOf(time) === stamp ? time : undefined;
}

export function backupNameFor(now: number): string {
  return `${BACKUP_PREFIX}${stampOf(now)}`;
}

/**
 * The instant an entry of the backup folder was made, when its name is one of ours (a finished backup or a temporary
 * folder of one). `undefined` for anything else: a foreign file, a near miss, a name with a bad date.
 */
export function ownedEntryTime(name: string): number | undefined {
  const match = BACKUP_NAME_PATTERN.exec(name) ?? TEMP_NAME_PATTERN.exec(name);
  return match?.[1] === undefined ? undefined : timeOfStamp(match[1]);
}

/** The label of a failure for the log: the message of our own errors, otherwise only a code or a name. */
export function errorLabel(error: unknown): string {
  if (error instanceof BackupError) return error.message;
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return 'unknown error';
}
