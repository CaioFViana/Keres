import {
  getWorldPieceSectionAppearance,
  type EntityAppearanceKey,
  WORLD_PIECE_SECTIONS,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MultiSelectGroup } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useDrizzle } from '../db';
import { boards, chapters, galleries, worldRules } from '../db/schema';
import { loadEntityOptions } from '../utils/entityOptions';
import { useStoryVocabulary } from '../vocabulary/useStoryVocabulary';
import type { WorldPieceSection } from '@keres/shared/entities/WorldRule';

type BoardPinGroup =
  | 'character'
  | 'location'
  | 'note'
  | 'scene'
  | 'item'
  | 'gallery'
  | 'chapter'
  | 'event'
  | `worldrule:${WorldPieceSection}`
  | 'board';

export interface BoardPinOption {
  entityType:
    | 'Character'
    | 'Location'
    | 'Note'
    | 'Scene'
    | 'Item'
    | 'Gallery'
    | 'Chapter'
    | 'WorldRule'
    | 'Board';
  entityId: string;
  label: string;
  group: BoardPinGroup;
}

export function encodeBoardPinValue(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export function decodeBoardPinValue(
  value: string,
): { entityType: string; entityId: string } | null {
  const separator = value.indexOf(':');
  if (separator < 0) return null;
  return { entityType: value.slice(0, separator), entityId: value.slice(separator + 1) };
}

/**
 * Entities that can be pinned on a board. Events are stored as Chapter; the picker splits them.
 */
export function useBoardPinOptions(storyId: string | undefined, excludedBoardId?: string) {
  const db = useDrizzle();
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const [options, setOptions] = useState<BoardPinOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const [
        character,
        location,
        note,
        scene,
        item,
        worldRule,
        galleryRows,
        chapterRows,
        boardRows,
      ] = await Promise.all([
        loadEntityOptions(db, storyId, 'Character'),
        loadEntityOptions(db, storyId, 'Location'),
        loadEntityOptions(db, storyId, 'Note'),
        loadEntityOptions(db, storyId, 'Scene'),
        loadEntityOptions(db, storyId, 'Item'),
        db
          .select({ id: worldRules.id, name: worldRules.title, section: worldRules.section })
          .from(worldRules)
          .where(and(eq(worldRules.storyId, storyId), eq(worldRules.isDeleted, false)))
          .all(),
        db
          .select()
          .from(galleries)
          .where(and(eq(galleries.storyId, storyId), eq(galleries.isDeleted, false)))
          .all(),
        db
          .select()
          .from(chapters)
          .where(and(eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)))
          .all(),
        db
          .select()
          .from(boards)
          .where(and(eq(boards.storyId, storyId), eq(boards.isDeleted, false)))
          .all(),
      ]);

      const next: BoardPinOption[] = [
        ...character.map((row) => ({
          entityType: 'Character' as const,
          entityId: row.id,
          label: row.name,
          group: 'character' as const,
        })),
        ...location.map((row) => ({
          entityType: 'Location' as const,
          entityId: row.id,
          label: row.name,
          group: 'location' as const,
        })),
        ...note.map((row) => ({
          entityType: 'Note' as const,
          entityId: row.id,
          label: row.name,
          group: 'note' as const,
        })),
        ...scene.map((row) => ({
          entityType: 'Scene' as const,
          entityId: row.id,
          label: row.name,
          group: 'scene' as const,
        })),
        ...item.map((row) => ({
          entityType: 'Item' as const,
          entityId: row.id,
          label: row.name,
          group: 'item' as const,
        })),
        ...worldRule.map((row) => ({
          entityType: 'WorldRule' as const,
          entityId: row.id,
          label: row.name,
          group: `worldrule:${row.section}` as const,
        })),
        ...galleryRows.map((row) => ({
          entityType: 'Gallery' as const,
          entityId: row.id,
          label: row.title || row.fileName,
          group: 'gallery' as const,
        })),
        ...chapterRows.map((row) => ({
          entityType: 'Chapter' as const,
          entityId: row.id,
          label: row.name,
          group: row.type === 'event' ? ('event' as const) : ('chapter' as const),
        })),
        ...boardRows
          .filter((row) => row.id !== excludedBoardId)
          .map((row) => ({
            entityType: 'Board' as const,
            entityId: row.id,
            label: row.name,
            group: 'board' as const,
          })),
      ];
      setOptions(next);
    } catch (error) {
      console.log('useBoardPinOptions: failed to load pin candidates.', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [db, excludedBoardId, storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedOptions: MultiSelectGroup[] = useMemo(() => {
    const standardGroups: {
      key: Exclude<BoardPinGroup, `worldrule:${WorldPieceSection}`>;
      label: string;
      appearanceType: EntityAppearanceKey;
    }[] = [
      { key: 'character', label: term('Character', true), appearanceType: 'Character' },
      { key: 'location', label: term('Location', true), appearanceType: 'Location' },
      { key: 'scene', label: term('Scene', true), appearanceType: 'Scene' },
      { key: 'chapter', label: term('Chapter', true), appearanceType: 'Chapter' },
      { key: 'event', label: term('Event', true), appearanceType: 'Event' },
      { key: 'item', label: t('item_plural'), appearanceType: 'Item' },
      { key: 'note', label: t('note_plural'), appearanceType: 'Note' },
      { key: 'gallery', label: t('gallery'), appearanceType: 'Gallery' },
      { key: 'board', label: t('boards_title'), appearanceType: 'Board' },
    ];
    const groups: MultiSelectGroup[] = [
      ...standardGroups.map((group) => ({
        key: group.key,
        label: group.label,
        entityType: group.appearanceType,
        options: options
          .filter((option) => option.group === group.key)
          .map((option) => ({
            label: option.label,
            value: encodeBoardPinValue(option.entityType, option.entityId),
          })),
      })),
      ...WORLD_PIECE_SECTIONS.map((section) => {
        const appearance = getWorldPieceSectionAppearance(section);
        const key = `worldrule:${section}`;
        return {
          key,
          label: t(`world_piece_section_${section}`),
          icon: appearance.icon as MultiSelectGroup['icon'],
          color: appearance.color,
          options: options
            .filter((option) => option.group === key)
            .map((option) => ({
              label: option.label,
              value: encodeBoardPinValue(option.entityType, option.entityId),
            })),
        };
      }),
    ];
    return groups.filter((group) => group.options.length > 0);
  }, [options, t, term]);

  return { options, groupedOptions, loading, reload: load };
}
