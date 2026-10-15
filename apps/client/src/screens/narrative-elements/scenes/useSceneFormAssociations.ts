import { useEffect } from 'react';
import { useEntityEffects } from '@/src/hooks/useEntityEffects';
import { useEntityRelations } from '@/src/hooks/useEntityRelations';
import { useSceneCharacterPresence } from '@/src/hooks/useSceneCharacterPresence';

/** Owns the scene-scoped relation, character-presence and effect lifecycles used by the form. */
export function useSceneFormAssociations(
  sceneId: string | undefined,
  storyId: string | undefined,
  isBranching: boolean,
) {
  const characterPresence = useSceneCharacterPresence(sceneId, storyId);
  const effects = useEntityEffects('Scene', sceneId, storyId, isBranching);
  const relations = useEntityRelations({
    entityType: 'Scene',
    entityId: sceneId,
    preserveDraftOnEntityCreation: true,
  });
  const { fetchCharacterSceneRelations } = characterPresence;

  useEffect(() => {
    void fetchCharacterSceneRelations();
  }, [fetchCharacterSceneRelations]);

  return { characterPresence, effects, relations };
}
