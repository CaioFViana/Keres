import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { GuideDrawerId } from '../../../../guides/types';
import type { MenuBadges } from '../../../../navigation/drawerMenuModel';
import { buildStorySelectionMenu } from '../../../../navigation/storySelectionMenu';
import {
  useHasUnseenAdminMessages,
  useHasUnseenMessages,
} from '../../../../state/unseenMessagesStore';
import { isServerless } from '../../../../utils/clientFlavor';
import GroupedDrawerMenu from '../GroupedDrawerMenu/GroupedDrawerMenu';

interface SelectionDrawerMenuProps {
  state: DrawerContentComponentProps['state'];
  navigation: DrawerContentComponentProps['navigation'];
  drawerId: GuideDrawerId;
}

/**
 * The menu outside a story. A message nobody has opened shows as a dot on the entry it is behind, and on the
 * group while that group is folded away.
 */
const SelectionDrawerMenu: React.FC<SelectionDrawerMenuProps> = ({
  state,
  navigation,
  drawerId,
}) => {
  const { t } = useTranslation();
  const serverless = isServerless();
  const unseenAdmin = useHasUnseenAdminMessages();
  const unseenMessages = useHasUnseenMessages();

  const menu = useMemo(
    () => buildStorySelectionMenu({ t: (key) => t(key), serverless }),
    [t, serverless],
  );
  const badges = useMemo<MenuBadges>(
    () => ({
      ServerManagementDrawer: unseenAdmin ? { kind: 'dot' } : undefined,
      FriendshipDrawer: unseenMessages ? { kind: 'dot' } : undefined,
    }),
    [unseenAdmin, unseenMessages],
  );

  return (
    <GroupedDrawerMenu
      state={state}
      navigation={navigation}
      drawerId={drawerId}
      top={menu.top}
      groups={menu.groups}
      footer={menu.footer}
      badges={badges}
      storageKey="@keres/drawer-groups/story-selection"
    />
  );
};

export default SelectionDrawerMenu;
