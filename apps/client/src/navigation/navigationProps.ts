import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CharacterStackParamList, MainSystemDrawerParamList } from './MainSystemStack';

/**
 * Navigation types shared between screens.
 *
 * They live here, rather than in the screen that needed them first: one screen importing another just
 * to get a type creates a dependency between folders of different features - and that is how the
 * relation map screen depended on the character list.
 */
export type CharactersScreenNavigationProp = CompositeNavigationProp<
  DrawerNavigationProp<MainSystemDrawerParamList, 'CharactersStack'>,
  NativeStackNavigationProp<CharacterStackParamList, 'CharacterDetail'>
>;
