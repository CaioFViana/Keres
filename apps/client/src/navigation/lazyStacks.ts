import { lazyScreen } from './lazyScreen';

/**
 * The two documentation stacks (Help and the literary devices) hold every article of the app, in both languages:
 * about 600 KB of text that only a reader of the manual needs. They load when the person first opens one.
 */
export const HelpStackNavigator = lazyScreen(() => import('./HelpStack'));
export const StoryDevicesStackNavigator = lazyScreen(() => import('./StoryDevicesStack'));
