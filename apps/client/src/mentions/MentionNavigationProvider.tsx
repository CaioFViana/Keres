import React, { useCallback } from 'react';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import type { MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import type { MentionRef } from '../utils/entityMentions';
import { navigateToEntityDetail } from '../utils/entityNavigation';
import { MentionNavigationContext } from './MentionContext';

/**
 * Supplies the "open this mention" action, from inside a drawer screen.
 *
 * It is mounted through the drawer navigator's `screenLayout`, and that placement is the whole
 * point: `navigateToEntityDetail` needs the drawer's navigation object, which does not exist above
 * the navigator. A provider higher in the tree would hold a navigator that has never heard of
 * `CharactersStack`.
 *
 * No return action is registered. A mention is a jump within the story the reader is already in,
 * and the destination's own back button behaves normally - unlike the Plot matrix or Global Search,
 * which leave their stack and must hand the way back over (see `useNavigateToEntityDetail`).
 */
export const MentionNavigationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigation = useNavigation<DrawerNavigationProp<MainSystemDrawerParamList>>();

  const openMention = useCallback(
    (ref: MentionRef) => navigateToEntityDetail(navigation, ref.type, ref.id),
    [navigation],
  );

  return (
    <MentionNavigationContext.Provider value={openMention}>
      {children}
    </MentionNavigationContext.Provider>
  );
};
