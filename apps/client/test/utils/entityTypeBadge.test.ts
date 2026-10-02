import { getTierCountedEntityTypes, getTierRelationalEntityTypes } from '@keres/shared';
import { getEntityTypeBadge, isLinkEntityType } from '../../src/utils/entityTypeBadge';

describe('getEntityTypeBadge', () => {
  it('gives a type its own icon, and the links between types the shared link icon', () => {
    expect(getEntityTypeBadge('Character', '#123456').icon).toBe('people');
    expect(getEntityTypeBadge('TagRelation', '#123456')).toEqual({
      icon: 'link-outline',
      color: '#123456',
    });
    expect(isLinkEntityType('CharacterScene')).toBe(true);
    expect(isLinkEntityType('Character')).toBe(false);
  });

  it('leaves no counted entity type with the placeholder icon', () => {
    const unknown = getTierCountedEntityTypes().filter(
      (type) => !isLinkEntityType(type) && getEntityTypeBadge(type, '#000').icon === 'ellipse',
    );

    expect(unknown).toEqual([]);
  });

  it('leaves none of the links and values the second card lists with the placeholder icon', () => {
    const unknown = getTierRelationalEntityTypes().filter(
      (type) => !isLinkEntityType(type) && getEntityTypeBadge(type, '#000').icon === 'ellipse',
    );

    expect(unknown).toEqual([]);
  });
});
