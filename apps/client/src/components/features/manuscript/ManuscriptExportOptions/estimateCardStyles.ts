import type { ThemeColors } from '@/src/theme';
import { typography } from '@/src/theme/tokens';

/** The surface both page estimates sit on: the count as the headline, what it stands on beneath. */
export const estimateCardStyleDefs = (colors: ThemeColors) => ({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    marginTop: 12,
    padding: 12,
  },
  headline: { ...typography.title, color: colors.text },
  sub: { color: colors.textSecondary, lineHeight: 19 },
  heading: { color: colors.text, fontWeight: '700' as const, marginTop: 8 },
});
