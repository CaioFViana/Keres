import FormField from '@/src/components/common/forms/FormField/FormField';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { StyleProp, TextStyle } from 'react-native';

interface FormTextFieldProps {
  label: string;
  placeholder: string;
  value: string | null;
  onChangeText: (text: string) => void;
  style: StyleProp<TextStyle>;
}

/** A single-line text input under its label. The caller picks the input style (`commonInputStyles.input`). */
export default function FormTextField({
  label,
  placeholder,
  value,
  onChangeText,
  style,
}: FormTextFieldProps) {
  return (
    <FormField label={label}>
      {(fieldAccessibility) => (
        <TextInput
          {...fieldAccessibility}
          placeholder={placeholder}
          value={value || ''}
          onChangeText={onChangeText}
          style={style}
        />
      )}
    </FormField>
  );
}
