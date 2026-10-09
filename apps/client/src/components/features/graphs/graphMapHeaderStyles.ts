import type { ThemeColors } from '@keres/shared/theme/ThemeColors';

/** The title and the context line of a graph screen's header - the same on every map. */
export const graphMapHeaderStyleDefs = (colors: ThemeColors) => ({
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: colors.text,
    paddingHorizontal: 12,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    paddingHorizontal: 12,
    marginTop: 1,
  },
});
