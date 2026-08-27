import Button from '@/src/components/common/controls/Button/Button';
import Select from '@/src/components/common/inputs/Select/Select';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { PackVisibility } from '@keres/shared';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';

/**
 * Sharing a pack: which server, and whether it goes on that server's public showcase.
 *
 * One modal with both questions rather than two alerts in sequence. They are genuinely separate
 * decisions - reaching your own devices and your collaborators is not the same act as putting a
 * pack on a page anyone can read - but they are decided together, and a second dialog appearing
 * after the first was answered gives no way back to the first without starting over.
 *
 * A `Select` rather than one alert button per server, for the reason the example stories screen
 * already gives: a dropdown keeps its shape as the list grows, while an alert becomes an
 * ever-taller column of buttons.
 */

export interface ShareTarget {
  id: string;
  name: string | null;
  url: string;
}

interface SharePackModalProps {
  visible: boolean;
  packName: string;
  servers: ShareTarget[];
  onCancel: () => void;
  onConfirm: (serverId: string, visibility: PackVisibility) => void;
}

const SharePackModal: React.FC<SharePackModalProps> = ({
  visible,
  packName,
  servers,
  onCancel,
  onConfirm,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [serverId, setServerId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<PackVisibility>('private');

  /**
   * Nothing to choose when there is one server, so it is chosen.
   *
   * A primitive, and the effect below depends on it rather than on `servers`: an array prop is a
   * new array on every render of whoever owns it, and an effect keyed on that would reset the
   * answers underneath somebody in the middle of giving them.
   */
  const onlyServerId = servers.length === 1 ? servers[0].id : null;

  useEffect(() => {
    // Private every time it opens, never the last answer: a pack going public is a deliberate act,
    // and inheriting that from the previous share would make it an accident.
    setVisibility('private');
    setServerId(onlyServerId);
  }, [visible, onlyServerId]);

  const styles = StyleSheet.create({
    modalContent: { backgroundColor: colors.background, borderRadius: 10, padding: 20 },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 20,
      textAlign: 'center',
    },
    formGroup: { marginBottom: 15 },
    label: { fontSize: 16, color: colors.text, marginBottom: 5 },
    hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      paddingHorizontal: '3%',
    },
    buttonWrapper: { width: '47%' },
  });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onCancel}
      contentStyle={styles.modalContent}
      maxHeight="86%"
    >
      <Text style={styles.modalTitle}>{t('packs_share_title')}</Text>
      <Text style={styles.subtitle}>{t('packs_share_message', { name: packName })}</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('packs_share_server_label')}</Text>
        <Select
          options={servers.map((server) => ({
            label: server.name ?? server.url,
            value: server.id,
          }))}
          value={serverId}
          onValueChange={setServerId}
          placeholder={t('packs_browse_choose_server')}
          multiple={false}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>{t('packs_share_visibility_label')}</Text>
        <Select
          options={[
            { label: t('packs_visibility_private'), value: 'private' },
            { label: t('packs_visibility_public'), value: 'public' },
          ]}
          value={visibility}
          onValueChange={(value) => value && setVisibility(value as PackVisibility)}
          multiple={false}
        />
        <Text style={styles.hint}>{t('packs_visibility_message')}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.buttonWrapper}>
          <Button onPress={onCancel}>{t('cancel')}</Button>
        </View>
        <View style={styles.buttonWrapper}>
          <Button
            onPress={() => serverId && onConfirm(serverId, visibility)}
            disabled={!serverId}
            testID="confirm-share-pack"
          >
            {t('packs_share_confirm')}
          </Button>
        </View>
      </View>
    </ResponsiveModal>
  );
};

export default SharePackModal;
