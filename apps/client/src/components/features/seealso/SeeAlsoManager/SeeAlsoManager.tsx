import type { SeeAlsoEntityType } from '@keres/shared';
import React, { forwardRef, useCallback, useImperativeHandle, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import {
  decodeSeeAlsoValue,
  encodeSeeAlsoValue,
  useSeeAlsoEntityOptions,
} from '../../../../hooks/useSeeAlsoEntityOptions';
import { useNavigateToEntityDetail } from '../../../../hooks/useNavigateToEntityDetail';
import { useSeeAlsoRelations } from '../../../../hooks/useSeeAlsoRelations';
import { ENTITY_TYPE_ICONS } from '../../../../utils/entityTypeIcons';

interface SeeAlsoManagerProps {
  storyId: string;
  entityType: SeeAlsoEntityType;
  entityId: string;
  editable: boolean;
  /** Lets a domain-specific manager reuse the relation lifecycle with its own user-facing name. */
  title?: string;
  /** A specialised manager can own one relation subset without removing generic See also links. */
  allowedEntityTypes?: readonly SeeAlsoEntityType[];
}

/**
 * An escape hatch for the form to call after the main save, when `entityId` has gone from empty
 * to the real id - the same reason as `PanZoomCanvasHandle`: the component owns the hook
 * (`useSeeAlsoRelations`) that holds the pending selection, so only it can trigger the replay.
 */
export interface SeeAlsoManagerHandle {
  persistPending: (targetEntityId: string) => Promise<void>;
}

/**
 * A detail screen's "See also" section: a clickable list of other entities marked
 * as related to this one (a mutual link - see useSeeAlsoRelations), plus a picker
 * (`MultiSelectPill` in grouped mode, the same one used in the Gallery) for adding/removing links.
 *
 * It applies the change immediately on selecting/deselecting (with no separate "Save" button) -
 * the same pattern as TagChipList/NoteManager/CharacterRelationManager on these same screens.
 */
const SeeAlsoManager = forwardRef<SeeAlsoManagerHandle, SeeAlsoManagerProps>(
  ({ storyId, entityType, entityId, editable, title, allowedEntityTypes }, ref) => {
    const { t } = useTranslation();
    const navigateToDetail = useNavigateToEntityDetail();
    const { relations, save, persistSeeAlsoRelations } = useSeeAlsoRelations(
      storyId,
      entityType,
      entityId,
      allowedEntityTypes,
    );

    useImperativeHandle(ref, () => ({ persistPending: persistSeeAlsoRelations }), [
      persistSeeAlsoRelations,
    ]);
    const { groupedOptions, optionsByValue } = useSeeAlsoEntityOptions(
      storyId,
      entityType,
      entityId,
    );
    const visibleGroups = useMemo(
      () =>
        allowedEntityTypes
          ? groupedOptions.filter((group) =>
              allowedEntityTypes.includes(
                group.key.startsWith('WorldRule:') ? 'WorldRule' : (group.key as SeeAlsoEntityType),
              ),
            )
          : groupedOptions,
      [allowedEntityTypes, groupedOptions],
    );

    const selectedValues = useMemo(
      () => relations.map((relation) => encodeSeeAlsoValue(relation.otherType, relation.otherId)),
      [relations],
    );

    const handleSelectionChange = useCallback(
      (selected: string[]) => {
        const targets = selected
          .map(decodeSeeAlsoValue)
          .filter((ref): ref is NonNullable<typeof ref> => ref !== null);
        save(targets);
      },
      [save],
    );

    const handlePress = useCallback(
      (otherType: SeeAlsoEntityType, otherId: string) => {
        navigateToDetail(otherType, otherId);
      },
      [navigateToDetail],
    );

    const listItems = useMemo(
      () =>
        relations.map((relation) => {
          const option = optionsByValue.get(
            encodeSeeAlsoValue(relation.otherType, relation.otherId),
          );
          return {
            id: relation.relationId,
            title: option?.name || relation.otherId,
            icon: ENTITY_TYPE_ICONS[relation.otherType],
            color: option?.color || '#607D8B',
            onPress: editable ? undefined : () => handlePress(relation.otherType, relation.otherId),
          };
        }),
      [editable, handlePress, optionsByValue, relations],
    );

    return (
      <CollapsibleCard
        title={`${title ?? t('see_also_title')} (${relations.length})`}
        initialExpanded={false}
      >
        {editable && (
          <MultiSelectPill
            groups={visibleGroups}
            selectedValues={selectedValues}
            onSelectionChange={handleSelectionChange}
            placeholder={t('see_also_select_placeholder')}
            noOptionsText={t('see_also_no_entities_available')}
          />
        )}
        <EntityRelationList items={listItems} emptyText={t('see_also_empty')} />
      </CollapsibleCard>
    );
  },
);

SeeAlsoManager.displayName = 'SeeAlsoManager';

export default SeeAlsoManager;
