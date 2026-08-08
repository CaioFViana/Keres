import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DropDownPicker, { ItemType, ValueType } from 'react-native-dropdown-picker'; // Import ItemType and ValueType
import { useTheme } from '../../../../theme';

interface SelectOption {
  label: string;
  value: string;
}

// Props for single select
interface SelectPropsSingle {
  options: SelectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  multiple?: false; // Explicitly false for single select
  disabled?: boolean; // Added disabled prop
  allowDeselect?: boolean;
}

// Props for multi select
interface SelectPropsMulti {
  options: SelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  multiple: true; // Explicitly true for multi select
  disabled?: boolean; // Added disabled prop
  allowDeselect?: boolean;
}

type SelectProps = SelectPropsSingle | SelectPropsMulti;

const Select: React.FC<SelectProps> = ({ options, value, onValueChange, placeholder, multiple = false, disabled = false, allowDeselect = false }) => {
  const { colors } = useTheme();

  const [open, setOpen] = useState(false);

  // internalValue needs to be correctly typed based on 'multiple'
  const [internalValue, setInternalValue] = useState<ValueType | ValueType[] | null>(value);

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const dropdownItems: ItemType<string>[] = options.map(option => ({
    label: option.label,
    value: option.value,
  }));

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
    textStyle: {
      fontSize: 16,
      color: colors.text,
    },
    dropDownContainerStyle: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      zIndex: 10000,
    },
    itemSeparator: {
      height: 1,
      backgroundColor: colors.border,
    },
    disabledStyle: {
      backgroundColor: colors.surface, // Adjust as needed
      opacity: 0.4,
    },
  });

  // Conditional rendering or casting for DropDownPicker props
  if (multiple) {
    const multiValue = value as string[];
    const handleMultiChange = onValueChange as (value: string[]) => void;

    return (
      <View style={dropdownStyles.container}>
        <DropDownPicker
          open={open}
          value={multiValue} // Explicitly string[]
          items={dropdownItems}
          setOpen={setOpen}
          setValue={(callback) => {
            const newValue = callback(internalValue);
            setInternalValue(newValue);
            handleMultiChange(newValue as string[]); // Cast to string[]
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
          zIndex={open ? 3000 : 1000} // Dynamic zIndex
          zIndexInverse={1000}
          multiple={true} // Explicitly true
          mode="BADGE"
          disabled={disabled} // Pass disabled prop
          disabledStyle={dropdownStyles.disabledStyle} // Apply disabled style
        />
      </View>
    );
  } else {
    const singleValue = value as string | null;
    const handleSingleChange = onValueChange as (value: string | null) => void;

    return (
      <View style={dropdownStyles.container}>
        <DropDownPicker
          open={open}
          value={singleValue} // Explicitly string | null
          items={dropdownItems}
          setOpen={setOpen}
          setValue={(callback) => {
            const currentSelectedValue = internalValue; // Store current value before callback
            const newValue = callback(currentSelectedValue); // Get the new value from the dropdown picker

            let finalValue: string | null = newValue as string | null;

            // If allowDeselect is true and the newly selected item is the same as the currently selected one, deselect it
            if (allowDeselect && currentSelectedValue !== null && newValue === currentSelectedValue) {
              finalValue = null;
            }

            setInternalValue(finalValue);
            handleSingleChange(finalValue); // Pass the final value to the parent's onValueChange
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
          zIndex={open ? 3000 : 1000} // Dynamic zIndex
          zIndexInverse={1000}
          multiple={false} // Explicitly false
          disabled={disabled} // Pass disabled prop
          disabledStyle={dropdownStyles.disabledStyle} // Apply disabled style
        />
      </View>
    );
  }
};

export default Select;