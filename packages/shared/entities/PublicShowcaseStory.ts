import type { ManuscriptInfo, ReaderInfo } from '../manuscript/compile/manuscriptContracts';
import type { StoryPublicationArcSnapshot, StoryPublicationSnapshot } from './StoryPublication';

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
  /** The work this version releases, or `null` for a version of the whole universe. */
  arc: StoryPublicationArcSnapshot | null;
  label: string;
  byteSize: number;
  mediaIncluded: number;
  mediaTotal: number;
  createdAt: string;
  /**
   * Whether the story package (.zip) was published. A version may carry only a manuscript and/or the
   * online reader, in which case `byteSize` is 0 and there is no package to download.
   */
  packageIncluded: boolean;
  /** The version's manuscript rendition, when one was published alongside it. */
  manuscript: ManuscriptInfo | null;
  /** The version's online reader page, when one was published alongside it. */
  reader: ReaderInfo | null;
}

/** A card on the Showcase's home page. */
export interface ShowcaseStoryCard {
  storyId: string;
  /**
   * Whether the story is flagged adults-only right now. Anonymous viewers never see such cards;
   * signed-in verified adults do, and the badge tells them why the card exists for them.
   */
  isNsfw: boolean;
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
