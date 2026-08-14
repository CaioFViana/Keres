import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';

export function HelpSearchBar({
  value,
  onChangeText,
  onClear,
  placeholder,
  clearAccessibilityLabel,
  color,
  borderColor,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  clearAccessibilityLabel: string;
  color: string;
  borderColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', margin: 16, marginBottom: 4 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color}
        style={{ flex: 1, borderColor, borderWidth: 1, borderRadius: 8, color, padding: 12 }}
        accessibilityLabel={placeholder}
      />
      {!!value && (
        <TouchableOpacity
          onPress={onClear}
          style={{ marginLeft: 8, padding: 10 }}
          accessibilityLabel={clearAccessibilityLabel}
        >
          <Ionicons name="close-circle" size={22} color={color} />
        </TouchableOpacity>
      )}
    </View>
  );
}
