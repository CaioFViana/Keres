import { describe, expect, it } from 'vitest';
import { CURRENT_PACK_FORMAT_VERSION } from '../../metadata/ReleaseVersions';
import { migratePackContent, PackContentVersionError } from '../../schemas/packContentMigrations';

const EMPTY_EXTRAS = {
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
};

describe('migratePackContent', () => {
  it('adds empty extras to a v1 payload without changing the source object', () => {
    const v1 = { formatVersion: 1, tags: [] };
    const migrated = migratePackContent(v1);

    expect(migrated).toMatchObject({
      formatVersion: CURRENT_PACK_FORMAT_VERSION,
      extras: EMPTY_EXTRAS,
    });
    expect(v1).toEqual({ formatVersion: 1, tags: [] });
  });

  it('treats a payload without a version as pre-versioning and migrates it', () => {
    const migrated = migratePackContent({ tags: [] });

    expect(migrated).toMatchObject({
      formatVersion: CURRENT_PACK_FORMAT_VERSION,
      extras: EMPTY_EXTRAS,
    });
  });

  it('keeps carried extras untouched', () => {
    const chapter = { id: 'ch-1' };
    const migrated = migratePackContent({
      formatVersion: 1,
      extras: { ...EMPTY_EXTRAS, chapters: [chapter] },
    });

    expect(migrated.extras.chapters).toEqual([chapter]);
  });

  it('refuses a payload newer than this app supports', () => {
    expect(() => migratePackContent({ formatVersion: CURRENT_PACK_FORMAT_VERSION + 1 })).toThrow(
      PackContentVersionError,
    );
  });
});
