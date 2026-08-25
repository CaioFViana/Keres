import type { StoryPublicationSnapshot } from './StoryPublication';

/** The author, as the anonymous site can see them: no email, no internal id beyond the public one. */
export interface ShowcaseOwner {
  username: string;
  tag: string;
  avatarColor: string | null;
  avatarIcon: string | null;
}

/** A downloadable version, as the site lists it. */
export interface ShowcaseVersion {
  id: string;
  label: string;
  byteSize: number;
  mediaIncluded: number;
  mediaTotal: number;
  createdAt: string;
}

/** A card on the Showcase's home page. */
export interface ShowcaseStoryCard {
  storyId: string;
  snapshot: StoryPublicationSnapshot;
  owner: ShowcaseOwner;
  versionCount: number;
  latestVersion: ShowcaseVersion;
  updatedAt: string;
}

/** A story's page. */
export interface ShowcaseStoryDetail {
  storyId: string;
  snapshot: StoryPublicationSnapshot;
  owner: ShowcaseOwner;
  versions: ShowcaseVersion[];
  updatedAt: string;
}

/**
 * What a password-protected story answers before the unlock. Only this - no title, no author, no
 * count of versions: a leaked link must not be interesting on its own.
 */
export interface ShowcaseProtectedStub {
  storyId: string;
  protected: true;
}

export type ShowcaseStoryResponse = ShowcaseStoryDetail | ShowcaseProtectedStub;

export function isProtectedStub(value: ShowcaseStoryResponse): value is ShowcaseProtectedStub {
  return (value as ShowcaseProtectedStub).protected === true;
}
