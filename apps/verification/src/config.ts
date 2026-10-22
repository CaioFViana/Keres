import { isAbsolute, relative, resolve, sep } from 'node:path';
import { VERIFIER_ID_PATTERN } from '@keres/shared';

/**
 * Environment of the reference age-verification service. The same discipline as the payments service: secrets are at
 * least 32 characters, the directions use different keys, anything leaving loopback goes over https, and the
 * identity keys live apart from the data they protect (see `docs/compliance/age_verification.md`, "The reference service").
 *
 * Every problem is collected and reported together: an operator fixing one variable at a time is an operator who
 * starts the service half-configured.
 */

export const MIN_SECRET_LENGTH = 32;
export const DEFAULT_PORT = 3102;
export const DEFAULT_SUBMISSION_TTL_DAYS = 30;
/** One image (a document side or the live photo). Generous for a phone photo, small enough to refuse abuse. */
export const DEFAULT_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES_LIMIT = 64 * 1024 * 1024;
/**
 * Daily copies are kept this many days. A monthly copy is removed 93 days after its month began (MONTHLY_MAX_AGE_DAYS).
 * 90 is the ceiling, as for the Postgres dumps: longer needs a written justification.
 */
export const DEFAULT_BACKUP_RETENTION_DAYS = 30;
export const MAX_BACKUP_RETENTION_DAYS = 90;
const MAX_BACKUP_RETENTION_DAYS_LIMIT = 3650;
/** The newest monthly copies kept (one per calendar month). 0 keeps none; more than 3 is refused. */
export const DEFAULT_BACKUP_MONTHLY_KEEP = 3;
export const MAX_BACKUP_MONTHLY_KEEP = 3;
export const DEFAULT_BACKUP_INTERVAL_HOURS = 24;
/** Node's timers overflow past about 24.8 days: a longer interval would fire at once instead of waiting. */
const MAX_BACKUP_INTERVAL_HOURS = 480;

export interface VerificationConfig {
  port: number;
  host: string;
  /** Stable id the service answers with on `/v1/info` (kept with every verification). */
  serviceId: string;
  displayName: string;
  /** Our own public address, without a trailing slash. The upload page is `${publicUrl}/v/<token>`. */
  publicUrl: string;
  /** Where the outbox POSTs the events (the Keres server's events endpoint). */
  keresEventsUrl: string;
  /** What Keres signs its calls with: the current key first, the previous one only while rotating. */
  keresSecrets: string[];
  /** What the event pushes are signed with. Never one of the Keres keys. */
  eventsSecret: string;
  /** The HMAC key of the identity commitment. Outside every database and backup, by design. */
  commitmentKey: string;
  dataDir: string;
  keyDir: string;
  submissionTtlDays: number;
  maxUploadBytes: number;
  /** Allows plain http for the public address and the Keres events address when they are not loopback. */
  allowInsecure: boolean;
  /** Where the backups go. Unset means backups are off. Never inside or around DATA_DIR or KEY_DIR. */
  backupDir: string | undefined;
  backupRetentionDays: number;
  /** How many monthly copies (one per calendar month) are kept, newest first. 0 means none. */
  backupMonthlyKeep: number;
  /** Lets the retention go past the 90-day ceiling. Set only with a written justification. */
  backupAllowLongerRetention: boolean;
  backupIntervalHours: number;
}

/** The configuration does not load. `problems` lists every reason, one per entry. */
export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid verification configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

type Env = NodeJS.ProcessEnv;

function isLoopbackUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

/** `true` when `child` is `parent` or lies inside it. Compared on resolved absolute paths. */
export function isSameOrInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!isAbsolute(rel) && rel.split(sep)[0] !== '..');
}

/** Two paths name the same directory. Windows file names are case-insensitive, so compare them that way there. */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
  return norm(resolve(a)) === norm(resolve(b));
}

export function loadConfig(env: Env = process.env): VerificationConfig {
  const problems: string[] = [];
  const allowInsecure = env['ALLOW_INSECURE'] === 'true';

  const required = (name: string): string => {
    const value = env[name];
    if (!value) {
      problems.push(`${name} is required.`);
      return '';
    }
    return value;
  };
  const secretOf = (name: string, value: string | undefined): string => {
    if (value === undefined) return '';
    if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters.`);
    }
    return value;
  };
  const integer = (name: string, fallback: number, min: number, max: number): number => {
    const text = env[name];
    if (text === undefined || text === '') return fallback;
    const value = Number(text);
    if (!/^\d+$/.test(text) || value < min || value > max) {
      problems.push(`${name} must be a whole number from ${min} to ${max}.`);
      return fallback;
    }
    return value;
  };
  const publicUrl = (name: string, value: string): string => {
    if (!value) return '';
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      problems.push(`${name} is not a URL.`);
      return '';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      problems.push(`${name} must be an http or https address.`);
      return '';
    }
    if (url.protocol === 'http:' && !isLoopbackUrl(url) && !allowInsecure) {
      problems.push(
        `${name} must be https (loopback is allowed; ALLOW_INSECURE=true allows plain http elsewhere).`,
      );
    }
    return value.replace(/\/+$/, '');
  };

  const current = secretOf(
    'AGE_VERIFICATION_SECRET',
    required('AGE_VERIFICATION_SECRET') || undefined,
  );
  const previous = env['AGE_VERIFICATION_SECRET_PREVIOUS']
    ? secretOf('AGE_VERIFICATION_SECRET_PREVIOUS', env['AGE_VERIFICATION_SECRET_PREVIOUS'])
    : undefined;
  const eventsSecret = secretOf(
    'AGE_VERIFICATION_EVENTS_SECRET',
    required('AGE_VERIFICATION_EVENTS_SECRET') || undefined,
  );
  const commitmentKey = secretOf('COMMITMENT_KEY', required('COMMITMENT_KEY') || undefined);

  // The three keys must be three different secrets: a leak of one must never open the other direction, and a
  // commitment key shared with a signing key would tie the two uses together.
  const keyNames: [string, string][] = [
    ['AGE_VERIFICATION_SECRET', current],
    ...(previous !== undefined
      ? [['AGE_VERIFICATION_SECRET_PREVIOUS', previous] as [string, string]]
      : []),
    ['AGE_VERIFICATION_EVENTS_SECRET', eventsSecret],
    ['COMMITMENT_KEY', commitmentKey],
  ];
  for (let i = 0; i < keyNames.length; i += 1) {
    for (let j = i + 1; j < keyNames.length; j += 1) {
      const [nameA, valueA] = keyNames[i] as [string, string];
      const [nameB, valueB] = keyNames[j] as [string, string];
      if (valueA && valueA === valueB) problems.push(`${nameA} and ${nameB} must differ.`);
    }
  }

  const dataDir = resolve(env['DATA_DIR'] || './data');
  const keyDir = resolve(env['KEY_DIR'] || './keys');
  if (samePath(dataDir, keyDir)) {
    problems.push('DATA_DIR and KEY_DIR must be different directories.');
  } else if (isSameOrInside(keyDir, dataDir)) {
    problems.push(
      'KEY_DIR must not be inside DATA_DIR: a backup of the data would then carry the keys that make it unreadable.',
    );
  }

  const serviceId = env['SERVICE_ID'] || 'keres-manual';
  if (!VERIFIER_ID_PATTERN.test(serviceId)) {
    problems.push('SERVICE_ID must be 1-32 lower-case letters, digits, "-" or "_".');
  }
  const displayName = (env['DISPLAY_NAME'] || 'Keres manual verification').trim();
  if (displayName.length < 1 || displayName.length > 80) {
    problems.push('DISPLAY_NAME must be 1-80 characters.');
  }

  // Backups copy the data store (never the keys) to a folder of their own. A backup folder beside or inside the data
  // or the keys would be one more place the keys could be swept up with, so it may not touch either directory.
  const backupDir = env['BACKUP_DIR'] ? resolve(env['BACKUP_DIR']) : undefined;
  if (backupDir !== undefined) {
    for (const [name, dir] of [
      ['DATA_DIR', dataDir],
      ['KEY_DIR', keyDir],
    ] as const) {
      if (isSameOrInside(backupDir, dir) || isSameOrInside(dir, backupDir)) {
        problems.push(
          `BACKUP_DIR must not be, contain or be inside ${name}: backups must stay apart from the data and the keys.`,
        );
      }
    }
  }
  const backupAllowLongerRetention = env['BACKUP_ALLOW_LONGER_RETENTION'] === 'true';
  const backupRetentionDays = integer(
    'BACKUP_RETENTION_DAYS',
    DEFAULT_BACKUP_RETENTION_DAYS,
    1,
    MAX_BACKUP_RETENTION_DAYS_LIMIT,
  );
  if (backupRetentionDays > MAX_BACKUP_RETENTION_DAYS && !backupAllowLongerRetention) {
    problems.push(
      `BACKUP_RETENTION_DAYS must be at most ${MAX_BACKUP_RETENTION_DAYS}: a longer retention needs BACKUP_ALLOW_LONGER_RETENTION=true and a written justification.`,
    );
  }

  const config: VerificationConfig = {
    port: integer('PORT', DEFAULT_PORT, 1, 65535),
    host: env['HOST'] || '127.0.0.1',
    serviceId,
    displayName,
    publicUrl: publicUrl('PUBLIC_URL', required('PUBLIC_URL')),
    keresEventsUrl: publicUrl('KERES_EVENTS_URL', required('KERES_EVENTS_URL')),
    keresSecrets: previous !== undefined ? [current, previous] : [current],
    eventsSecret,
    commitmentKey,
    dataDir,
    keyDir,
    submissionTtlDays: integer('SUBMISSION_TTL_DAYS', DEFAULT_SUBMISSION_TTL_DAYS, 1, 365),
    maxUploadBytes: integer(
      'MAX_UPLOAD_BYTES',
      DEFAULT_MAX_UPLOAD_BYTES,
      1,
      MAX_UPLOAD_BYTES_LIMIT,
    ),
    allowInsecure,
    backupDir,
    backupRetentionDays,
    backupMonthlyKeep: integer(
      'BACKUP_MONTHLY_KEEP',
      DEFAULT_BACKUP_MONTHLY_KEEP,
      0,
      MAX_BACKUP_MONTHLY_KEEP,
    ),
    backupAllowLongerRetention,
    backupIntervalHours: integer(
      'BACKUP_INTERVAL_HOURS',
      DEFAULT_BACKUP_INTERVAL_HOURS,
      1,
      MAX_BACKUP_INTERVAL_HOURS,
    ),
  };
  if (problems.length > 0) throw new ConfigError(problems);
  return config;
}

/** What the boot log says about a configuration that loads but is not what a public operator should run. */
export function configWarnings(config: VerificationConfig): string[] {
  const warnings: string[] = [];
  if (config.allowInsecure) {
    warnings.push('ALLOW_INSECURE=true: plain http is accepted for non-loopback addresses.');
  }
  if (config.keresSecrets.length > 1) {
    warnings.push(
      'AGE_VERIFICATION_SECRET_PREVIOUS is set: remove it once every Keres server has the new key.',
    );
  }
  if (config.backupDir === undefined) {
    warnings.push('BACKUP_DIR is not set: backups are off. The data store is not backed up.');
  }
  if (config.backupRetentionDays > MAX_BACKUP_RETENTION_DAYS) {
    warnings.push(
      `BACKUP_RETENTION_DAYS is ${config.backupRetentionDays}, past the ${MAX_BACKUP_RETENTION_DAYS}-day ceiling (BACKUP_ALLOW_LONGER_RETENTION=true).`,
    );
  }
  return warnings;
}
