/**
 * @jest-environment node
 */
import { fountainFromBody, planFountainImport } from '@keres/shared';
import {
  importFountain,
  titleCase,
} from '../../src/services/storymanagement/FountainImportService';
import { createCharacterSceneService } from '../../src/services/storymanagement/CharacterSceneService';
import { createCharacterService } from '../../src/services/storymanagement/CharacterService';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createLocationService } from '../../src/services/storymanagement/LocationService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const SCRIPT = [
  'Title: Kettle',
  '',
  '# Act One',
  '',
  '= Mom finds the note.',
  '',
  'INT. KITCHEN - NIGHT',
  '',
  'The kettle whistles.',
  '',
  'MOM',
  'Is anyone there?',
  '',
  'EXT. GARDEN - DAWN',
  '',
  'MOM',
  'You came back.',
  '',
  '# Act Two',
  '',
  'INT. KITCHEN - DAY',
  '',
  'Tea.',
].join('\n');

let database: TestDatabase;

const none = { places: new Set<string>(), characters: new Set<string>() };

const run = (choices = none, plan = planFountainImport(SCRIPT)) =>
  importFountain(database.db, TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    arcId: null,
    plan,
    choices,
    fallbackChapterName: 'Script',
    openingSceneName: 'Opening',
  });

const scenesOf = async () =>
  (await createSceneService(database.db).getAllByStoryId(TEST_STORY_ID)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('importFountain', () => {
  it('makes a chapter per section and a scene per heading, with the text, the synopsis and no entity nobody asked for', async () => {
    const result = await run();

    expect(result).toEqual({ chapters: 2, scenes: 3, places: 0, characters: 0 });
    const chapters = await createChapterService(database.db).getAllByStoryId(TEST_STORY_ID);
    expect(chapters.map((chapter) => [chapter.name, chapter.index])).toEqual([
      ['Act One', 1],
      ['Act Two', 2],
    ]);
    const scenes = await scenesOf();
    expect(scenes.map((scene) => scene.name)).toEqual([
      'EXT. GARDEN - DAWN',
      'INT. KITCHEN - DAY',
      'INT. KITCHEN - NIGHT',
    ]);
    const kitchen = scenes.find((scene) => scene.name === 'INT. KITCHEN - NIGHT')!;
    expect(kitchen.summary).toBe('Mom finds the note.');
    expect(fountainFromBody(kitchen.body)).toBe(
      'INT. KITCHEN - NIGHT\n\nThe kettle whistles.\n\nMOM\nIs anyone there?',
    );
    expect(kitchen.locationId).toBeNull();
    expect(await createLocationService(database.db).getAllByStoryId(TEST_STORY_ID)).toEqual([]);
    expect(await createCharacterService(database.db).getAllByStoryId(TEST_STORY_ID)).toEqual([]);
  });

  it('creates the places and characters that were ticked, links them to their scenes, and only those', async () => {
    const result = await run({
      places: new Set(['KITCHEN']),
      characters: new Set(['MOM']),
    });

    expect(result).toMatchObject({ places: 1, characters: 1 });
    const [place] = await createLocationService(database.db).getAllByStoryId(TEST_STORY_ID);
    expect(place).toMatchObject({ name: 'Kitchen', intExt: 'interior' });
    const scenes = await scenesOf();
    expect(scenes.map((scene) => [scene.name, scene.locationId === place.id])).toEqual([
      ['EXT. GARDEN - DAWN', false],
      ['INT. KITCHEN - DAY', true],
      ['INT. KITCHEN - NIGHT', true],
    ]);
    const [mom] = await createCharacterService(database.db).getAllByStoryId(TEST_STORY_ID);
    expect(mom.name).toBe('Mom');
    const cast = await createCharacterSceneService(database.db).getRelationsByStoryId(
      TEST_STORY_ID,
    );
    expect(cast).toHaveLength(2);
    expect(cast.every((relation) => relation.characterId === mom.id)).toBe(true);
  });

  it('links a place and a character that already exist by name, without being asked and without duplicating them', async () => {
    const existingPlace = await createLocationService(database.db).createLocation(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'Garden',
    } as never);
    const existingMom = await createCharacterService(database.db).createCharacter(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      name: 'mom',
    } as never);

    await run({ places: new Set(['GARDEN']), characters: new Set(['MOM']) });

    expect(await createLocationService(database.db).getAllByStoryId(TEST_STORY_ID)).toHaveLength(1);
    expect(await createCharacterService(database.db).getAllByStoryId(TEST_STORY_ID)).toHaveLength(
      1,
    );
    const garden = (await scenesOf()).find((scene) => scene.name === 'EXT. GARDEN - DAWN')!;
    expect(garden.locationId).toBe(existingPlace.id);
    const cast = await createCharacterSceneService(database.db).getRelationsByStoryId(
      TEST_STORY_ID,
    );
    expect(cast.every((relation) => relation.characterId === existingMom.id)).toBe(true);
  });

  it('files the scenes of a script with no sections under a chapter of its own, and names the opening', async () => {
    const result = await run(
      none,
      planFountainImport('A black screen.\n\nINT. ROOM - DAY\n\nLight.'),
    );

    expect(result).toMatchObject({ chapters: 1, scenes: 2 });
    const [chapter] = await createChapterService(database.db).getAllByStoryId(TEST_STORY_ID);
    expect(chapter.name).toBe('Script');
    expect((await scenesOf()).map((scene) => scene.name)).toEqual(['INT. ROOM - DAY', 'Opening']);
  });

  it('puts the chapters after the ones the story already has', async () => {
    await run();
    await run();

    const chapters = await createChapterService(database.db).getAllByStoryId(TEST_STORY_ID);
    expect(chapters.map((chapter) => chapter.index)).toEqual([1, 2, 3, 4]);
  });

  it('does nothing for an empty file', async () => {
    expect(await run(none, planFountainImport(''))).toEqual({
      chapters: 0,
      scenes: 0,
      places: 0,
      characters: 0,
    });
  });
});

describe('titleCase', () => {
  it.each([
    ['KITCHEN', 'Kitchen'],
    ['THE OLD MILL', 'The Old Mill'],
    ["DINER - MOM'S", "Diner - Mom's"],
    ['MARIA-JOSÉ', 'Maria-José'],
  ])('%s', (name, expected) => {
    expect(titleCase(name)).toBe(expected);
  });
});
