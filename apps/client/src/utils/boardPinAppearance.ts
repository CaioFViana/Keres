import type { BoardPinEntity } from '@keres/shared';
import { getEntityAppearance } from '@keres/shared';

export function boardPinAccent(kind: 'note' | 'entity', entityType?: BoardPinEntity): string {
  if (kind === 'note') return getEntityAppearance('Note').color;
  return getEntityAppearance(entityType ?? 'Character').color;
}

export function boardPinIcon(kind: 'note' | 'entity', entityType?: BoardPinEntity): string {
  if (kind === 'note') return getEntityAppearance('Note').icon;
  return getEntityAppearance(entityType ?? 'Character').icon;
}

export function boardPinTypeKey(kind: 'note' | 'entity', entityType?: BoardPinEntity): string {
  if (kind === 'note') return 'board_note';
  switch (entityType) {
    case 'Character':
      return 'character';
    case 'Location':
      return 'location';
    case 'Scene':
      return 'scene';
    case 'Item':
      return 'item';
    case 'Gallery':
      return 'gallery';
    case 'Chapter':
      return 'chapter';
    case 'Note':
      return 'note';
    default:
      return 'board_note';
  }
}
