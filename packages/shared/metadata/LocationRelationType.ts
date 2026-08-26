/**
 * The two kinds of relationship between Locations: `contains` is directional (locationAId is the
 * parent, locationBId is the child, and a Location can only have one live parent at a time) and
 * `connected_to` is bidirectional (an unordered pair, with no notion of hierarchy or cycles).
 */
export const LOCATION_RELATION_TYPES = ['contains', 'connected_to'] as const;

export type LocationRelationType = (typeof LOCATION_RELATION_TYPES)[number];
