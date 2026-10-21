/** A link on an author's public page: a label the author wrote and a web address. */
export interface ProfileLink {
  label: string;
  url: string;
}

/**
 * What an author chose to say about themselves on the showcase's author page. Apart from `UserPublicInfo.bio`
 * (the short line friends see): nothing here reaches anyone but whoever opens the public page, and only once the
 * author has published a story.
 */
export interface OwnPublicProfile {
  /** A longer text than the bio, plain text with line breaks. `null` until the author writes one. */
  biography: string | null;
  /** Where else to find the author's work or plans (a site, a store, a social profile), in the author's order. */
  links: ProfileLink[];
  /** The key of a named palette (`themes` in `theme/palettes`) the author page is tinted with; `null` takes the site's own. */
  theme: string | null;
}
