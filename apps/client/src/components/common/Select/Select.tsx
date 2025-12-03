import React, { useState } from 'react'; // Import useState
import { StyleSheet, View } from 'react-native'; // Removed TouchableWithoutFeedback
import DropDownPicker from 'react-native-dropdown-picker'; // Import DropDownPicker
import { useTheme } from '../../../theme';

interface SelectOption {
  label: string;
  value: string | null;
}

// Define the type for items passed to DropDownPicker
interface DropDownPickerItem {
  label: string;
  value: string | null;
  disabled?: boolean;
  key?: string; // Add key property
}

interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

// Conversion function to adapt our item type to DropDownPicker's ItemType
const toDropDownPickerItem = (item: DropDownPickerItem): { label: string; value: string | undefined; disabled?: boolean } => {
  return {
    label: item.label,
    value: item.value === null ? undefined : item.value, // Convert null to undefined
    disabled: item.disabled,
  };
};

const Select: React.FC<SelectProps> = ({ options, value, onValueChange, placeholder }) => {
  const { colors } = useTheme();

  const [open, setOpen] = useState(false); // State for dropdown open/close
  const [internalValue, setInternalValue] = useState<string | null>(value); // Internal state for DropDownPicker

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  let dropdownItems: DropDownPickerItem[] = options.map(option => ({
    label: option.label,
    value: option.value,
    key: option.value !== null ? option.value : option.label, // Assign unique key
  }));

  // Convert dropdownItems to the type expected by DropDownPicker
  const convertedDropdownItems = dropdownItems.map(toDropDownPickerItem);

  // Styles for DropDownPicker
  const dropdownStyles = StyleSheet.create({
    container: {
      width: '100%',
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 5,
      backgroundColor: colors.surface,
      justifyContent: 'center',
    },
    style: {
      backgroundColor: colors.surface,
      borderColor: 'transparent',
    },
    labelStyle: {
      color: colors.text,
      fontSize: 16,
    },
    placeholderStyle: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    textStyle: { // New style for dropdown items
      fontSize: 16,
      color: colors.text,
    },
    dropDownContainerStyle: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      zIndex: 10000, // Ensure dropdown is above other elements
    },
    itemSeparator: {
      height: 1,
      backgroundColor: colors.border,
    },
  });

  return (
    <View style={dropdownStyles.container}>
      <DropDownPicker<string>
        open={open}
        value={internalValue}
        items={convertedDropdownItems}
        setOpen={(val) => {
          setOpen(val);
        }}
        setValue={(callback) => {
          const newValue = callback(internalValue);
          setInternalValue(newValue);
          if (newValue !== null) {
            onValueChange(newValue as string);
          }
        }}
        onClose={() => {
          setOpen(false);
        }}
        placeholder={placeholder}
        placeholderStyle={dropdownStyles.placeholderStyle}
        style={dropdownStyles.style}
        labelStyle={dropdownStyles.labelStyle}
        textStyle={dropdownStyles.textStyle}
        dropDownContainerStyle={dropdownStyles.dropDownContainerStyle}
        itemSeparator={true}
        itemSeparatorStyle={dropdownStyles.itemSeparator}
        listMode="SCROLLVIEW"
        scrollViewProps={{
          nestedScrollEnabled: true,
        }}
        zIndex={10000}
        zIndexInverse={1000}
      />
    </View>
  );
};

export default Select;