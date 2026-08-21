/**
 * Uma versão pública de uma história ("publicação"): um pacote imutável, já empacotado, que
 * o Showcase oferece para download.
 *
 * Deliberadamente fora do motor de sincronização - não tem `version`, `isDeleted` nem
 * entrada no log de operações. É rastreado por fora, do mesmo jeito que amizade já é.
 */
export interface StoryPublication {
  id: string;
  storyId: string;
  /** Dono da história no momento da publicação (`stories.userId`). */
  ownerUserId: string;
  /** Nome da versão exibido no site. Formato depende do `PublicationLabelMode` escolhido. */
  label: string;
  /** `stories.lastOperationVersion` no instante da publicação. */
  operationVersion: number;
  /** `CURRENT_STORY_FORMAT_VERSION` no instante da publicação. */
  formatVersion: number;
  /** Tamanho do .zip em bytes. */
  byteSize: number;
  /** Quantas mídias entraram no pacote, de quantas a história referencia. */
  mediaIncluded: number;
  mediaTotal: number;
  createdAt: Date;
}

/**
 * Os campos da história congelados no momento da publicação. O site descreve a versão que
 * foi publicada, não a história como ela está hoje - por isso a cópia, e não um join.
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

/** Como o dono quer que as versões sejam nomeadas. */
export type PublicationLabelMode = 'version' | 'date' | 'both';

/** `public` aparece na lista do site; `password` só abre para quem tem a senha. */
export type ShowcaseVisibility = 'public' | 'password';
