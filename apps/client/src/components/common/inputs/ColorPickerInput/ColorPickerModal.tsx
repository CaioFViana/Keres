import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useResponsiveLayout } from '../../../../hooks/useResponsiveLayout';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, useTheme } from '../../../../theme';
import Button from '@/src/components/common/controls/Button/Button';

const SLIDER_HEIGHT = 20;

// Define a list of 32 standard colors (8 HUES x 4 variations)
// HUES: 0 (Red), 45 (Orange), 90 (Yellow-Green), 135 (Green), 180 (Cyan), 225 (Blue), 270 (Purple), 315 (Magenta).
const STANDARD_COLORS = [
  // Row 1 (V=100, S=50 - pastel tones)
  { h: 0, s: 50, v: 100 }, { h: 45, s: 50, v: 100 }, { h: 90, s: 50, v: 100 }, { h: 135, s: 50, v: 100 },
  { h: 180, s: 50, v: 100 }, { h: 225, s: 50, v: 100 }, { h: 270, s: 50, v: 100 }, { h: 315, s: 50, v: 100 },
  // Row 2 (V=100, S=100 - standard vibrant)
  { h: 0, s: 100, v: 100 }, { h: 45, s: 100, v: 100 }, { h: 90, s: 100, v: 100 }, { h: 135, s: 100, v: 100 },
  { h: 180, s: 100, v: 100 }, { h: 225, s: 100, v: 100 }, { h: 270, s: 100, v: 100 }, { h: 315, s: 100, v: 100 },
  // Row 3 (V=80, S=100 - slightly darker vibrant)
  { h: 0, s: 100, v: 80 }, { h: 45, s: 100, v: 80 }, { h: 90, s: 100, v: 80 }, { h: 135, s: 100, v: 80 },
  { h: 180, s: 100, v: 80 }, { h: 225, s: 100, v: 80 }, { h: 270, s: 100, v: 80 }, { h: 315, s: 100, v: 80 },
  // Row 4 (V=60, S=80 - muted darker tones)
  { h: 0, s: 80, v: 60 }, { h: 45, s: 80, v: 60 }, { h: 90, s: 80, v: 60 }, { h: 135, s: 80, v: 60 },
  { h: 180, s: 80, v: 60 }, { h: 225, s: 80, v: 60 }, { h: 270, s: 80, v: 60 }, { h: 315, s: 80, v: 60 },
].map(color => rgbToHex(hsvToRgb(color.h, color.s, color.v).r, hsvToRgb(color.h, color.s, color.v).g, hsvToRgb(color.h, color.s, color.v).b));

// The original palette is four rows of eight hues. Transposing it produces
// eight rows of four variations for the side-by-side layout without changing
// the relationship between each hue and its variants.
const TRANSPOSED_STANDARD_COLORS = Array.from({ length: 8 }, (_, rowIndex) =>
  Array.from({ length: 4 }, (_, columnIndex) => STANDARD_COLORS[columnIndex * 8 + rowIndex])
).flat();


interface ColorPickerModalProps {
  currentColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
  title?: string;
}

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  currentColor,
  onSelectColor,
  onClose,
  title,
}) => {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [value, setValue] = useState(100); // Also known as brightness
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { breakpoint } = useResponsiveLayout();
  const widthBasedPickerSize = breakpoint === 'wide'
    ? Math.min(Math.max(screenWidth * 0.32, 360), 440)
    : breakpoint === 'medium'
      ? Math.min(Math.max(screenWidth * 0.45, 320), 380)
      : Math.min(screenWidth * 0.7, 320);
  const colorPickerSize = Math.min(
    widthBasedPickerSize,
    Math.max(220, screenHeight - (breakpoint === 'compact' ? 390 : 420))
  );
  const sideBySideLayout = breakpoint !== 'compact';
  const standardColorColumns = sideBySideLayout ? 4 : 8;
  const displayedStandardColors = sideBySideLayout ? TRANSPOSED_STANDARD_COLORS : STANDARD_COLORS;
  const standardColorsWidth = sideBySideLayout
    ? Math.max(200, Math.min(220, colorPickerSize * 0.55))
    : colorPickerSize;
  const colorPickerContentWidth = colorPickerSize + (sideBySideLayout ? standardColorsWidth + 16 : 0);
  const colorCircleSize = (standardColorsWidth / standardColorColumns) - 5;

  const saturationValueRef = useRef<View>(null);
  const hueRef = useRef<View>(null);

  const [pickerLayout, setPickerLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [hueLayout, setHueLayout] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    const { r, g, b } = hexToRgb(currentColor);
    const { h, s, v } = rgbToHsv(r, g, b);
    setHue(h);
    setSaturation(s);
    setValue(v);
  }, [currentColor]);

  const getRgbFromHsv = useCallback(() => {
    return hsvToRgb(hue, saturation, value);
  }, [hue, saturation, value]);

  const currentPickedColorHex = useCallback(() => {
    const { r, g, b } = getRgbFromHsv();
    return rgbToHex(r, g, b);
  }, [getRgbFromHsv]);

  const handleColorSelect = useCallback((gestureState: any, refLayout: any, isHue: boolean) => {
    const x = gestureState.x0 + gestureState.dx;
    const y = gestureState.y0 + gestureState.dy;

    const relativeX = x - refLayout.x;
    const relativeY = y - refLayout.y;

    if (isHue) {
      let newHue = (relativeX / refLayout.width) * 360;
      newHue = Math.max(0, Math.min(360, newHue));
      setHue(newHue);
    } else {
      let newSaturation = (relativeX / refLayout.width) * 100;
      let newValue = 100 - (relativeY / refLayout.height) * 100; // Value is inverted for UI
      newSaturation = Math.max(0, Math.min(100, newSaturation));
      newValue = Math.max(0, Math.min(100, newValue));
      setSaturation(newSaturation);
      setValue(newValue);
    }
  }, []);

  const saturationValuePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        saturationValueRef.current?.measure((_x, _y, _width, _height, pageX, pageY) => {
          setPickerLayout({ x: pageX, y: pageY, width: _width, height: _height });
          handleColorSelect(gestureState, { x: pageX, y: pageY, width: _width, height: _height }, false);
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        if (pickerLayout.width > 0) {
          handleColorSelect(gestureState, pickerLayout, false);
        }
      },
    })
  ).current;

  const huePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        hueRef.current?.measure((_x, _y, _width, _height, pageX, pageY) => {
          setHueLayout({ x: pageX, y: pageY, width: _width, height: _height });
          handleColorSelect(gestureState, { x: pageX, y: pageY, width: _width, height: _height }, true);
        });
      },
      onPanResponderMove: (evt, gestureState) => {
        if (hueLayout.width > 0) {
          handleColorSelect(gestureState, hueLayout, true);
        }
      },
    })
  ).current;

  const getBackgroundColorForSatValPicker = useCallback(() => {
    const { r, g, b } = hsvToRgb(hue, 100, 100); // Max saturation and value for the base hue
    return rgbToHex(r, g, b);
  }, [hue]);

  const satValPickerHandlePosition = useCallback(() => {
    const x = (saturation / 100) * colorPickerSize;
    const y = (1 - (value / 100)) * colorPickerSize; // Invert for UI
    return { left: x - 10, top: y - 10 }; // Adjust for handle size
  }, [colorPickerSize, saturation, value]);

  const hueSliderHandlePosition = useCallback(() => {
    const x = (hue / 360) * colorPickerSize;
    return { left: x - 10 }; // Adjust for handle size
  }, [colorPickerSize, hue]);

  const handleStandardColorSelect = useCallback((hexColor: string) => {
    const { r, g, b } = hexToRgb(hexColor);
    const { h, s, v } = rgbToHsv(r, g, b);
    setHue(h);
    setSaturation(s);
    setValue(v);
  }, []);

  const styles = StyleSheet.create({
    colorPickerContainer: {
      width: colorPickerContentWidth + 40, // Add some padding
      backgroundColor: colors.background, // Use background color
      flexShrink: 1,
    },
    scrollContent: {
      alignItems: 'center',
      padding: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
      textAlign: 'center',
    },
    saturationValuePicker: {
      width: colorPickerSize,
      height: colorPickerSize,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 20,
    },
    pickerHandle: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.text, // Use text color for handle border
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 1,
    },
    hueSlider: {
      width: colorPickerSize,
      height: SLIDER_HEIGHT,
      borderRadius: SLIDER_HEIGHT / 2,
      overflow: 'hidden',
      marginBottom: 20,
    },
    pickerWorkspace: {
      width: colorPickerContentWidth,
      flexDirection: sideBySideLayout ? 'row' : 'column',
      alignItems: sideBySideLayout ? 'flex-start' : 'center',
    },
    pickerControls: {
      width: colorPickerSize,
      alignItems: 'center',
    },
    sliderHandle: {
      position: 'absolute',
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.text, // Use text color for handle border
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 1,
      top: (SLIDER_HEIGHT - 20) / 2, // Center vertically
    },
    previewColor: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 2,
      borderColor: colors.border, // Use border color
      marginBottom: 10,
    },
    hexText: {
      fontSize: 16,
      marginBottom: 20,
      fontWeight: 'bold',
      color: colors.text, // Use text color
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 5,
      minWidth: 100,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: colors.textSecondary,
      width: '40%'
    },
    selectButton: {
      backgroundColor: colors.primary,
      width: '40%'
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
    buttonWrapper: {
      width: '47%',
    },
    standardColorsContainer: {
      width: standardColorsWidth,
      marginTop: sideBySideLayout ? 0 : 10,
      marginBottom: 20,
      marginLeft: sideBySideLayout ? 16 : 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between', // Distribute items evenly
    },
    colorCircle: {
      width: colorCircleSize,
      height: colorCircleSize,
      borderRadius: colorCircleSize / 2,
      margin: 2.5, // Small margin between circles
      borderWidth: 1,
      borderColor: colors.border,
    },
  });

  return (
    <ScrollView
      style={styles.colorPickerContainer}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.pickerWorkspace}>
        <View style={styles.pickerControls}>
          {/* Saturation and Value Picker */}
          <View
            ref={saturationValueRef}
            style={[styles.saturationValuePicker, { backgroundColor: getBackgroundColorForSatValPicker() }]}
            {...saturationValuePanResponder.panHandlers}
          >
            <LinearGradient
              colors={['#FFFFFF', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['#000000', 'transparent']}
              start={{ x: 0, y: 1 }}
              end={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.pickerHandle, satValPickerHandlePosition(), { backgroundColor: currentPickedColorHex() }]} />
          </View>

          {/* Hue Slider */}
          <View
            ref={hueRef}
            style={styles.hueSlider}
            {...huePanResponder.panHandlers}
          >
            <LinearGradient
              colors={[
                '#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.sliderHandle, hueSliderHandlePosition(), { backgroundColor: `hsl(${hue}, 100%, 50%)` }]} />
          </View>
        </View>

        {/* Standard Colors Palette */}
        <View style={styles.standardColorsContainer}>
          <View style={styles.colorGrid}>
            {displayedStandardColors.map((item) => (
              <TouchableOpacity key={item} onPress={() => handleStandardColorSelect(item)}>
                <View style={[styles.colorCircle, { backgroundColor: item }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Current Color Preview */}
      <View style={[styles.previewColor, { backgroundColor: currentPickedColorHex() }]} />
      <Text style={styles.hexText}>{currentPickedColorHex().toUpperCase()}</Text>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <View style={styles.buttonWrapper}>
          <Button onPress={onClose} style={{ backgroundColor: colors.textSecondary }}>{t('cancel')}</Button>
        </View>
        <View style={styles.buttonWrapper}>
          <Button onPress={() => onSelectColor(currentPickedColorHex())} style={{ backgroundColor: colors.primary }}>{t('select')}</Button>
        </View>
      </View>
    </ScrollView>
  );
};

export default ColorPickerModal;
