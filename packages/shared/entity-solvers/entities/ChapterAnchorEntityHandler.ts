import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown> | undefined, field: string) => {
  const value = row?.[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/** Presentation metadata for a Chapter's anchor Scene. */
export const chapterAnchorEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.ChapterAnchor,
  exportCollection: 'chapterAnchors',
  referenceFields: {
    chapterId: OperationLogEntityType.Chapter,
    startSceneId: OperationLogEntityType.Scene,
  },
  exportReferences: [
    { field: 'chapterId', targetEntityType: OperationLogEntityType.Chapter, required: true },
    { field: 'startSceneId', targetEntityType: OperationLogEntityType.Scene, required: true },
    { field: 'endSceneId', targetEntityType: OperationLogEntityType.Scene, required: false },
  ],
  async resolveReference(context, entityId) {
    const row = await context.read(OperationLogEntityType.ChapterAnchor, entityId);
    if (!row) return { name: undefined, type: context.translate('chapter_anchor') };
    const [chapter, scene] = await Promise.all([
      context.read(OperationLogEntityType.Chapter, stringValue(row, 'chapterId') ?? ''),
      context.read(OperationLogEntityType.Scene, stringValue(row, 'startSceneId') ?? ''),
    ]);
    return {
      name: `${stringValue(chapter, 'name') ?? context.translate('unknown_chapter')} · ${stringValue(scene, 'name') ?? context.translate('unknown_scene')}`,
      type: context.translate('chapter_anchor'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const reference = await chapterAnchorEntityHandler.resolveReference!(context, entityId);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
