import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface PickerSelectProps {
  placeholder: { label: string; value: string | null };
  options: { label: string; value: string }[];
  selectedValue: string;
  onValueChange: (itemValue: string) => void;
}

export default function PickerSelect({
  placeholder,
  options,
  selectedValue,
  onValueChange,
}: PickerSelectProps) {
  const inputBorderColor = useThemeColor({}, 'borderColor');

  return (
    <View style={styles.container}>
      {placeholder && <ThemedText style={styles.label}>{placeholder.label}</ThemedText>}
      <Picker
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={[styles.picker, { borderColor: inputBorderColor }]}
      >
        {placeholder && <Picker.Item label={placeholder.label} value={placeholder.value} />}
        {options.length === 0 ? (<Picker.Item label="No options available" value="" />) : (options.map((option) => (<Picker.Item key={option.value} label={option.label.trim()} value={option.value} />)))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  label: {
    marginBottom: 5,
    alignSelf: 'flex-start',
  },
  picker: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
  },
});
