/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createStoryCalendarService } from '../../src/services/storymanagement/StoryCalendarService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The story's calendars, and above all **which one is primary**.
 *
 * That flag carries no database constraint - "exactly one true per story" is not expressible as a
 * partial unique index without also forbidding zero. So the invariant lives in the service, and
 * these are the cases that keep it: promoting demotes, deleting the primary promotes a survivor,
 * and a story that has ended up with two (which synchronization can produce) still reads one
 * deterministically rather than refusing.
 */

let database: TestDatabase;

const service = () => createStoryCalendarService(database.db);

const definition = (overrides = {}) => ({
  secondsPerMinute: 60,
  minutesPerHour: 60,
  hoursPerDay: 24,
  daysPerWeek: 7,
  weekdayNames: [],
  unitNames: {},
  months: [
    { name: 'One', days: 30 },
    { name: 'Two', days: 30 },
  ],
  eras: [],
  moons: [],
  seasons: [],
  ...overrides,
});

const make = (name: string, overrides = {}) =>
  service().createCalendar(TEST_USER_ID, {
    storyId: TEST_STORY_ID,
    name,
    description: null,
    definition: definition(),
    extraNotes: null,
    ...overrides,
  });

const operations = async () =>
  database.db
    .select()
    .from(schema.operationLogs)
    .where(eq(schema.operationLogs.storyId, TEST_STORY_ID))
    .all();

const payloadOf = (operation: { payload: unknown }) =>
  typeof operation.payload === 'string' ? JSON.parse(operation.payload) : operation.payload;

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

describe('creating a calendar', () => {
  it('stores the definition as an object, not as a string', async () => {
    const created = await make('Reckoning');

    // The column is `mode: 'json'` precisely so this holds: a definition round-tripping as text
    // would reach the server double-encoded inside the operation payload.
    expect(created.definition.months).toHaveLength(2);
    expect(created.definition.daysPerWeek).toBe(7);
  });

  it('logs a create for the StoryCalendar entity', async () => {
    const created = await make('Reckoning');
    const [operation] = await operations();

    expect(operation).toMatchObject({
      entityType: 'StoryCalendar',
      operationType: 'create',
      entityId: created.id,
    });
    expect(payloadOf(operation).name).toBe('Reckoning');
  });

  it('makes the first calendar primary whatever the caller asked for', async () => {
    // A story with calendars and no primary renders no dates at all, which reads as the feature
    // being broken rather than as a setting being unset.
    const first = await make('Reckoning', { isPrimary: false });

    expect(first.isPrimary).toBe(true);
    expect((await service().getPrimary(TEST_STORY_ID))?.id).toBe(first.id);
  });

  it('leaves a second calendar secondary unless asked otherwise', async () => {
    const first = await make('First');
    const second = await make('Second');

    expect(second.isPrimary).toBe(false);
    expect((await service().getPrimary(TEST_STORY_ID))?.id).toBe(first.id);
  });

  it('demotes the incumbent when a new calendar is created as primary', async () => {
    const first = await make('First');
    const second = await make('Second', { isPrimary: true });

    expect((await service().getPrimary(TEST_STORY_ID))?.id).toBe(second.id);
    const refreshed = await service().getById(first.id);
    expect(refreshed?.isPrimary).toBe(false);
  });
});

describe('the primary calendar', () => {
  it('promotes one and demotes the rest', async () => {
    const first = await make('First');
    const second = await make('Second');

    await service().setPrimary(TEST_USER_ID, second.id);

    expect((await service().getById(first.id))?.isPrimary).toBe(false);
    expect((await service().getById(second.id))?.isPrimary).toBe(true);
  });

  it('logs the demotion as well as the promotion', async () => {
    const first = await make('First');
    const second = await make('Second');
    const before = (await operations()).length;

    await service().setPrimary(TEST_USER_ID, second.id);

    /*
     * Two rows changed, so two operations. A single "promote" would leave the other device to infer
     * the demotion, and an inference the log does not state is one it can get wrong.
     */
    const written = (await operations()).slice(before);
    expect(written).toHaveLength(2);
    expect(written.map((operation) => payloadOf(operation).isPrimary).sort()).toEqual([
      false,
      true,
    ]);
    expect(new Set(written.map((operation) => operation.entityId))).toEqual(
      new Set([first.id, second.id]),
    );
  });

  it('writes nothing when the calendar is already the primary', async () => {
    const first = await make('First');
    const before = (await operations()).length;

    await service().setPrimary(TEST_USER_ID, first.id);

    expect((await operations()).length).toBe(before);
  });

  it('picks deterministically when synchronization has left two primaries', async () => {
    const first = await make('First');
    const second = await make('Second');
    // What two devices promoting different calendars produces: neither side can detect it.
    await database.db
      .update(schema.storyCalendars)
      .set({ isPrimary: true })
      .where(eq(schema.storyCalendars.id, second.id));

    // The older one wins, and it wins the same way on every device - which is the only property
    // that matters here, since there is no correct answer to choose.
    expect((await service().getPrimary(TEST_STORY_ID))?.id).toBe(first.id);
    expect((await service().getPrimary(TEST_STORY_ID))?.id).toBe(first.id);
  });

  it('hands the timing helpers a definition, or null for a story with no calendar', async () => {
    expect(await service().getPrimaryDefinition(TEST_STORY_ID)).toBeNull();

    await make('Reckoning', { definition: definition({ daysPerWeek: 6 }) });

    expect((await service().getPrimaryDefinition(TEST_STORY_ID))?.daysPerWeek).toBe(6);
  });
});

describe('updating a calendar', () => {
  it('bumps the version and logs what changed', async () => {
    const calendar = await make('Reckoning');

    const updated = await service().updateCalendar(TEST_USER_ID, calendar.id, {
      name: 'Renamed',
    });

    expect(updated).toMatchObject({ name: 'Renamed', version: 2 });
    const all = await operations();
    expect(payloadOf(all[all.length - 1]).name).toBe('Renamed');
  });

  it('writes nothing when nothing changed', async () => {
    const calendar = await make('Reckoning');
    const before = (await operations()).length;

    const unchanged = await service().updateCalendar(TEST_USER_ID, calendar.id, {
      name: 'Reckoning',
    });

    expect(unchanged.version).toBe(1);
    expect((await operations()).length).toBe(before);
  });

  it('refuses a calendar that is not there', async () => {
    await expect(service().updateCalendar(TEST_USER_ID, 'missing', {})).rejects.toThrow(
      'not found',
    );
  });
});

describe('deleting a calendar', () => {
  it('marks it deleted and leaves it out of the list', async () => {
    const calendar = await make('Reckoning');

    await service().deleteCalendar(TEST_USER_ID, calendar.id);

    expect(await service().getCalendarsForStory(TEST_STORY_ID)).toEqual([]);
    expect((await service().getById(calendar.id))?.isDeleted).toBe(true);
  });

  it('promotes a survivor when the primary is deleted', async () => {
    const first = await make('First');
    const second = await make('Second');

    await service().deleteCalendar(TEST_USER_ID, first.id);

    // Otherwise the story would still have a calendar and silently stop showing dates, with no way
    // for the writer to tell that the deletion is what did it.
    expect((await service().getPrimary(TEST_STORY_ID))?.id).toBe(second.id);
  });

  it('leaves the primary alone when a secondary is deleted', async () => {
    const first = await make('First');
    const second = await make('Second');

    await service().deleteCalendar(TEST_USER_ID, second.id);

    expect((await service().getPrimary(TEST_STORY_ID))?.id).toBe(first.id);
  });

  it('does nothing, and logs nothing, for a calendar that is not there', async () => {
    const before = (await operations()).length;

    await service().deleteCalendar(TEST_USER_ID, 'missing');

    expect((await operations()).length).toBe(before);
  });
});
