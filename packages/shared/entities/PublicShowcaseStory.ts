import type { StoryPublicationSnapshot } from './StoryPublication';

/** O autor, como o site anônimo pode vê-lo: nada de e-mail, nada de id interno além do público. */
export interface ShowcaseOwner {
  username: string;
  tag: string;
  avatarColor: string | null;
  avatarIcon: string | null;
}

/** Uma versão baixável, como o site a lista. */
export interface ShowcaseVersion {
  id: string;
  label: string;
  byteSize: number;
  mediaIncluded: number;
  mediaTotal: number;
  createdAt: string;
}

/** Um card na página inicial do Showcase. */
export interface ShowcaseStoryCard {
  storyId: string;
  snapshot: StoryPublicationSnapshot;
  owner: ShowcaseOwner;
  versionCount: number;
  latestVersion: ShowcaseVersion;
  updatedAt: string;
}

/** A página de uma história. */
export interface ShowcaseStoryDetail {
  storyId: string;
  snapshot: StoryPublicationSnapshot;
  owner: ShowcaseOwner;
  versions: ShowcaseVersion[];
  updatedAt: string;
}

/**
 * O que uma história protegida por senha responde antes do unlock. Só isso - nem título, nem
 * autor, nem quantas versões existem: um link vazado não pode ser interessante por si só.
 */
export interface ShowcaseProtectedStub {
  storyId: string;
  protected: true;
}

export type ShowcaseStoryResponse = ShowcaseStoryDetail | ShowcaseProtectedStub;

export function isProtectedStub(value: ShowcaseStoryResponse): value is ShowcaseProtectedStub {
  return (value as ShowcaseProtectedStub).protected === true;
}
