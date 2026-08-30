/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createPlotSceneService } from '../../src/services/storymanagement/PlotSceneService';
import { createPlotService } from '../../src/services/storymanagement/PlotService';
import { entityBase, seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

const seedScene = async (id: string, index: number) => {
  await database.db.insert(schema.chapters).values({
    id: `chapter-${id}`,
    storyId: TEST_STORY_ID,
    name: `Capítulo ${index}`,
    index: 0,
    ...entityBase,
    deletedAt: null,
  });
  await database.db.insert(schema.scenes).values({
    id,
    storyId: TEST_STORY_ID,
    chapterId: `chapter-${id}`,
    locationId: 'location-1',
    name: `Cena ${index}`,
    index,
    isStart: false,
    isFinish: false,
    ...entityBase,
    deletedAt: null,
  });
};

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  await database.db.insert(schema.locations).values({
    id: 'location-1',
    storyId: TEST_STORY_ID,
    name: 'O porto',
    ...entityBase,
    deletedAt: null,
  });
  await seedScene('scene-1', 0);
  await seedScene('scene-2', 1);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

const createPlot = (name = 'Trama principal') =>
  createPlotService(database.db).save(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    name,
    details: null,
  });

describe('PlotService', () => {
  it('creates, edits and soft-deletes a plot', async () => {
    const service = createPlotService(database.db);

    const created = await createPlot();
    expect(created).toMatchObject({ name: 'Trama principal', version: 1, isDeleted: false });

    const updated = await service.save(TEST_USER_ID, {
      id: created.id,
      storyId: TEST_STORY_ID,
      name: 'Redenção',
      details: 'A linha do capitão.',
    });
    expect(updated).toMatchObject({ name: 'Redenção', details: 'A linha do capitão.', version: 2 });

    await service.delete(TEST_USER_ID, created.id);
    expect(await service.getById(created.id)).toBeUndefined();
    expect(await service.getAllByStoryId(TEST_STORY_ID)).toHaveLength(0);
  });

  it('allows a plot in a branching story', async () => {
    await database.db
      .update(schema.stories)
      .set({ type: 'branching' })
      .where(eq(schema.stories.id, TEST_STORY_ID))
      .run();

    await expect(createPlot()).resolves.toMatchObject({ name: 'Trama principal' });
  });
});

describe('PlotSceneService', () => {
  it('creates a relation with a client-generated id, then updates that same row', async () => {
    const service = createPlotSceneService(database.db);
    const plot = await createPlot();

    const created = await service.save(TEST_USER_ID, {
      id: 'relation-1',
      storyId: TEST_STORY_ID,
      plotId: plot.id,
      sceneId: 'scene-1',
      note: '  Coloca a trama em movimento.  ',
    });
    expect(created).toMatchObject({
      id: 'relation-1',
      note: 'Coloca a trama em movimento.',
      version: 1,
    });

    const updated = await service.save(TEST_USER_ID, {
      id: 'relation-1',
      storyId: TEST_STORY_ID,
      plotId: plot.id,
      sceneId: 'scene-2',
      note: 'Leva a trama ao ponto de virada.',
    });
    expect(updated).toMatchObject({ id: 'relation-1', sceneId: 'scene-2', version: 2 });
    expect(await service.getAllByStoryId(TEST_STORY_ID)).toHaveLength(1);
  });

  it('rejects a duplicate pair, an empty note, a multi-line note and an over-long note', async () => {
    const service = createPlotSceneService(database.db);
    const plot = await createPlot();
    const relation = {
      storyId: TEST_STORY_ID,
      plotId: plot.id,
      sceneId: 'scene-1',
      note: 'Abre a trama.',
    };

    await service.save(TEST_USER_ID, { ...relation, id: 'relation-1' });

    await expect(service.save(TEST_USER_ID, { ...relation, id: 'relation-2' })).rejects.toThrow(
      /already part/i,
    );
    await expect(
      service.save(TEST_USER_ID, { ...relation, id: 'relation-3', sceneId: 'scene-2', note: '  ' }),
    ).rejects.toThrow(/empty/i);
    await expect(
      service.save(TEST_USER_ID, {
        ...relation,
        id: 'relation-4',
        sceneId: 'scene-2',
        note: 'Duas\nlinhas.',
      }),
    ).rejects.toThrow(/single line/i);
    await expect(
      service.save(TEST_USER_ID, {
        ...relation,
        id: 'relation-5',
        sceneId: 'scene-2',
        note: 'a'.repeat(161),
      }),
    ).rejects.toThrow(/161|characters/i);
  });

  it('rejects a scene that belongs to another story', async () => {
    const service = createPlotSceneService(database.db);
    const plot = await createPlot();

    await expect(
      service.save(TEST_USER_ID, {
        id: 'relation-1',
        storyId: TEST_STORY_ID,
        plotId: plot.id,
        sceneId: 'scene-from-elsewhere',
        note: 'Não deveria entrar.',
      }),
    ).rejects.toThrow(/belong to the active story/i);
  });

  it('drops the relation without touching the scene when it is deleted', async () => {
    const service = createPlotSceneService(database.db);
    const plot = await createPlot();
    await service.save(TEST_USER_ID, {
      id: 'relation-1',
      storyId: TEST_STORY_ID,
      plotId: plot.id,
      sceneId: 'scene-1',
      note: 'Abre a trama.',
    });

    await service.delete(TEST_USER_ID, 'relation-1');

    expect(await service.getByPlotId(TEST_STORY_ID, plot.id)).toHaveLength(0);
    expect(await database.db.select().from(schema.scenes).all()).toHaveLength(2);
  });
});
