import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme';

/** The card of a server's facts, a list of label and value rows: the plan's, and the server's own. */
export const serverCardStyleDefs = (colors: ThemeColors) => ({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { fontSize: 14, color: colors.textSecondary },
  value: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right' as const,
  },
});
