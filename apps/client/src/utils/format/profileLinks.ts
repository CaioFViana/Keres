import { isPublicWebUrl, type ProfileLink } from '@keres/shared';

/** A link row of the author-page form, as typed: either field may still be empty. */
export interface LinkDraft {
  label: string;
  url: string;
}

/**
 * "example.com/me" is what people type; the page needs an address. A missing scheme becomes `https://`, whatever
 * is already there (an `http://`, or a `javascript:` the server will refuse) is left for the check to judge.
 */
export function withScheme(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

export type LinkProblem = { index: number; field: 'label' | 'url' };

/**
 * The links the form may send: rows left completely empty are dropped, the others get their address
 * completed and are checked the way the server checks them. The first thing wrong is named (its row and field) so
 * the form can say where, and nothing is sent when anything is.
 */
export function cleanLinkDrafts(drafts: readonly LinkDraft[]): {
  links: ProfileLink[];
  problem: LinkProblem | null;
} {
  const links: ProfileLink[] = [];
  for (const [index, draft] of drafts.entries()) {
    const label = draft.label.trim();
    const url = withScheme(draft.url);
    if (!label && !url) continue;
    if (!label) return { links, problem: { index, field: 'label' } };
    if (!isPublicWebUrl(url)) return { links, problem: { index, field: 'url' } };
    links.push({ label, url });
  }
  return { links, problem: null };
}
