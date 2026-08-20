import { storyDevicePageIds } from './catalog';
import { storyDeviceRegistry } from './generated/registry';
import { StoryDevicePage } from './types';

export interface ResolvedStoryDevicePage {
  page: StoryDevicePage | undefined;
  usedFallback: boolean;
}

function getLanguageCode(language: string): string {
  return language.toLowerCase().split('-')[0] ?? language;
}

/** Conteúdo pronto para renderizar, sempre vindo do registry gerado no build. */
export function resolveStoryDevicePage(pageId: string, language: string): ResolvedStoryDevicePage {
  const page = storyDeviceRegistry[pageId as keyof typeof storyDeviceRegistry];
  const localizedPage = page?.[getLanguageCode(language)];
  return {
    page: localizedPage ?? page?.en,
    usedFallback: !localizedPage && Boolean(page?.en),
  };
}

export function getStoryDevicePage(pageId: string, language: string): StoryDevicePage | undefined {
  return resolveStoryDevicePage(pageId, language).page;
}

export function getStoryDevicePages(language: string): StoryDevicePage[] {
  return storyDevicePageIds
    .map((pageId) => getStoryDevicePage(pageId, language))
    .filter((page): page is StoryDevicePage => Boolean(page));
}
