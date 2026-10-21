import type { ShowcaseAuthorPage, ShowcaseAuthorQuery } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { loadCatalog } from './showcaseCatalog';
import { type AuthorPage, authorsOf } from './showcaseSearch';

/**
 * The authors of the public site: the accounts behind the published stories, and the page each one wrote for itself.
 *
 * An account is an author only while something of theirs is on show to this viewer: no stories, or only adults-only
 * ones for someone who may not see them, and the page answers like an account that does not exist. The page's texts
 * (biography, links, theme) are the ones written for it - never the short bio friends see.
 */
export class ShowcaseAuthorService {
  async listAuthors(includeNsfw: boolean, query: ShowcaseAuthorQuery): Promise<AuthorPage> {
    return authorsOf(await loadCatalog(includeNsfw), query);
  }

  async getAuthorPage(username: string, includeNsfw: boolean): Promise<ShowcaseAuthorPage | null> {
    const catalog = await loadCatalog(includeNsfw, { ownerUsername: username });
    const [first] = catalog;
    if (!first) {
      return null;
    }
    const profile = await db.query.users.findFirst({
      where: eq(users.id, first.ownerUserId),
      columns: { profileBiography: true, profileLinks: true, profileTheme: true },
    });
    return {
      owner: first.card.owner,
      biography: profile?.profileBiography ?? null,
      links: profile?.profileLinks ?? [],
      theme: profile?.profileTheme ?? null,
      stories: catalog.map((entry) => entry.card),
      updatedAt: first.card.updatedAt,
    };
  }
}

export const showcaseAuthorService = new ShowcaseAuthorService();
