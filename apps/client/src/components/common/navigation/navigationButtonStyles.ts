import { StyleSheet } from 'react-native';

/** Shared hit-area/alignment for the header icon buttons (back, drawer toggle). */
export const navigationButtonStyles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 36,
    minHeight: 36,
  },
});
