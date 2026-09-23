import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '@/src/theme';
import QuickAddSceneRow from './QuickAddSceneRow';

interface Props {
  visible: boolean;
  /** The group the captured scenes land in (chapter name or the unchaptered label). */
  groupName: string;
  /** Creates the scene; the row clears only when this resolves, so a failure keeps the title. */
  onSubmit: (name: string) => Promise<void> | void;
  onClose: () => void;
  testID?: string;
}

/**
 * Title-only scene capture in a modal: type a title, add, repeat, close when done. A
 * modal rather than an inline row because the outline group cannot grow to fit one -
 * the row pushed the new scene below the fold until the writer closed it.
 */
const QuickAddSceneModal: React.FC<Props> = ({
  visible,
  groupName,
  onSubmit,
  onClose,
  testID = 'quick-add-scene',
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 20 },
        title: { color: colors.text, fontSize: 20, fontWeight: '700' },
        row: { marginTop: 16 },
      }),
    [colors],
  );

  return (
    <ResponsiveModal visible={visible} onClose={onClose}>
      <View style={styles.content} testID={testID}>
        <Text style={styles.title}>{t('quick_add_scene_title', { group: groupName })}</Text>
        <View style={styles.row}>
          <QuickAddSceneRow
            onSubmit={onSubmit}
            placeholder={t('quick_add_scene_placeholder')}
            testID={`${testID}-row`}
          />
        </View>
        <FormActions stackOnCompact>
          <Button testID={`${testID}-close`} onPress={onClose}>
            {t('close')}
          </Button>
        </FormActions>
      </View>
    </ResponsiveModal>
  );
};

export default QuickAddSceneModal;
