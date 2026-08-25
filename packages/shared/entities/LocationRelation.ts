import type { LocationRelationType } from '../metadata/LocationRelationType';

export interface LocationRelation {
  id: string;
  storyId: string;
  locationAId: string;
  locationBId: string;
  relationType: LocationRelationType;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
