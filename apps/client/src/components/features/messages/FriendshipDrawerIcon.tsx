import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHasUnseenMessages } from '../../../state/unseenMessagesStore';
import DrawerIconWithMark from './DrawerIconWithMark';

interface FriendshipDrawerIconProps {
  color: string;
  size: number;
}

/**
 * The friendships entry of the menu: the usual people icon, and - while there is a message the user has
 * not opened - a small received-message mark on its corner. It is how a notification that was missed
 * still leaves a trace.
 */
const FriendshipDrawerIcon: React.FC<FriendshipDrawerIconProps> = ({ color, size }) => {
  const { t } = useTranslation();
  return (
    <DrawerIconWithMark
      name="people-outline"
      color={color}
      size={size}
      marked={useHasUnseenMessages()}
      markedLabel={t('messages_unseen')}
    />
  );
};

export default FriendshipDrawerIcon;
