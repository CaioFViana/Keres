import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntityDomainHandler } from './contracts';
import { displayFirst } from './displayName';
export const galleryEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.Gallery,
  displayName: displayFirst('title', 'fileName'),
  help: {
    source: 'gallery',
    fields: [
      'fileName',
      'mediaType',
      'mimeType',
      'sizeBytes',
      'title',
      'extraNotes',
      'linkedEntities',
      'isFavorite',
    ],
  },
  summarizePreview(row) {
    return {
      title:
        (typeof row.title === 'string' ? row.title : null) ??
        (typeof row.fileName === 'string' ? row.fileName : null) ??
        '',
      primaryDetail: typeof row.extraNotes === 'string' ? row.extraNotes : null,
      secondaryDetail: null,
    };
  },
  async resolveReference(context, id) {
    const row = await context.read(OperationLogEntityType.Gallery, id);
    const name =
      typeof row?.title === 'string' && row.title.trim()
        ? row.title
        : typeof row?.fileName === 'string' && row.fileName.trim()
          ? row.fileName
          : undefined;
    return { name, type: context.translate('gallery') };
  },
  async resolveOperationLogName(context, id) {
    const reference = await this.resolveReference!(context, id);
    return reference.name ? `${reference.type} - ${reference.name}` : reference.type;
  },
};
