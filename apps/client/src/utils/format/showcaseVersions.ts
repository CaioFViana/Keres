import type { ShowcaseVersion, StoryPublicationArcSnapshot } from '@keres/shared';

/** The versions of one work of a story, or of the whole universe (`arc` is null). */
export interface ShowcaseVersionGroup {
  key: string;
  arc: StoryPublicationArcSnapshot | null;
  versions: ShowcaseVersion[];
}

/**
 * The versions of a story the way its public page lists them: the whole universe first, then each work in the
 * order it first appears, and the versions inside a group in the order the server sent them (newest first).
 */
export function groupShowcaseVersions(
  versions: readonly ShowcaseVersion[],
): ShowcaseVersionGroup[] {
  const groups = new Map<string, ShowcaseVersionGroup>();
  for (const version of versions) {
    const arc = version.arc ?? null;
    const key = arc ? arc.id : '';
    const group = groups.get(key) ?? { key, arc, versions: [] };
    group.versions.push(version);
    groups.set(key, group);
  }
  const all = [...groups.values()];
  return [
    ...all.filter((group) => group.arc === null),
    ...all.filter((group) => group.arc !== null),
  ];
}
