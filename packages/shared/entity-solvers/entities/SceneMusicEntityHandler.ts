import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import { resolveCompactEntityLabel } from '../compactEntityName';
import type { EntityDomainHandler } from './contracts';
import { createSimpleEntityHandler } from './createSimpleEntityHandler';

const simple = createSimpleEntityHandler({
  entityType: OperationLogEntityType.SceneMusic,
  exportCollection: 'sceneMusic',
  conflictLabelKey: 'scene_music',
  displayField: 'cue',
  previewDetailsFields: ['cue'],
  help: { source: 'scene-music', fields: ['role', 'cue'] },
  exportReferences: [
    { field: 'sceneId', targetEntityType: OperationLogEntityType.Scene, required: true },
    // The target may be gone while the link and its cue stay: the references are optional.
    { field: 'songId', targetEntityType: OperationLogEntityType.Song, required: false },
    { field: 'galleryId', targetEntityType: OperationLogEntityType.Gallery, required: false },
  ],
});

const stringOf = (value: unknown) => (typeof value === 'string' && value.trim() ? value : '');

/**
 * A piece of music a scene has: a song of the story or a Gallery medium, with its role and cue.
 * Named by what it points at and the scene it is in, because the cue is often empty.
 */
export const sceneMusicEntityHandler: EntityDomainHandler = {
  ...simple,
  async resolveCompactName(context, entityId) {
    const row = await context.read(OperationLogEntityType.SceneMusic, entityId);
    if (!row) return undefined;
    const galleryId = stringOf(row.galleryId);
    const songId = stringOf(row.songId);
    const target = galleryId
      ? await resolveCompactEntityLabel(context, OperationLogEntityType.Gallery, galleryId)
      : songId
        ? await resolveCompactEntityLabel(context, OperationLogEntityType.Song, songId)
        : stringOf(row.cue) || '♪';
    const scene = await resolveCompactEntityLabel(
      context,
      OperationLogEntityType.Scene,
      stringOf(row.sceneId),
    );
    return `${target} @ ${scene}`;
  },
};
