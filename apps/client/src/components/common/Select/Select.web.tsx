import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../../theme';

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
  disabled?: boolean;
  allowDeselect?: boolean;
}

// Props for multi select
interface SelectPropsMulti {
  options: SelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  multiple: true; // Explicitly true for multi select
  disabled?: boolean;
  allowDeselect?: boolean;
}

type SelectProps = SelectPropsSingle | SelectPropsMulti;

// Matches React Native Web's default 'System' font resolution (see textStyle in RNW's Text component)
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
}

const Select: React.FC<SelectProps> = ({ options, value, onValueChange, placeholder, multiple = false, disabled = false, allowDeselect = false }) => {
  const { colors } = useTheme();

  const [open, setOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const rect = controlRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (controlRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  const selectedValues: string[] = multiple ? (value as string[]) : value !== null ? [value as string] : [];

  const getLabel = (optionValue: string) => options.find(option => option.value === optionValue)?.label ?? optionValue;

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) updatePosition();
    setOpen(previous => !previous);
  };

  const handleSingleSelect = (optionValue: string) => {
    const handleSingleChange = onValueChange as (value: string | null) => void;
    const currentValue = value as string | null;

    if (allowDeselect && currentValue === optionValue) {
      handleSingleChange(null);
    } else {
      handleSingleChange(optionValue);
    }
    setOpen(false);
  };

  const handleMultiSelect = (optionValue: string) => {
    const handleMultiChange = onValueChange as (value: string[]) => void;
    const currentValue = value as string[];

    if (currentValue.includes(optionValue)) {
      handleMultiChange(currentValue.filter(item => item !== optionValue));
    } else {
      handleMultiChange([...currentValue, optionValue]);
    }
  };

  const handleRemoveBadge = (event: React.MouseEvent, optionValue: string) => {
    event.stopPropagation();
    const handleMultiChange = onValueChange as (value: string[]) => void;
    const currentValue = value as string[];
    handleMultiChange(currentValue.filter(item => item !== optionValue));
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
  };

  const controlStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 50,
    width: '100%',
    boxSizing: 'border-box',
    borderColor: colors.primary,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 5,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    userSelect: 'none',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  };

  const placeholderStyle: React.CSSProperties = {
    color: colors.textSecondary,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
  };

  const textStyle: React.CSSProperties = {
    color: colors.text,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    fontFamily: FONT_FAMILY,
    borderRadius: 4,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 2,
    paddingBottom: 2,
    fontSize: 14,
  };

  const chevronStyle: React.CSSProperties = {
    color: colors.textSecondary,
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    marginLeft: 8,
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    width: position?.width ?? 0,
    maxHeight: 250,
    overflowY: 'auto',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 5,
    zIndex: 999999,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.2)',
  };

  const getItemStyle = (optionValue: string, isSelected: boolean): React.CSSProperties => {
    const isHovered = hoveredValue === optionValue;
    return {
      padding: '10px 12px',
      fontFamily: FONT_FAMILY,
      fontSize: 16,
      color: isHovered ? colors.onPrimary : isSelected ? colors.onPrimaryContainer : colors.text,
      backgroundColor: isHovered ? colors.primary : isSelected ? colors.primaryContainer : 'transparent',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      borderBottomStyle: 'solid',
      cursor: 'pointer',
    };
  };

  return (
    <div style={containerStyle}>
      <div ref={controlRef} style={controlStyle} onClick={toggleOpen}>
        <div style={contentStyle}>
          {selectedValues.length === 0 && (
            <span style={placeholderStyle}>{placeholder}</span>
          )}
          {multiple
            ? selectedValues.map(selectedValue => (
                <span key={selectedValue} style={badgeStyle}>
                  {getLabel(selectedValue)}
                  {!disabled && (
                    <span onClick={event => handleRemoveBadge(event, selectedValue)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                      ×
                    </span>
                  )}
                </span>
              ))
            : selectedValues.length > 0 && <span style={textStyle}>{getLabel(selectedValues[0])}</span>}
        </div>
        <span style={chevronStyle}>{open ? '▲' : '▼'}</span>
      </div>

      {open && !disabled && position &&
        createPortal(
          <div ref={dropdownRef} style={dropdownStyle}>
            {options.map(option => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <div
                  key={option.value}
                  style={getItemStyle(option.value, isSelected)}
                  onMouseEnter={() => setHoveredValue(option.value)}
                  onMouseLeave={() => setHoveredValue(null)}
                  onClick={() => (multiple ? handleMultiSelect(option.value) : handleSingleSelect(option.value))}
                >
                  {option.label}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};

export default Select;
