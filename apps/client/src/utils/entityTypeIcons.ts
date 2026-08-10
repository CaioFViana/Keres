import { Ionicons } from '@expo/vector-icons';
import { GlobalSearchEntityType } from '@keres/shared/metadata/globalSearchFields';

/**
 * Ícone por tipo de entidade, usado em qualquer lugar que precise exibir "ícone + nome" para
 * uma entidade genérica (busca global, "Veja também", lista de comentários). Extraído do que
 * era um mapa privado dentro de `GlobalSearchResultItem` para que as demais telas não
 * duplicassem os mesmos 10 pares. Indexado pelo tipo mais amplo (`GlobalSearchEntityType`,
 * 10 tipos) - subconjuntos como `SeeAlsoEntityType` (8 tipos) ou `CommentEntityType` (10
 * tipos) indexam aqui sem cast.
 */
export const ENTITY_TYPE_ICONS: Record<GlobalSearchEntityType, keyof typeof Ionicons.glyphMap> = {
  Character: 'person-outline',
  Scene: 'film-outline',
  Location: 'location-outline',
  Item: 'cube-outline',
  ItemJourney: 'swap-horizontal-outline',
  Tag: 'pricetag-outline',
  Choice: 'git-branch-outline',
  Chapter: 'book-outline',
  Note: 'document-text-outline',
  WorldRule: 'shield-checkmark-outline',
};
