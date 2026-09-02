import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface Props {
  dirty: boolean;
  layoutEditing: boolean;
  onRevert: () => void;
  onSave: () => void;
  onToggleLayout: () => void;
}

const BoardCanvasHeaderActions: React.FC<Props> = ({
  dirty,
  layoutEditing,
  onRevert,
  onSave,
  onToggleLayout,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginRight: 12, gap: 14 }}>
      <TouchableOpacity onPress={onToggleLayout} accessibilityLabel={t('board_edit_layout')}>
        <Ionicons
          name={layoutEditing ? 'checkmark-circle-outline' : 'move-outline'}
          size={24}
          color={layoutEditing ? colors.primary : colors.text}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={onRevert} disabled={!dirty} accessibilityLabel={t('board_revert')}>
        <Ionicons
          name="arrow-undo-outline"
          size={24}
          color={dirty ? colors.text : colors.textSecondary}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={onSave} disabled={!dirty} accessibilityLabel={t('board_save')}>
        <Ionicons
          name="checkmark-outline"
          size={26}
          color={dirty ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
};
export default BoardCanvasHeaderActions;
