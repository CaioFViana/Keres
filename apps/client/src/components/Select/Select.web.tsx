import React from 'react';
import { View, ViewStyle } from 'react-native'; // Use View for web compatibility
import { useTheme } from '../../theme';

interface SelectOption {
  label: string;
  value: string | null; // Change back to null
}

interface SelectProps {
  options: SelectOption[];
  value: string | null; // Change back to null
  onValueChange: (value: string) => void;
  placeholder?: string;
}

const Select: React.FC<SelectProps> = ({ options, value, onValueChange, placeholder }) => {
  const { colors } = useTheme();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange(event.target.value);
  };

  const selectStyles: React.CSSProperties = {
    height: 50,
    width: '100%',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
    // Web-specific styles to reset default browser appearance
    appearance: 'none', // Remove default browser styling
    WebkitAppearance: 'none', // For Safari
    MozAppearance: 'none', // For Firefox
  };

  const containerStyles: React.CSSProperties = {
    width: '100%',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: colors.surface,
    display: 'flex', // Use flex for centering content
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // Hide default arrow if any
  };

  const selectValue = value === null ? "" : value;

  return (
    <View style={containerStyles as ViewStyle}>
      <select
        style={selectStyles}
        value={selectValue as string} // Explicitly cast to string
        onChange={handleChange}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value === null ? "" : option.value}> {/* Fix here */}
            {option.label}
          </option>
        ))}
      </select>
    </View>
  );
};

export default Select;