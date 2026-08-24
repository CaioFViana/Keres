import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import type { MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import type { NavigableEntityType } from '../utils/entityNavigation';
import { navigateToEntityDetail } from '../utils/entityNavigation';

/**
 * `navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>()` seguido de
 * `navigateToEntityDetail(...)` era repetido em cada gerenciador de relação/lista que precisa
 * navegar pra tela de detalhe de outra entidade (o navigator relevante é o pai do Stack atual,
 * não o Stack em si).
 */
export function useNavigateToEntityDetail() {
  const navigation = useNavigation();

  return useCallback(
    // `options.onReturn` é repassado como está: quem sai da própria pilha (a matriz de Tramas
    // abrindo uma Cena, por exemplo) precisa registrar a volta, senão o botão de voltar leva a
    // pilha de destino para onde ela estava, e não de onde a pessoa veio.
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
