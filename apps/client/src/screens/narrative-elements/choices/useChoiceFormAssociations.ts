import { useChoiceChecks } from '@/src/screens/narrative-elements/choices/useChoiceChecks';
import { useEntityEffects } from '@/src/hooks/choice/useEntityEffects';
import { useEntityRelations } from '@/src/hooks/relations/useEntityRelations';

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
