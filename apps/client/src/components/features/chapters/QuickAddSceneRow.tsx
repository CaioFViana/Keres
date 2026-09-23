import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface Props {
  /** Creates the scene; the row clears only when this resolves, so a failure keeps the typed title. */
  onSubmit: (name: string) => Promise<void> | void;
  placeholder: string;
  testID?: string;
}

/**
 * Title-only scene capture for the outline: type a title, add, repeat. No navigation, no
 * form, no fields beyond the name - the scene lands in the group the row belongs to (or
 * unchaptered) and everything else is filled in by editing it later.
 */
const QuickAddSceneRow: React.FC<Props> = ({
  onSubmit,
  placeholder,
  testID = 'quick-add-scene',
}) => {
  const { colors } = useTheme();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: colors.text,
          backgroundColor: colors.surface,
          fontSize: 14,
        },
        submit: {
          padding: 8,
          borderRadius: 8,
          backgroundColor: colors.primary,
        },
      }),
    [colors],
  );

  const submit = async () => {
    const name = value.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(name);
      setValue('');
      inputRef.current?.focus();
    } catch {
      // The caller owns failure feedback; the row just keeps the typed title.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.row}>
      <TextInput
        ref={inputRef}
        testID={`${testID}-input`}
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        autoFocus
        editable={!submitting}
      />
      <TouchableOpacity
        testID={`${testID}-submit`}
        style={styles.submit}
        onPress={() => void submit()}
        disabled={submitting}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={20} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

export default QuickAddSceneRow;
