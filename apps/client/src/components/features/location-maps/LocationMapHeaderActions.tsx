import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { useScreenAnchor } from '../../../guides/useGuideAnchor';
import { useTheme } from '@/src/theme';

interface Props {
  dirty: boolean;
  saving: boolean;
  onRevert: () => void;
  onSave: () => void;
}

/**
 * The map header keeps only the document actions; the mode toggles live in the
 * tools bar, right of the add actions on medium and wide screens and on their own
 * row above them on compact ones.
 */
const LocationMapHeaderActions: React.FC<Props> = ({ dirty, saving, onRevert, onSave }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const documentAnchorRef = useScreenAnchor('LocationMap', 'document');

  return (
    <View
      ref={documentAnchorRef}
      collapsable={false}
      style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 14 }}
    >
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
