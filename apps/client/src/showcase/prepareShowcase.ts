import type { AppDrizzleClient } from '../db';
import { createClientSettings, getClientSettings } from '../services/ClientSettingsService';
import { exampleStoryRegistry } from '../exampleStories/generated/registry';
import { createExampleStoryService } from '../services/storymanagement/ExampleStoryService';
import { createStoryService } from '../services/storymanagement/StoryService';
import type { Story } from '@keres/shared/entities/Story';
import { useStoryStore } from '../state/storyStore';
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import i18n from '../utils/i18n';
import type { ShowcaseRequest } from './showcaseRequest';

/**
 * Deixa o app pronto para a captura: idioma, tema, história de exemplo instalada e selecionada.
 *
 * Reaproveita o caminho normal de instalação (`installExampleStory`), então a história que a
 * imagem mostra é a mesma que a pessoa recebe ao instalar o exemplo pelo menu - com ids
 * remapeados e tudo.
 */
export async function prepareShowcase(
  db: AppDrizzleClient,
  request: ShowcaseRequest,
): Promise<boolean> {
  try {
    await i18n.changeLanguage(request.language);

    // Perfil limpo: a captura roda num diretório novo a cada vez, então a vitrine faz por
    // conta própria o que a tela de abertura faria - senão a primeira imagem seria a de
    // boas-vindas.
    if (!(await getClientSettings(db))) {
      await createClientSettings(db, {
        localUsername: 'Keres',
        language: request.language,
        darkMode: request.theme === 'dark',
        use24HourTime: true,
        showContextualHelp: true,
        suggestLiteraryDevices: true,
      });
    }
    await useUserSettingsStore.getState().initializeSettings(db);

    const userId = useUserSettingsStore.getState().userId;
    if (!userId) {
      console.warn('[showcase] sem usuário local depois de criar as configurações.');
      return false;
    }

    await useThemeStore.getState().setDarkMode(db, request.theme === 'dark');

    const storyService = createStoryService(db);
    // O título do exemplo empacotado identifica a história instalada. Procurar só pelo idioma
    // fazia a segunda foto reaproveitar a história da primeira - todas as telas saíam da mesma
    // história, independentemente da que foi pedida.
    const packaged = exampleStoryRegistry
      .find((entry) => entry.slug === request.story)
      ?.languages.find((entry) => entry.language === request.language)?.story as
      | { story?: { title?: string } }
      | undefined;
    const expectedTitle = packaged?.story?.title;
    const existing = (await storyService.getAllStories(userId)).find(
      (story) => !story.isDeleted && story.title === expectedTitle,
    );
    const target =
      existing ??
      (await (async () => {
        const result = await createExampleStoryService(db).installExampleStory(
          userId,
          request.story,
          request.language,
        );
        if (result.status !== 'installed') {
          console.error('[showcase] não foi possível instalar o exemplo:', result.status);
          return undefined;
        }
        return storyService.getStoryById(result.storyId, userId);
      })());

    if (!target) return false;
    // O serviço devolve a linha do banco, com os campos abertos como texto; a store guarda a
    // entidade. Os valores são os mesmos - só o tipo é mais estreito.
    useStoryStore.getState().setSelectedStory(target as unknown as Story);
    // Bandeira para o capturador: dados prontos. Ele ainda espera um tempo de assentamento
    // para o desenho, mas não precisa mais adivinhar pelo texto da tela - era isso que fazia
    // uma foto sair na tela de carregamento de vez em quando.
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.keresShowcase = 'ready';
    }
    return true;
  } catch (error) {
    console.error('[showcase] falha ao preparar a vitrine:', error);
    return false;
  }
}
