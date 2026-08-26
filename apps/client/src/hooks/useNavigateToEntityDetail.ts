import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import type { MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import type { NavigableEntityType } from '../utils/entityNavigation';
import { navigateToEntityDetail } from '../utils/entityNavigation';

/**
 * `navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>()` followed by
 * `navigateToEntityDetail(...)` was repeated in every relation/list manager that needs to navigate to
 * another entity's detail screen (the relevant navigator is the current Stack's parent, not the Stack
 * itself).
 */
export function useNavigateToEntityDetail() {
  const navigation = useNavigation();

  return useCallback(
    // `options.onReturn` is passed straight through: whoever leaves their own stack (the Plot matrix
    // opening a Scene, say) has to register the way back, otherwise the back button takes the destination
    // stack to where it used to be, rather than to where the person came from.
    (entityType: NavigableEntityType, entityId: string, options?: { onReturn?: () => void }) => {
      const drawerNavigation =
        navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
      if (drawerNavigation) {
        navigateToEntityDetail(drawerNavigation, entityType, entityId, options);
      }
    },
    [navigation],
  );
}
