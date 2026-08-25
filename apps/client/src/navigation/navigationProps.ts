import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CharacterStackParamList, MainSystemDrawerParamList } from './MainSystemStack';

/**
 * Tipos de navegação compartilhados entre telas.
 *
 * Moram aqui, e não na tela que primeiro precisou deles: uma tela importando outra só para
 * pegar um tipo cria uma dependência entre pastas de funcionalidades diferentes - e era assim
 * que a tela do mapa de relações dependia da lista de personagens.
 */
export type CharactersScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'CharactersStack'>,
  NativeStackNavigationProp<CharacterStackParamList, 'CharacterDetail'>
>;
