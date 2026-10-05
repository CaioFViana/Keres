import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { useScreenAnchor } from '../../../guides/useGuideAnchor';
import { useTheme } from '../../../theme';

interface Props {
  dirty: boolean;
  onRevert: () => void;
  onSave: () => void;
}

/**
 * The sketch header keeps only the document actions, like boards: revert (back to the
 * last save) and save. Undo/redo live in the tools bar - they walk the session history,
 * they are not document actions.
 */
const SketchCanvasHeaderActions: React.FC<Props> = ({ dirty, onRevert, onSave }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const documentAnchorRef = useScreenAnchor('SketchCanvas', 'document');
  return (
    <View
      ref={documentAnchorRef}
      collapsable={false}
      style={{ flexDirection: 'row', marginRight: 12, gap: 14 }}
    >
      <TouchableOpacity onPress={onRevert} disabled={!dirty} accessibilityLabel={t('sketch_revert')}>
        <Ionicons
          name="arrow-undo-outline"
          size={24}
          color={dirty ? colors.text : colors.textSecondary}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={onSave} disabled={!dirty} accessibilityLabel={t('sketch_save')}>
        <Ionicons
          name="checkmark-outline"
          size={26}
          color={dirty ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
};
export default SketchCanvasHeaderActions;
