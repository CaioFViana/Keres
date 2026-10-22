import type { ViewStyle } from 'react-native';

/**
 * Style properties that exist only on the web (`cursor: 'col-resize'`, `outlineStyle: 'none'`): react-native-web
 * passes them to the DOM, and React Native's own style types do not list them. Wrapping them here keeps the
 * one cast in one place, and keeps native from ever receiving them (callers guard with `Platform.OS === 'web'`).
 */
export function webOnlyStyle(style: Record<string, string | number>): ViewStyle {
  return style as ViewStyle;
}
