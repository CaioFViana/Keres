import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import type { MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import { navigateAcrossStacks } from '../utils/stackNavigation';

/**
 * Opens a screen of another drawer stack from a screen of this one, and brings the person back to this
 * screen - not to whatever the other stack last showed - when they press back. The way every screen
 * leaves for a sibling stack: a raw `navigate('SomeStack', { screen })` pushes onto that stack's old
 * history and costs a second tap on back (see `utils/stackNavigation`).
 */
export function useNavigateAcrossStacks() {
  const navigation = useNavigation();
  return useCallback(
    (
      stack: keyof MainSystemDrawerParamList,
      screen: string,
      params?: object,
      options?: { onReturn?: () => void },
    ) => navigateAcrossStacks(navigation as never, { stack, screen, params }, options),
    [navigation],
  );
}
