import { SeeAlsoEntityType } from '../metadata/SeeAlsoEntityType';

/**
 * Vínculo "Veja também" entre duas entidades quaisquer do sistema (dentro dos tipos
 * suportados por `SeeAlsoEntityType`). Mútuo por natureza - uma única linha não-ordenada
 * (A/B) representa o vínculo dos dois lados, ao contrário de `NoteRelation`/`TagRelation`
 * que têm um lado "dono" fixo. Não há `relationType`: existe apenas um tipo de vínculo.
 */
export interface SeeAlsoRelation {
  id: string;
  storyId: string;
  entityAType: SeeAlsoEntityType;
  entityAId: string;
  entityBType: SeeAlsoEntityType;
  entityBId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean;
  deletedAt: Date | null;
}
