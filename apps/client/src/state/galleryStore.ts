import { MediaType } from '@keres/shared';
import { GallerySelect } from '../db/schemas/galleries';
import { createGalleryService, GalleryService } from '../services/storymanagement/GalleryService';
import { createEntityStore } from './createEntityStore';

export type { FavoriteFilterState } from '../types/entityFilters';

/**
 * A galeria não filtra por etiquetas, então o slot genérico `activeFilterTags` da fábrica
 * de stores carrega aqui os tipos de mídia selecionados ('image' | 'video' | 'audio').
 * Reaproveitar o slot é o que permite usar `useEntityListScreen` e a barra de filtros
 * compartilhada sem um caminho paralelo só para esta tela.
 */
export const useGalleryStore = createEntityStore<'galleries', GallerySelect, GalleryService>({
  collectionKey: 'galleries',
  createService: createGalleryService,
  fetchEntities: (service, p) =>
    service.getGalleriesByStoryId(p.storyId, {
      searchTerm: p.searchTerm,
      mediaTypes: p.activeFilterTags as MediaType[],
      favoriteFilterState: p.favoriteFilterState,
      sortBy: p.activeSort,
      sortDirection: p.sortDirection,
    }),
  updateFavorite: (service, userId, id, isFavorite) =>
    service.updateGalleryFavoriteStatus(userId, id, isFavorite),
  changeEvent: 'gallery_changed',
  defaultSort: 'createdAt',
  defaultSortDirection: 'desc',
  errorMessages: {
    fetch: 'Failed to load gallery media.',
    toggleFavorite: 'Failed to update media favorite status.',
  },
});
