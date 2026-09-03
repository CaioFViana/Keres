import { PackContentSchema } from '@keres/shared';
import { z } from 'zod';
import type { AppDrizzleClient } from '../../db';
import { shippedPackRegistry } from '../../shippedPacks/generated/registry';
import type { ShippedPackEntry } from '../../shippedPacks/types';
import { createPackService, type PackContentCounts } from './PackService';

/**
 * Installs a pack packaged with the app.
 *
 * It reuses the path a downloaded pack already takes (`PackService.importRemotePack`) rather than a
 * second way in: a shipped pack is one row with one payload, exactly like a shared one, and its id
 * is fixed in the content file - so installing twice updates in place instead of leaving two near
 * duplicates. Once installed it is an ordinary pack, deletable through the existing means and
 * indistinguishable from any other in the list.
 *
 * It is never installed automatically. A pack is an opinion about how a story is shaped, and Keres
 * does not hold one on the writer's behalf - see `FEATURE_LANDSCAPE.md` §1.
 */

const ShippedPackFileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  authorName: z.string().nullable().default(null),
  version: z.number().int().min(1).default(1),
  content: PackContentSchema,
});

export type InstallShippedPackResult =
  | { status: 'installed'; packId: string }
  | { status: 'not_found' }
  | { status: 'invalid_content' };

/**
 * What the catalogue screen needs, read defensively.
 *
 * Read without the schema on purpose, the same as the example stories' preview: the listing must
 * survive a malformed file rather than vanish, and the real validation belongs at installation,
 * where it can produce an error the user sees.
 */
export interface ShippedPackPreview {
  slug: string;
  language: string;
  /** Empty when the file is unreadable - the screen still lists it, and installing reports why. */
  id: string;
  name: string;
  description: string | null;
  authorName: string | null;
  counts: PackContentCounts;
  statSystem: boolean;
}

export interface ShippedPackServiceInterface {
  listShippedPacks(): ShippedPackEntry[];
  previewShippedPacks(): ShippedPackPreview[];
  installShippedPack(slug: string, language: string): Promise<InstallShippedPackResult>;
}

function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function previewOf(slug: string, language: string, pack: unknown): ShippedPackPreview {
  const file = pack as {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    authorName?: unknown;
    content?: {
      storySchemaFields?: unknown;
      suggestions?: unknown;
      tags?: unknown;
      stats?: unknown;
      settings?: { statSystem?: unknown; vocabulary?: { terms?: unknown } | null };
    };
  } | null;
  const vocabulary = file?.content?.settings?.vocabulary;

  return {
    slug,
    language,
    id: typeof file?.id === 'string' ? file.id : '',
    name: typeof file?.name === 'string' && file.name.trim() ? file.name : slug,
    description: typeof file?.description === 'string' ? file.description : null,
    authorName: typeof file?.authorName === 'string' ? file.authorName : null,
    counts: {
      customAttributes: countOf(file?.content?.storySchemaFields),
      suggestions: countOf(file?.content?.suggestions),
      tags: countOf(file?.content?.tags),
      stats: countOf(file?.content?.stats),
      hasVocabulary:
        typeof vocabulary === 'object' &&
        vocabulary !== null &&
        Object.keys(vocabulary.terms ?? {}).length > 0,
    },
    statSystem: file?.content?.settings?.statSystem === true,
  };
}

export const createShippedPackService = (db: AppDrizzleClient): ShippedPackServiceInterface => {
  const packService = createPackService(db);

  return {
    listShippedPacks(): ShippedPackEntry[] {
      return shippedPackRegistry;
    },

    previewShippedPacks(): ShippedPackPreview[] {
      return shippedPackRegistry.flatMap((entry) =>
        entry.languages.map((language) => previewOf(entry.slug, language.language, language.pack)),
      );
    },

    async installShippedPack(slug, language): Promise<InstallShippedPackResult> {
      const entry = shippedPackRegistry.find((candidate) => candidate.slug === slug);
      const languageEntry = entry?.languages.find((candidate) => candidate.language === language);
      if (!languageEntry) {
        console.error(`ShippedPackService: shipped pack not found: ${slug}/${language}.`);
        return { status: 'not_found' };
      }

      const parsed = ShippedPackFileSchema.safeParse(languageEntry.pack);
      if (!parsed.success) {
        console.error(
          `ShippedPackService: bundled content for ${slug}/${language} failed validation.`,
          parsed.error,
        );
        return { status: 'invalid_content' };
      }

      await packService.importRemotePack({
        ...parsed.data,
        language,
        // Installing puts a pack on this device; it says nothing about sharing it anywhere.
        visibility: 'private',
      });
      return { status: 'installed', packId: parsed.data.id };
    },
  };
};
