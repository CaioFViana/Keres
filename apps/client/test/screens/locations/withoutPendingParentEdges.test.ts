/**
 * @jest-environment node
 */
import { withoutPendingParentEdges } from '../../../src/screens/locations/useLocationFormAssociations';
import type { LocationRelationSelect } from '../../../src/db/schema';

const edge = (
  partial: Partial<LocationRelationSelect> &
    Pick<LocationRelationSelect, 'id' | 'locationAId' | 'locationBId'>,
): LocationRelationSelect => ({
  storyId: 'story-1',
  relationType: 'contains',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...partial,
});

describe('withoutPendingParentEdges', () => {
  it('drops provisional parent intents so a later persist cannot reapply them', () => {
    const pending = [
      edge({ id: 'parent-pending', locationAId: 'old-parent', locationBId: '' }),
      edge({ id: 'child-pending', locationAId: '', locationBId: 'child-1' }),
      edge({
        id: 'connection',
        relationType: 'connected_to',
        locationAId: '',
        locationBId: 'other',
      }),
    ];

    expect(withoutPendingParentEdges(pending, 'loc-1').map((item) => item.id)).toEqual([
      'child-pending',
      'connection',
    ]);
  });

  it('also drops parent edges already rewritten to the retained location id', () => {
    const pending = [
      edge({ id: 'rewritten-parent', locationAId: 'old-parent', locationBId: 'loc-1' }),
      edge({ id: 'child-pending', locationAId: '', locationBId: 'child-1' }),
    ];

    expect(withoutPendingParentEdges(pending, 'loc-1').map((item) => item.id)).toEqual([
      'child-pending',
    ]);
  });
});
