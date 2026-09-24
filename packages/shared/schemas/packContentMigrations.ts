import { CURRENT_PACK_FORMAT_VERSION } from '../metadata/ReleaseVersions';

/**
 * A pack whose `formatVersion` is greater than this app supports - the person installing is on an
 * older version of Keres than whoever extracted it.
 */
export class PackContentVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackContentVersionError';
  }
}

type PackContentMigration = {
  fromVersion: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pre-validation JSON: unshaped until the schema parses it, so narrowing here only adds casts.
  migrate: (data: any) => any;
};

/**
 * V1 -> V2
 *
 * V2 adds `extras`: element skeletons (chapters, scenes, characters, locations, world rules,
 * notes, boards, location maps, and their join rows) carried alongside the schema. A v1 payload
 * is a v2 payload with nothing extra in it, so the migration only fills the absent key - every
 * inner collection already defaults to `[]`, and the schema tolerates the missing key either way.
 */
const migrateV1ToV2: PackContentMigration = {
  fromVersion: 1,
  migrate: (data) => ({
    ...data,
    extras:
      data?.extras && typeof data.extras === 'object'
        ? data.extras
        : {
            chapters: [],
            scenes: [],
            characters: [],
            locations: [],
            worldRules: [],
            notes: [],
            storyBoards: [],
            storyLocationMaps: [],
            characterScenes: [],
            characterRelations: [],
            locationRelations: [],
            noteRelations: [],
            tagRelations: [],
          },
  }),
};

const migrations: PackContentMigration[] = [migrateV1ToV2];

/**
 * Brings a raw pack content payload to the current format before validation, mirroring
 * `migrateStoryExport`.
 *
 * Payloads without a version predate versioning and are treated as version 0. It must run before
 * `PackContentSchema.parse()`: zod would otherwise silently strip the unknown keys and install a
 * pack missing pieces its author meant to be there.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pre-validation JSON: unshaped until the schema parses it, so narrowing here only adds casts.
export function migratePackContent(raw: any): any {
  const version = typeof raw?.formatVersion === 'number' ? raw.formatVersion : 0;
  if (version > CURRENT_PACK_FORMAT_VERSION) {
    throw new PackContentVersionError(
      `This pack was created by a newer version of Keres (format ${version}) than this app supports (format ${CURRENT_PACK_FORMAT_VERSION}).`,
    );
  }

  let data = raw;
  for (const migration of migrations
    .filter((m) => m.fromVersion >= version)
    .sort((a, b) => a.fromVersion - b.fromVersion)) {
    data = migration.migrate(data);
  }

  return { ...data, formatVersion: CURRENT_PACK_FORMAT_VERSION };
}
