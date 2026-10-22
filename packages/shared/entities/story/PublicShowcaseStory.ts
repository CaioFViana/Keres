import type { ProfileLink } from '../accounts/PublicProfile';
import type { ManuscriptInfo, ReaderInfo } from '../../manuscript/compile/manuscriptContracts';
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
  /**
   * The work this version releases, or `null` for a version of the whole universe. Absent from
   * servers that predate releases of one work (read as `null`).
   */
  arc?: StoryPublicationArcSnapshot | null;
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
  /** The story has a cover the site can show: it is served at `/stories/:storyId/cover`. */
  hasCover?: boolean;
  updatedAt: string;
}

/** A story's page. */
export interface ShowcaseStoryDetail {
  storyId: string;
  snapshot: StoryPublicationSnapshot;
  owner: ShowcaseOwner;
  versions: ShowcaseVersion[];
  /** The story has a cover the site can show: it is served at `/stories/:storyId/cover`. */
  hasCover?: boolean;
  /**
   * The works (arc ids) of this story that have a cover the site can show: it is served at
   * `/stories/:storyId/works/:arcId/cover`. Absent from servers that predate work covers.
   */
  workCovers?: string[];
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

/** A value of a filter and how many visible stories carry it. */
export interface ShowcaseFacet {
  value: string;
  count: number;
}

/**
 * What the site can filter by, counted over the stories this viewer may see: genres and languages as the
 * authors wrote them (merged ignoring case and accents), the mediums of the released works, and the structures.
 */
export interface ShowcaseFacets {
  genres: ShowcaseFacet[];
  languages: ShowcaseFacet[];
  mediums: ShowcaseFacet[];
  types: ShowcaseFacet[];
}

/** An author in the site's directory: the account that published, with how much of its work is on show. */
export interface ShowcaseAuthorCard {
  owner: ShowcaseOwner;
  storyCount: number;
  /** When the author last published or removed something. */
  updatedAt: string;
}

/**
 * An author's page: who they are in their own words, and what they have published. The texts are the ones
 * written on purpose for this page (`OwnPublicProfile`) - never the short bio friends see.
 */
export interface ShowcaseAuthorPage {
  owner: ShowcaseOwner;
  biography: string | null;
  links: ProfileLink[];
  /** The palette the page is tinted with; `null` takes the site's own. */
  theme: string | null;
  stories: ShowcaseStoryCard[];
  updatedAt: string;
}
