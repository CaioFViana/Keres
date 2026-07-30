import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback } from 'react';
import { RootStackParamList } from '../navigation/AppNavigator';

/**
 * Abre uma mídia da galeria por cima da tela atual, empilhada na navegação raiz - e não
 * dentro da aba de Galeria do Drawer.
 *
 * A diferença importa para o botão de voltar do Android. A aba de Galeria é uma pilha
 * própria (`GalleryStack`) que, na primeira vez que é visitada nesta sessão, nasce com
 * `[GalleryList, GalleryDetail]` - a lista por baixo do detalhe, mesmo que a pessoa nunca
 * tenha realmente passado por ela. Empilhar ali faria o voltar devolver essa lista em vez
 * da tela de entidade de onde a pessoa veio. Empilhando na raiz (`GalleryMediaViewer`, que
 * monta o mesmo `GalleryDetailScreen`), voltar desfaz só este passo - a aba do Drawer em
 * que a pessoa estava nunca chega a ser tocada, então continua exatamente como estava.
 */
export function useOpenGalleryMediaViewer() {
  const navigation = useNavigation();

  return useCallback((galleryId: string) => {
    const rootNavigation = navigation
      .getParent()
      ?.getParent<NativeStackNavigationProp<RootStackParamList>>();
    rootNavigation?.navigate('GalleryMediaViewer', { galleryId });
  }, [navigation]);
}
