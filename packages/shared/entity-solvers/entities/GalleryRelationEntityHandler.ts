import { OperationLogEntityType } from '../../metadata/OperationLogEntityType';
import type { EntitySolverContext } from '../contracts';
import { resolveEntityReference } from '../EntityReferenceResolver';
import type { EntityDomainHandler } from './contracts';

const stringValue = (row: Record<string, unknown>, field: string) => {
  const value = row[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

const resolveName = async (context: EntitySolverContext, entityId: string) => {
  const row = await context.read(OperationLogEntityType.GalleryRelation, entityId);
  if (!row) return undefined;
  const [gallery, owner] = await Promise.all([
    resolveEntityReference(
      context,
      OperationLogEntityType.Gallery,
      stringValue(row, 'galleryId') ?? '',
    ),
    resolveEntityReference(
      context,
      stringValue(row, 'ownerType') as OperationLogEntityType,
      stringValue(row, 'ownerId') ?? '',
    ),
  ]);
  return context.translate('gallery_attributed_to_entity', {
    medianame: gallery.name ?? context.translate('unknown_gallery'),
    entityname: owner.name ?? context.translate('unknown_entity'),
    entitytype: owner.type ?? context.translate('unknown_entity_type'),
  });
};

/** Presentation metadata for media attributed to an entity. */
export const galleryRelationEntityHandler: EntityDomainHandler = {
  entityType: OperationLogEntityType.GalleryRelation,
  referenceFields: { galleryId: OperationLogEntityType.Gallery },
  async resolveReference(context, entityId) {
    return {
      name: await resolveName(context, entityId),
      type: context.translate('gallery_relation'),
    };
  },
  async resolveOperationLogName(context, entityId) {
    const name = await resolveName(context, entityId);
    const type = context.translate('gallery_relation');
    return name ? `${type} - ${name}` : type;
  },
};
