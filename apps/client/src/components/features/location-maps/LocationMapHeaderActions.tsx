import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface Props {
  dirty: boolean;
  saving: boolean;
  onRevert: () => void;
  onSave: () => void;
  layoutEditing?: boolean;
  connectionMode?: boolean;
  onToggleLayout?: () => void;
  onToggleConnectionMode?: () => void;
}

/** The map header's two document actions, kept together so their enabled state cannot drift apart. */
const LocationMapHeaderActions: React.FC<Props> = ({
  dirty,
  saving,
  onRevert,
  onSave,
  layoutEditing = false,
  connectionMode = false,
  onToggleLayout = () => undefined,
  onToggleConnectionMode = () => undefined,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 14 }}>
      <TouchableOpacity
        onPress={onToggleConnectionMode}
        accessibilityLabel={t('graph_connection_mode')}
      >
        <Ionicons
          name={connectionMode ? 'git-merge' : 'git-merge-outline'}
          size={24}
          color={connectionMode ? colors.primary : colors.text}
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleLayout} accessibilityLabel={t('board_edit_layout')}>
        <Ionicons
          name={layoutEditing ? 'checkmark-circle-outline' : 'move-outline'}
          size={24}
          color={layoutEditing ? colors.primary : colors.text}
        />
      </TouchableOpacity>
      <TouchableOpacity
        testID="location-map-revert"
        onPress={onRevert}
        disabled={!dirty}
        accessibilityLabel={t('board_revert')}
      >
        <Ionicons
          name="arrow-undo-outline"
          size={24}
          color={dirty ? colors.text : colors.textSecondary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        testID="location-map-save"
        onPress={onSave}
        disabled={!dirty || saving}
        accessibilityLabel={t('board_save')}
      >
        <Ionicons
          name="checkmark-outline"
          size={26}
          color={dirty ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
};

export default LocationMapHeaderActions;
