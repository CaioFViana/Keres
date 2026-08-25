/**
 * @jest-environment node
 */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import * as schema from '../../src/db/schema';
import { useStoryRole } from '../../src/hooks/useStoryRole';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;

async function seedStory(overrides: Partial<typeof schema.stories.$inferInsert> = {}) {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
    ...overrides,
  });
}

/**
 * Waits for the hook's async effect to settle before asserting anything about the result.
 *
 * RNTL 14's `renderHook` returns a Promise (as do `rerender` and `unmount`) - without the `await` the
 * return value is the Promise itself and `result` comes back `undefined`.
 */
async function renderStoryRole(storyId: string | null = STORY_ID) {
  const view = await renderHook(() => useStoryRole(storyId));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

beforeEach(async () => {
  database = await createTestDatabase();
  (useDrizzle as jest.Mock).mockReturnValue(database.db);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

/**
 * This hook is the editing gate of every story screen. What matters most is that it fails closed: a
 * server-linked story whose role has not resolved yet must not be editable. The old default, which
 * treated "unknown" as owner, let a reader edit while their local copy had not completed a
 * synchronization cycle.
 */
describe('useStoryRole', () => {
  it('treats a story that was never linked to a server as owned', async () => {
    await seedStory({ serverId: null, myRole: null });

    const { result } = await renderStoryRole();

    expect(result.current).toMatchObject({
      role: 'owner',
      canEdit: true,
      canManageStoryPolicy: true,
    });
  });

  it.each([
    ['owner', true, true],
    ['writer', true, false],
    ['reader', false, false],
  ] as const)('reports %s on a linked story', async (myRole, canEdit, canManageStoryPolicy) => {
    await seedStory({ serverId: 'server-1', myRole });

    const { result } = await renderStoryRole();

    expect(result.current).toMatchObject({ role: myRole, canEdit, canManageStoryPolicy });
  });

  it('fails closed while the role of a linked story has not resolved', async () => {
    await seedStory({ serverId: 'server-1', myRole: null });

    const { result } = await renderStoryRole();

    expect(result.current).toMatchObject({
      role: null,
      canEdit: false,
      canManageStoryPolicy: false,
    });
  });

  it('reports no role at all without a story', async () => {
    const { result } = await renderStoryRole(null);

    expect(result.current).toMatchObject({
      role: null,
      canEdit: false,
      canManageStoryPolicy: false,
    });
  });

  /**
   * A missing story falls into the same "never linked to a server" branch and comes out as owner. It is
   * not the fail-closed part that matters here: with no story there is nothing to edit, and the case the
   * hook has to block is the *linked* story whose role has not resolved yet, just below.
   */
  it('treats a story that is not here as owned, since there is nothing to protect', async () => {
    const { result } = await renderStoryRole('nao-existe');

    expect(result.current).toMatchObject({ role: 'owner', canManageStoryPolicy: true });
  });

  it('starts out loading, so no screen renders an editable state too early', async () => {
    await seedStory({ serverId: 'server-1', myRole: 'reader' });

    const { result } = await renderHook(() => useStoryRole(STORY_ID));

    expect(result.current.canEdit).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('fails closed when the query blows up', async () => {
    (useDrizzle as jest.Mock).mockReturnValue({
      query: { stories: { findFirst: jest.fn().mockRejectedValue(new Error('banco fora')) } },
    });

    const { result } = await renderStoryRole();

    expect(result.current).toMatchObject({
      role: null,
      canEdit: false,
      canManageStoryPolicy: false,
    });
  });

  /** A collaborator demoted on the server has to lose editing without reopening the screen. */
  it('picks up a role change announced by the sync engine', async () => {
    await seedStory({ serverId: 'server-1', myRole: 'writer' });
    const { result } = await renderStoryRole();
    expect(result.current.canEdit).toBe(true);

    await database.db.update(schema.stories).set({ myRole: 'reader' });
    entityEventEmitter.emit('story_role_changed', STORY_ID);

    await waitFor(() => expect(result.current.canEdit).toBe(false));
    expect(result.current.role).toBe('reader');
  });

  it('stops listening once the screen goes away', async () => {
    await seedStory({ serverId: 'server-1', myRole: 'writer' });
    const { unmount } = await renderStoryRole();

    await unmount();

    expect(() => entityEventEmitter.emit('story_role_changed', STORY_ID)).not.toThrow();
  });
});
