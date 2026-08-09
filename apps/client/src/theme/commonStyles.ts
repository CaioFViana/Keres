import { Platform, StyleSheet } from 'react-native';
import { useThemeStore } from '../state/themeStore';
import { themes } from './palettes';
import { ThemeColors } from './ThemeColors';

// Compatibility re-export: color analysis stays in the pure utility module so it can be
// shared by themed and non-themed components without an import cycle.
export { isColorLight } from '../utils/colorUtils';

// Helper function to slightly saturate a hex color
export const saturateColor = (hex: string, factor: number = 1.1): string => {
  if (!hex || hex.length !== 7) return hex; // Expects #RRGGBB

  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r = Math.min(255, Math.floor(r * factor));
  g = Math.min(255, Math.floor(g * factor));
  b = Math.min(255, Math.floor(b * factor));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export const useThemeColors = (themeName: string | null | undefined): ThemeColors => {
  const { darkMode } = useThemeStore(); // Get darkMode state

  const selectedTheme = themes[themeName || 'default'] || themes["default"];

  return darkMode ? selectedTheme.darkColors : selectedTheme.lightColors;
};

export const getCommonCardStyles = (colors: ThemeColors) => StyleSheet.create({
  cardContainer: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderColor: colors.primary,
    borderWidth: 1,
    backgroundColor: saturateColor(colors.card),
  },
  cardText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.onSurface,
  },
});


// Helper functions for color conversion (RGB to HSV and HSV to RGB)
// These are standard algorithms, adapted for React Native

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

export function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  let h, s, v;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  v = max;

  const delta = max - min;
  if (delta === 0) {
    h = 0;
    s = 0;
  } else {
    s = delta / max;
    if (r === max) {
      h = (g - b) / delta;
    } else if (g === max) {
      h = 2 + (b - r) / delta;
    } else {
      h = 4 + (r - g) / delta;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  return { h: h, s: s * 100, v: v * 100 };
}

export function hsvToRgb(h: number, s: number, v: number) {
  s /= 100;
  v /= 100;

  let r, g, b;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = 0; g = 0; b = 0; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}


export const getCommonContainerStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    padding: 20,
  },
  // Add other common container styles here if needed
});

export const getCommonInputStyles = (colors: ThemeColors) => StyleSheet.create({
  input: {
    height: 50,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 0,
    color: colors.text,
    backgroundColor: colors.surface,
    width: '100%',
    // React Native Web otherwise adds a browser outline on focus, which looks
    // like a second border on inputs and controls. Focus is still represented
    // by the component's own themed border/state.
    ...(Platform.OS === 'web' ? {
      outlineColor: 'transparent',
      outlineStyle: 'none',
      outlineWidth: 0,
    } as any : {}),
  },
  customComponentInput: {
    paddingHorizontal: 0, 
    minHeight: 0, 
    paddingBottom:50, 
    paddingTop:0
  }
  // Add other common input styles here if needed
});
