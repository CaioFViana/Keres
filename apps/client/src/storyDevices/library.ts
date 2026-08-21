import { DocLibrary } from '../help/library';
import { storyDeviceSections } from './catalog';
import { getStoryDevicePage, getStoryDevicePages, resolveStoryDevicePage } from './repository';

export const storyDeviceLibrary: DocLibrary = {
  id: 'storyDevices',
  sections: storyDeviceSections,
  getPages: getStoryDevicePages,
  getPage: getStoryDevicePage,
  resolvePage: resolveStoryDevicePage,
  pageRouteName: 'DevicePage',
  indexTitleKey: 'story_devices_index_title',
  titleKey: 'story_devices_title',
  searchPlaceholderKey: 'story_devices_search_placeholder',
  searchClearKey: 'story_devices_search_clear',
  searchResultsCountKey: 'story_devices_search_results_count',
  noResultsKey: 'story_devices_no_results',
  notFoundKey: 'story_devices_page_not_found',
  fallbackNoticeKey: 'help_language_fallback_notice',
  defaultOpenSectionId: 'start',
  emptyStateLinks: [{ pageId: 'how-to-use-devices', labelKey: 'story_devices_no_results_hint' }],
};
