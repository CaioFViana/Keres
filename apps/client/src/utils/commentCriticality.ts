import type { Ionicons } from '@expo/vector-icons';

/** 1 = informacional, 2 = relevante, 3 = atenção, 4 = grave, 5 = imediato. Só o ícone muda
 *  entre níveis - sem cor/escala própria (ver plano de implementação). */
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
