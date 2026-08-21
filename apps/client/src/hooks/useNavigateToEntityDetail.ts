import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import type { MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import { navigateToEntityDetail, NavigableEntityType } from '../utils/entityNavigation';

/**
 * `navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>()` seguido de
 * `navigateToEntityDetail(...)` era repetido em cada gerenciador de relação/lista que precisa
 * navegar pra tela de detalhe de outra entidade (o navigator relevante é o pai do Stack atual,
 * não o Stack em si).
 */
export function useNavigateToEntityDetail() {
  const navigation = useNavigation();

  return useCallback(
    (entityType: NavigableEntityType, entityId: string) => {
      const drawerNavigation =
        navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
      if (drawerNavigation) {
        navigateToEntityDetail(drawerNavigation, entityType, entityId);
      }
    },
    [navigation],
  );
}
