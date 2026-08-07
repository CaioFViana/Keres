import type { GalleryOwnerEntity } from '../schemas/GallerySchemas';

/**
 * Vínculo entre uma mídia e uma entidade da história.
 *
 * A relação é N:N nos dois sentidos: uma entidade pode ter várias mídias e a mesma mídia
 * pode aparecer em várias entidades.
 */
export interface GalleryRelation {
  id: string
  storyId: string
  galleryId: string
  ownerId: string
  ownerType: GalleryOwnerEntity
  createdAt: Date
  updatedAt: Date
  version: number
  isDeleted: boolean
  deletedAt: Date | null
}
