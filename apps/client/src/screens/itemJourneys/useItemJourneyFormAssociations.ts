import { useEntityRelations } from '../../hooks/useEntityRelations';

/** Owns relation wiring used by the ItemJourney form. */
export function useItemJourneyFormAssociations(currentItemJourneyId: string | undefined) {
  const relations = useEntityRelations({
    entityType: 'ItemJourney',
    entityId: currentItemJourneyId,
    preserveDraftOnEntityCreation: true,
  });

  return {
    ...relations,
    itemJourneyNoteRelations: relations.noteRelations,
  };
}
