import { useChoiceChecks } from '../../../hooks/useChoiceChecks';
import { useEntityEffects } from '../../../hooks/useEntityEffects';
import { useEntityRelations } from '../../../hooks/useEntityRelations';

/** Owns relation, check and effect wiring used by the Choice form. */
export function useChoiceFormAssociations(
  currentChoiceId: string | undefined,
  storyId: string | undefined,
  isBranching: boolean,
) {
  const checks = useChoiceChecks(currentChoiceId, storyId, isBranching);
  const effects = useEntityEffects('Choice', currentChoiceId, storyId, isBranching);
  const relations = useEntityRelations({
    entityType: 'Choice',
    entityId: currentChoiceId,
    preserveDraftOnEntityCreation: true,
  });

  return {
    checks,
    effects,
    relations,
  };
}
