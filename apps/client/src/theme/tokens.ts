import type { TextStyle } from 'react-native';

/**
 * The scales the interface is drawn from. A style takes its spacing, corner radius, type size and weight from
 * here instead of a literal, so a value that is "a little different" has to be chosen on purpose.
 *
 * The scales were read off the values the screens already used most (spacing 8/12/16/20, radius 8/10/12/16,
 * type 12/13/14/16): new code starts from them, old code moves onto them when it is touched.
 */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  /** The top corners of a bottom sheet. */
  sheet: 16,
} as const;

/** One word per weight: `'bold'` and `'700'` were both in use for the same thing. */
export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
} as const;

/**
 * Text styles without a colour (the colour comes from the palette in the component): the sizes and weights
 * that kept being written out by hand. Use as `[typography.title, { color: colors.text }]`.
 */
export const typography = {
  caption: { fontSize: fontSize.sm },
  hint: { fontSize: fontSize.md, lineHeight: 18 },
  body: { fontSize: fontSize.base, lineHeight: 20 },
  bodyLarge: { fontSize: fontSize.lg },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  heading: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
} as const satisfies Record<string, TextStyle>;
