import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useTheme } from '../../../../theme';

interface ListSearchFieldProps {
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  /** Empties the field. The list commits the empty search at once instead of waiting for a pause. */
  onClear: () => void;
}

/** The list's search box: a search icon on the left, and a button to empty it once there is text. */
const ListSearchField: React.FC<ListSearchFieldProps> = ({
  value,
  placeholder,
  onChangeText,
  onSubmitEditing,
  onClear,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.wrapper}>
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.input}
      />
      <View pointerEvents="none" style={styles.leading}>
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
      </View>
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={onClear}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={t('list_search_clear')}
          testID="list-search-clear"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    marginBottom: 0,
    paddingLeft: 38,
    paddingRight: 38,
  },
  leading: {
    position: 'absolute',
    left: 12,
  },
  clear: {
    position: 'absolute',
    right: 10,
  },
});

export default ListSearchField;
