import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ServerActionRow from './ServerActionRow';

/** The way from a server's page to what is published on it: its showcase, read inside the app. */
const ServerShowcaseAction: React.FC<{ serverId: string }> = ({ serverId }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();

  return (
    <ServerActionRow
      icon="storefront-outline"
      title={t('server_action_showcase')}
      description={t('server_action_showcase_hint')}
      onPress={() =>
        // Under the showcase's own home, so back from the lists goes there and not out of the section.
        navigation.getParent()?.navigate('ShowcaseDrawer', {
          screen: 'ShowcaseBrowse',
          params: { serverId },
          initial: false,
        })
      }
      testID="server-action-showcase"
    />
  );
};

export default ServerShowcaseAction;
