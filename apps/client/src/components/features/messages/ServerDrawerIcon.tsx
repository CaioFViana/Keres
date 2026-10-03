import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHasUnseenAdminMessages } from '../../../state/unseenMessagesStore';
import DrawerIconWithMark from './DrawerIconWithMark';

interface ServerDrawerIconProps {
  color: string;
  size: number;
}

/**
 * The servers entry of the menu: the usual server icon, marked while the administrators of some server
 * have written something the user has not opened. Those messages belong to a server, so this is the door
 * to look at - the list of servers then says which one.
 */
const ServerDrawerIcon: React.FC<ServerDrawerIconProps> = ({ color, size }) => {
  const { t } = useTranslation();
  return (
    <DrawerIconWithMark
      name="server-outline"
      color={color}
      size={size}
      marked={useHasUnseenAdminMessages()}
      markedLabel={t('messages_unseen_admin')}
      testID="unseen-admin-mark"
    />
  );
};

export default ServerDrawerIcon;
