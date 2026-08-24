import { FullStoryExportSchema } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import { exampleStoryRegistry } from '../../exampleStories/generated/registry';
import type { ExampleStoryEntry } from '../../exampleStories/types';
import { reviveDates } from '../../utils/reviveDates';
import { createStoryService } from './StoryService';

/**
 * Instala uma história de exemplo (empacotada com o app) no repertório do usuário.
 *
 * Reaproveita a mesma infraestrutura de import/export de histórias em vez de duplicá-la: o
 * conteúdo de cada exemplo já está no formato `FullStoryExportSchema` (o mesmo de um arquivo
 * `.json` exportado), então "instalar" é literalmente "importar" - checar se a história já
 * existe (mesma checagem de `ImportExportScreen`) e chamar `importFullStory`. Exemplos não
 * têm mídia (ver `exampleStories/`), então não há nada equivalente ao fluxo `.zip`.
 */

export type InstallExampleStoryResult =
  | { status: 'installed'; storyId: string }
  | { status: 'not_found' }
  | { status: 'invalid_content' };

export interface ExampleStoryServiceInterface {
  listExampleStories(): ExampleStoryEntry[];
  installExampleStory(
    userId: string,
    slug: string,
    language: string,
  ): Promise<InstallExampleStoryResult>;
}

export const createExampleStoryService = (db: AppDrizzleClient): ExampleStoryServiceInterface => {
  const storyService = createStoryService(db);

  return {
    listExampleStories(): ExampleStoryEntry[] {
      return exampleStoryRegistry;
    },

    async installExampleStory(
      userId: string,
      slug: string,
      language: string,
    ): Promise<InstallExampleStoryResult> {
      const entry = exampleStoryRegistry.find((candidate) => candidate.slug === slug);
      const languageEntry = entry?.languages.find((candidate) => candidate.language === language);
      if (!languageEntry) {
        console.error(`ExampleStoryService: example story not found: ${slug}/${language}.`);
        return { status: 'not_found' };
      }

      // O JSON empacotado nunca teve suas datas revividas (é um `import` estático de `.json`,
      // igual ao `JSON.parse` de um arquivo escolhido pelo usuário) - mesmo cuidado de
      // `pickStoryExportFile`.
      const parsed = FullStoryExportSchema.safeParse(reviveDates(languageEntry.story));
      if (!parsed.success) {
        console.error(
          `ExampleStoryService: bundled content for ${slug}/${language} failed validation.`,
          parsed.error,
        );
        return { status: 'invalid_content' };
      }

      // A importação local cria a cópia e remapeia seus IDs, inclusive para exemplos.
      const storyId = await storyService.importFullStory(userId, parsed.data, null);
      return { status: 'installed', storyId };
    },
  };
};
