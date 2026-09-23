import type { BoardNodeType } from '@keres/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  boardPinAppearanceType,
  boardPinTypeKey,
  getBoardPinAppearance,
  worldPieceSectionFromBoardPinGroup,
} from '../utils/boardPinAppearance';
import type { BoardPinOption } from './useBoardPinOptions';

export interface BoardNodeTitleMeta {
  title: string;
  typeLabel: string;
  appearanceType?: string;
  appearance?: { color: string; icon: string };
  ghost?: boolean;
}

/**
 * Display titles for every board node: live pin labels for pinned entities, the
 * ghost treatment for deleted ones, and the note fallback. Pure derivation from
 * the nodes plus the pin options; the screen feeds the result to the canvas, the
 * node sheet, and the SVG export.
 */
export function useBoardNodeTitles(
  nodes: readonly BoardNodeType[],
  options: readonly BoardPinOption[],
): { titles: Record<string, BoardNodeTitleMeta>; nodeTitles: Record<string, string> } {
  const { t } = useTranslation();
  const livePins = useMemo(() => {
    const next: Record<string, { label: string; group: BoardPinOption['group'] }> = {};
    for (const option of options) {
      next[`${option.entityType}:${option.entityId}`] = {
        label: option.label,
        group: option.group,
      };
    }
    return next;
  }, [options]);

  const titles = useMemo(() => {
    const map: Record<string, BoardNodeTitleMeta> = {};
    for (const node of nodes) {
      const live =
        node.kind === 'entity' ? livePins[`${node.entityType}:${node.entityId}`] : undefined;
      const appearanceType = boardPinAppearanceType(
        node.kind,
        node.kind === 'entity' ? node.entityType : undefined,
        live?.group,
      );
      const worldPieceSection = worldPieceSectionFromBoardPinGroup(live?.group);
      const typeLabel = worldPieceSection
        ? t(`world_piece_section_${worldPieceSection}`)
        : t(
            boardPinTypeKey(
              node.kind,
              node.kind === 'entity' ? node.entityType : undefined,
              live?.group,
            ),
          );
      const appearance = getBoardPinAppearance(
        node.kind,
        node.kind === 'entity' ? node.entityType : undefined,
        live?.group,
      );
      if (node.kind === 'note') {
        map[node.id] = {
          title: node.title.trim() || t('board_note'),
          typeLabel,
          appearanceType,
          appearance,
        };
        continue;
      }
      map[node.id] = live
        ? { title: live.label, typeLabel, appearanceType, appearance }
        : {
            title: node.labelAtPin || t('board_deleted_entity'),
            typeLabel: `${typeLabel} · ${t('board_deleted_entity')}`,
            appearanceType,
            appearance,
            ghost: true,
          };
    }
    return map;
  }, [nodes, livePins, t]);

  const nodeTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(titles)) map[id] = meta.title;
    return map;
  }, [titles]);

  return { titles, nodeTitles };
}
