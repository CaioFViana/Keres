/**
 * @jest-environment node
 */
const mockFavoriteService = {
  getBehavior: jest.fn(async () => 'global' as string),
  setFavorite: jest.fn(async () => undefined),
  decorateEntities: jest.fn(
    async (_storyId: string, _type: string, _userId: string, entities: any[]) => entities,
  ),
};
jest.mock('../../src/services/storymanagement/FavoriteService', () => ({
  __esModule: true,
  createFavoriteService: () => mockFavoriteService,
}));

let mockUserId: string | null = 'local-user';
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: { getState: () => ({ userId: mockUserId }) },
}));

import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from '../../src/services/storymanagement/favoriteBehaviorUtils';

const db = {} as never;
const STORY_ID = 'story-1';
const ENTITY_ID = 'char-1';
const ENTITY_TYPE = 'Character' as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'local-user';
  mockFavoriteService.getBehavior.mockResolvedValue('global');
  mockFavoriteService.decorateEntities.mockImplementation(
    async (_s, _t, _u, entities: any[]) => entities,
  );
});

/**
 * A story can treat favourites as an attribute of the entity (global, everybody sees the same) or as
 * each person's own mark (individual). These helpers are what decides, on every write, whether
 * `isFavorite` goes into the entity's column or into the per-user table - getting it wrong makes one
 * person's marking show up for the others.
 */
describe('normalizeFavoriteUpdate', () => {
  it('leaves the changes alone when the update does not touch the favourite', async () => {
    const changes: { name: string; isFavorite?: boolean } = { name: 'Keres' };

    expect(
      await normalizeFavoriteUpdate(db, STORY_ID, ENTITY_ID, ENTITY_TYPE, 'local-user', changes),
    ).toBe(changes);
    expect(mockFavoriteService.setFavorite).not.toHaveBeenCalled();
  });

  it('keeps isFavorite on the entity when the story is global', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('global');

    const result = await normalizeFavoriteUpdate(
      db,
      STORY_ID,
      ENTITY_ID,
      ENTITY_TYPE,
      'local-user',
      {
        name: 'Keres',
        isFavorite: true,
      },
    );

    expect(result).toMatchObject({ name: 'Keres', isFavorite: true });
    expect(mockFavoriteService.setFavorite).not.toHaveBeenCalled();
  });

  it.each(['individual', 'individual_public'])(
    'moves it to the per-user table when the story is %s',
    async (behavior) => {
      mockFavoriteService.getBehavior.mockResolvedValue(behavior);

      const result = await normalizeFavoriteUpdate(
        db,
        STORY_ID,
        ENTITY_ID,
        ENTITY_TYPE,
        'local-user',
        {
          name: 'Keres',
          isFavorite: true,
        },
      );

      expect(mockFavoriteService.setFavorite).toHaveBeenCalledWith(
        STORY_ID,
        ENTITY_ID,
        ENTITY_TYPE,
        'local-user',
        true,
      );
      expect(result).toEqual({ name: 'Keres' });
    },
  );

  it('records unfavouriting as well', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('individual');

    await normalizeFavoriteUpdate(db, STORY_ID, ENTITY_ID, ENTITY_TYPE, 'local-user', {
      isFavorite: false,
    });

    expect(mockFavoriteService.setFavorite).toHaveBeenCalledWith(
      STORY_ID,
      ENTITY_ID,
      ENTITY_TYPE,
      'local-user',
      false,
    );
  });

  it('does not mutate the changes the caller passed in', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('individual');
    const changes = { name: 'Keres', isFavorite: true };

    await normalizeFavoriteUpdate(db, STORY_ID, ENTITY_ID, ENTITY_TYPE, 'local-user', changes);

    expect(changes.isFavorite).toBe(true);
  });
});

describe('normalizeFavoriteCreate', () => {
  it('passes the data straight through when the story is global', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('global');
    const data = { name: 'Keres', isFavorite: true };

    const result = await normalizeFavoriteCreate(db, STORY_ID, ENTITY_TYPE, data);

    expect(result).toEqual({ data, individualFavorite: undefined });
  });

  /** The entity is born without the mark; the person's favourite is saved afterwards, with the real id */
  it('strips the favourite from the entity and hands it back to the caller', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('individual');

    const result = await normalizeFavoriteCreate(db, STORY_ID, ENTITY_TYPE, {
      name: 'Keres',
      isFavorite: true,
    });

    expect(result.data).toEqual({ name: 'Keres', isFavorite: false });
    expect(result.individualFavorite).toBe(true);
  });

  it('reports a non-favourite creation as false, not undefined', async () => {
    mockFavoriteService.getBehavior.mockResolvedValue('individual');

    const data: { name: string; isFavorite?: boolean } = { name: 'Keres' };

    const result = await normalizeFavoriteCreate(db, STORY_ID, ENTITY_TYPE, data);

    expect(result.individualFavorite).toBe(false);
  });
});

describe('persistInitialFavorite', () => {
  it('writes the favourite once the entity has its real id', async () => {
    await persistInitialFavorite(db, STORY_ID, ENTITY_ID, ENTITY_TYPE, 'local-user', true);

    expect(mockFavoriteService.setFavorite).toHaveBeenCalledWith(
      STORY_ID,
      ENTITY_ID,
      ENTITY_TYPE,
      'local-user',
      true,
    );
  });

  it.each([false, undefined])('writes nothing for %s', async (individualFavorite) => {
    await persistInitialFavorite(
      db,
      STORY_ID,
      ENTITY_ID,
      ENTITY_TYPE,
      'local-user',
      individualFavorite,
    );

    expect(mockFavoriteService.setFavorite).not.toHaveBeenCalled();
  });
});

describe('decorateFavorite', () => {
  const entity = { id: ENTITY_ID, storyId: STORY_ID, isFavorite: false };

  it('replaces the flag with what this user marked', async () => {
    mockFavoriteService.decorateEntities.mockResolvedValue([{ ...entity, isFavorite: true }]);

    const result = await decorateFavorite(db, ENTITY_TYPE, entity);

    expect(result!.isFavorite).toBe(true);
    expect(mockFavoriteService.decorateEntities).toHaveBeenCalledWith(
      STORY_ID,
      ENTITY_TYPE,
      'local-user',
      [entity],
    );
  });

  it('returns nothing for an entity that is not there', async () => {
    expect(await decorateFavorite(db, ENTITY_TYPE, undefined)).toBeUndefined();
    expect(mockFavoriteService.decorateEntities).not.toHaveBeenCalled();
  });

  it('leaves the entity untouched when there is no local user yet', async () => {
    mockUserId = null;

    expect(await decorateFavorite(db, ENTITY_TYPE, entity)).toBe(entity);
    expect(mockFavoriteService.decorateEntities).not.toHaveBeenCalled();
  });
});
