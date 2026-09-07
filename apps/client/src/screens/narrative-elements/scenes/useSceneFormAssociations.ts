import { useEffect } from 'react';
import { useEntityEffects } from '../../../hooks/useEntityEffects';
import { useEntityRelations } from '../../../hooks/useEntityRelations';
import { useSceneCharacterPresence } from '../../../hooks/useSceneCharacterPresence';

/** Owns the scene-scoped relation, character-presence and effect lifecycles used by the form. */
export function useSceneFormAssociations(
  sceneId: string | undefined,
  storyId: string | undefined,
  isBranching: boolean,
) {
  const characterPresence = useSceneCharacterPresence(sceneId, storyId);
  const effects = useEntityEffects('Scene', sceneId, storyId, isBranching);
  const relations = useEntityRelations({ entityType: 'Scene', entityId: sceneId });
  const { fetchCharacterSceneRelations } = characterPresence;

  useEffect(() => {
    void fetchCharacterSceneRelations();
  }, [fetchCharacterSceneRelations]);

  return { characterPresence, effects, relations };
}
