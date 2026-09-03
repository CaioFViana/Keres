import { Platform, StyleSheet } from 'react-native';
import type { ThemeColors } from '@keres/shared';

// Compatibility re-export: color analysis stays in the pure utility module so it can be
// shared by themed and non-themed components without an import cycle.
export { isColorLight } from '@keres/shared';

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

export const getCommonCardStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
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
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
    default:
      r = 0;
      g = 0;
      b = 0;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
}

export const getCommonContainerStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      width: '100%',
      padding: 20,
    },
    // Add other common container styles here if needed
  });

export const getCommonInputStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    input: {
      height: 50,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      marginBottom: 0,
      // An explicit size keeps native inputs aligned with picker controls on React Native Web.
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
      width: '100%',
      // React Native Web otherwise adds a browser outline on focus, which looks
      // like a second border on inputs and controls. Focus is still represented
      // by the component's own themed border/state.
      ...(Platform.OS === 'web'
        ? ({
            outlineColor: 'transparent',
            outlineStyle: 'none',
            outlineWidth: 0,
          } as any)
        : {}),
    },
    // The standard text area used by forms. `TextInput` clears the single-line `height` whenever
    // it receives a `minHeight`, so this is deliberately a minimum rather than a fixed height.
    multiline: {
      minHeight: 5 * 20,
      textAlignVertical: 'top',
    },
    customComponentInput: {
      paddingHorizontal: 0,
      minHeight: 0,
      paddingBottom: 50,
      paddingTop: 0,
    },
    // Add other common input styles here if needed
  });

/**
 * A form's skeleton: scrolling, title, field label, section, switch row
 * and the two footer buttons.
 *
 * A plain object, and not `StyleSheet.create`, so it can be spread inside the screen's own
 * `StyleSheet.create` - the same arrangement as `relationSectionStyleDefs`. The screen declares what is its
 * own after the spread and, if it needs to, overrides one entry without having to give up the
 * rest.
 *
 * It exists because these same measurements were copied across ten to twenty screens each, with
 * accidental variations of a comma or of a `color` - and `deleteButton` went as far as hard-coding
 * a literal `'red'` in five of them, ignoring the palette.
 */
export const commonFormStyleDefs = (colors: ThemeColors, scrollBottomPadding?: number) => ({
  scrollViewContent: {
    padding: 20,
    paddingBottom: scrollBottomPadding,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginTop: 15,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginTop: 15,
    marginBottom: 5,
  },
  switchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 15,
    marginBottom: 5,
  },
  saveButton: {
    marginTop: 10,
    marginBottom: 0,
  },
  deleteButton: {
    backgroundColor: colors.error,
    marginBottom: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
});

/**
 * A detail screen's skeleton: the entity's name, section titles, the footer's back button
 * and the empty state. The same arrangement as `commonFormStyleDefs`.
 */
export const commonDetailStyleDefs = (colors: ThemeColors) => ({
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
    marginTop: 15,
    marginBottom: 5,
  },
  buttonContainer: {
    marginTop: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
  },
});

/**
 * The frame of a screen that hands its body over to a list or a chart: it takes up the screen and uses the
 * theme's background, without `getCommonContainerStyles`'s breathing room (which is for screens with direct
 * content, not for lists that need to bleed to the edge).
 *
 * It was the base's most common duplication - 22 screens declaring the same two lines.
 */
export const commonScreenStyleDefs = (colors: ThemeColors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
