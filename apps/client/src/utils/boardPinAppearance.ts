import type { BoardPinEntity } from '@keres/shared';
import {
  getEntityAppearance,
  getWorldPieceSectionAppearance,
  WORLD_PIECE_SECTIONS,
} from '@keres/shared';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';

export interface BoardCardAppearance {
  color: string;
  icon: string;
}

export function worldPieceSectionFromBoardPinGroup(group?: string): WorldPieceSection | null {
  if (!group?.startsWith('worldrule:')) return null;
  const section = group.slice('worldrule:'.length);
  return (WORLD_PIECE_SECTIONS as readonly string[]).includes(section)
    ? (section as WorldPieceSection)
    : null;
}

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
  return getBoardPinAppearance(kind, entityType, group).color;
}

export function boardPinIcon(
  kind: 'note' | 'entity',
  entityType?: BoardPinEntity,
  group?: string,
): string {
  return getBoardPinAppearance(kind, entityType, group).icon;
}

/** World Pieces inherit their section's visual language; every other pin uses its entity type. */
export function getBoardPinAppearance(
  kind: 'note' | 'entity',
  entityType?: BoardPinEntity,
  group?: string,
): BoardCardAppearance {
  const worldPieceSection = worldPieceSectionFromBoardPinGroup(group);
  return worldPieceSection
    ? getWorldPieceSectionAppearance(worldPieceSection)
    : getEntityAppearance(boardPinAppearanceType(kind, entityType, group));
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
    case 'WorldRule':
      return 'world_rule';
    case 'Board':
      return 'board';
    case 'Event':
      return 'event';
    case 'Note':
      return kind === 'note' ? 'board_note' : 'note';
    default:
      return 'board_note';
  }
}
