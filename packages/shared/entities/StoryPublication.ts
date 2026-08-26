/**
 * A public version of a story (a "publication"): an immutable, already-packaged bundle that the
 * Showcase offers for download.
 *
 * Deliberately outside the synchronization engine - it has no `version`, no `isDeleted` and no
 * entry in the operation log. It is tracked separately, the same way friendship already is.
 */
export interface StoryPublication {
  id: string;
  storyId: string;
  /** The story's owner at the moment of publication (`stories.userId`). */
  ownerUserId: string;
  /** The version name shown on the site. Its format depends on the chosen `PublicationLabelMode`. */
  label: string;
  /** `stories.lastOperationVersion` at the instant of publication. */
  operationVersion: number;
  /** `CURRENT_STORY_FORMAT_VERSION` at the instant of publication. */
  formatVersion: number;
  /** Tamanho do .zip em bytes. */
  byteSize: number;
  /** How many media files went into the package, out of how many the story references. */
  mediaIncluded: number;
  mediaTotal: number;
  createdAt: Date;
}

/**
 * The story's fields frozen at the moment of publication. The site describes the version that was
 * published, not the story as it stands today - hence the copy rather than a join.
 */
export interface StoryPublicationSnapshot {
  title: string;
  description: string | null;
  genre: string | null;
  language: string | null;
  author: string | null;
  type: 'linear' | 'branching';
  theme: string | null;
}

/** How the owner wants the versions to be named. */
export type PublicationLabelMode = 'version' | 'date' | 'both';

/** `public` shows up in the site's list; `password` only opens for whoever has the password. */
export type ShowcaseVisibility = 'public' | 'password';
