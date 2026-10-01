import type { Ionicons } from '@expo/vector-icons';
import type { ClientFlavor } from '../../../utils/clientFlavor';
import { isOfficialApp } from '../../../utils/clientFlavor';

export type WelcomePageId = 'what' | 'where' | 'name';

/** The steps in order; the last one is the form that creates the local profile. */
export const WELCOME_PAGES: readonly WelcomePageId[] = ['what', 'where', 'name'];

export interface WelcomeRow {
  icon: keyof typeof Ionicons.glyphMap;
  textKey: string;
}

/** The picture of a step: an icon, or the Keres emblem itself on the first one. */
export type WelcomeHeroIcon = keyof typeof Ionicons.glyphMap | 'logo';

export function welcomeHeroIcon(page: WelcomePageId, flavor: ClientFlavor): WelcomeHeroIcon {
  if (page === 'what') return 'logo';
  if (page === 'name') return 'person-circle-outline';
  if (flavor === 'serverless-web') return 'cloud-offline-outline';
  if (flavor === 'web') return 'globe-outline';
  return flavor === 'desktop' ? 'laptop-outline' : 'phone-portrait-outline';
}

export const WELCOME_TITLE_KEYS: Record<WelcomePageId, string> = {
  what: 'welcome_what_title',
  where: 'welcome_where_title',
  name: 'welcome_name_title',
};

/**
 * What each step says, by build. The first and last say the same everywhere; the middle one is the
 * one that changes, because what a person can do with servers depends on which client this is:
 *
 * - the official apps (mobile, desktop) keep everything on the device and can register any number
 *   of servers;
 * - the web client the API serves keeps everything in the browser and can only use the server that
 *   served it;
 * - the GitHub Pages build keeps everything in the browser and has no server at all.
 *
 * Every build says plainly that what is created lives on this device - and the browser ones, that
 * it is kept per site address.
 */
export function welcomeRows(page: WelcomePageId, flavor: ClientFlavor): WelcomeRow[] {
  if (page === 'what') {
    return [
      { icon: 'git-branch-outline', textKey: 'welcome_what_plan' },
      { icon: 'create-outline', textKey: 'welcome_what_write' },
    ];
  }
  if (page === 'name') {
    return [{ icon: 'person-circle-outline', textKey: 'welcome_name_explain' }];
  }
  if (isOfficialApp(flavor)) {
    return [
      { icon: 'phone-portrait-outline', textKey: 'welcome_where_device' },
      { icon: 'cloud-offline-outline', textKey: 'welcome_where_offline_first' },
      { icon: 'sync-outline', textKey: 'welcome_where_servers_how' },
    ];
  }
  if (flavor === 'serverless-web') {
    return [
      { icon: 'globe-outline', textKey: 'welcome_where_browser' },
      { icon: 'cloud-offline-outline', textKey: 'welcome_where_serverless' },
    ];
  }
  return [
    { icon: 'globe-outline', textKey: 'welcome_where_browser' },
    { icon: 'server-outline', textKey: 'welcome_where_web_one_server' },
    { icon: 'sync-outline', textKey: 'welcome_where_servers_how' },
  ];
}

/** Whether to point at the official apps: the builds with limits the apps do not have. */
export function offersOfficialApp(flavor: ClientFlavor): boolean {
  return !isOfficialApp(flavor);
}
