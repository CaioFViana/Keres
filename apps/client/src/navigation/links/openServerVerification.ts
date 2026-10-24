import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '@/src/navigation/AppNavigator';

/** The two calls this needs from the app's navigation container; a test passes a stub. */
export type VerificationNavigation = Pick<
  NavigationContainerRef<RootStackParamList>,
  'getCurrentRoute' | 'navigate'
>;

/**
 * Opens the age check of a pending account on its server, once. A refused call can arrive many times in a row (every
 * story of the sync asks), so the screen already in front is left alone: the navigation is not repeated while it
 * shows. Stacks also answer `navigate` to a screen they already hold by moving to it, never by stacking a copy.
 */
export function openServerVerification(navigation: VerificationNavigation, serverId: string): void {
  const current = navigation.getCurrentRoute();
  // The registration screen (and the first-use account gate) takes the person to the check itself, after showing the recovery codes (they are shown only
  // once): a refused call that races it must not skip that panel.
  if (current?.name === 'ServerRegistration' || current?.name === 'RequiredAccount') return;
  if (
    current?.name === 'ServerVerification' &&
    (current.params as { serverId?: string } | undefined)?.serverId === serverId
  ) {
    return;
  }
  navigation.navigate('StorySelection', {
    screen: 'ServerManagementDrawer',
    params: { screen: 'ServerVerification', params: { serverId } },
  });
}
