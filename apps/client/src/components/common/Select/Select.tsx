import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import DropDownPicker, { ItemType, ValueType } from 'react-native-dropdown-picker'; // Import ItemType and ValueType
import { useTheme } from '../../../theme';

interface SelectOption {
  label: string;
  value: string; // Value should always be a string for consistent handling
}

// Props for single select
interface SelectPropsSingle {
  options: SelectOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  multiple?: false; // Explicitly false for single select
}

// Props for multi select
interface SelectPropsMulti {
  options: SelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  multiple: true; // Explicitly true for multi select
}

type SelectProps = SelectPropsSingle | SelectPropsMulti;

const Select: React.FC<SelectProps> = ({ options, value, onValueChange, placeholder, multiple = false }) => {
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
          zIndex={10000}
          zIndexInverse={1000}
          multiple={true} // Explicitly true
          mode="BADGE"
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
            const newValue = callback(internalValue);
            setInternalValue(newValue);
            handleSingleChange(newValue as string | null); // Cast to string | null
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
          multiple={false} // Explicitly false
        />
      </View>
    );
  }
};

export default Select;