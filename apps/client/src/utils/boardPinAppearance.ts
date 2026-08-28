import type { BoardPinEntity } from '@keres/shared';
import { getEntityAppearance } from '@keres/shared';

/** Events live in the Chapter table; the picker group is what tells them apart on a board. */
export function boardPinAppearanceType(
  kind: 'note' | 'entity',
  entityType?: BoardPinEntity,
  group?: string,
): string {
  if (kind === 'note') return 'Note';
  if (group === 'event') return 'Event';
  return entityType ?? 'Character';
}

export function boardPinAccent(
  kind: 'note' | 'entity',
  entityType?: BoardPinEntity,
  group?: string,
): string {
  return getEntityAppearance(boardPinAppearanceType(kind, entityType, group)).color;
}

export function boardPinIcon(
  kind: 'note' | 'entity',
  entityType?: BoardPinEntity,
  group?: string,
): string {
  return getEntityAppearance(boardPinAppearanceType(kind, entityType, group)).icon;
}

export function boardPinTypeKey(
  kind: 'note' | 'entity',
  entityType?: BoardPinEntity,
  group?: string,
): string {
  const appearance = boardPinAppearanceType(kind, entityType, group);
  switch (appearance) {
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
    case 'Event':
      return 'event';
    case 'Note':
      return kind === 'note' ? 'board_note' : 'note';
    default:
      return 'board_note';
  }
}
