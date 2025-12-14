import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, useTheme } from '../../../theme';
import Button from '../Button/Button';

const { width } = Dimensions.get('window');
const COLOR_PICKER_SIZE = width * 0.7; // 70% of screen width
const SLIDER_HEIGHT = 20;

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
    const x = (saturation / 100) * COLOR_PICKER_SIZE;
    const y = (1 - (value / 100)) * COLOR_PICKER_SIZE; // Invert for UI
    return { left: x - 10, top: y - 10 }; // Adjust for handle size
  }, [saturation, value]);

  const hueSliderHandlePosition = useCallback(() => {
    const x = (hue / 360) * COLOR_PICKER_SIZE;
    return { left: x - 10 }; // Adjust for handle size
  }, [hue]);

  const styles = StyleSheet.create({
    colorPickerContainer: {
      width: COLOR_PICKER_SIZE + 40, // Add some padding
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background, // Use background color
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
      textAlign: 'center',
    },
    saturationValuePicker: {
      width: COLOR_PICKER_SIZE,
      height: COLOR_PICKER_SIZE,
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
      width: COLOR_PICKER_SIZE,
      height: SLIDER_HEIGHT,
      borderRadius: SLIDER_HEIGHT / 2,
      overflow: 'hidden',
      marginBottom: 20,
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
  });

  return (
    <View style={styles.colorPickerContainer}>
      {title && <Text style={styles.title}>{title}</Text>}

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
    </View>
  );
};

export default ColorPickerModal;
