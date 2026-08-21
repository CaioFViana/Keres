/**
 * Os dois tipos de relacionamento entre Locations: `contains` é direcional (locationAId é o pai,
 * locationBId é o filho, uma Location só pode ter um pai vivo por vez) e `connected_to` é
 * bidirecional (par não-ordenado, sem conceito de hierarquia/ciclo).
 */
export const LOCATION_RELATION_TYPES = ['contains', 'connected_to'] as const;

export type LocationRelationType = (typeof LOCATION_RELATION_TYPES)[number];
