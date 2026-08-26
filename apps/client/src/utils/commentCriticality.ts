import type { Ionicons } from '@expo/vector-icons';

/**
 * 1 = informational, 2 = relevant, 3 = attention, 4 = serious, 5 = immediate. Only the icon changes
 * between levels - no colour/scale of its own (see the implementation plan).
 */
export const CRITICALITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type CommentCriticality = (typeof CRITICALITY_LEVELS)[number];

export const CRITICALITY_ICONS: Record<CommentCriticality, keyof typeof Ionicons.glyphMap> = {
  1: 'information-circle-outline',
  2: 'chatbubble-ellipses-outline',
  3: 'alert-circle-outline',
  4: 'warning-outline',
  5: 'alert-outline',
};

export const DEFAULT_CRITICALITY: CommentCriticality = 3;
