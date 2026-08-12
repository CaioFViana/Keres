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
 * Espera o efeito assíncrono do hook assentar antes de afirmar sobre o resultado.
 *
 * `renderHook` da RNTL 14 devolve uma Promise (assim como `rerender` e `unmount`) - sem o
 * `await` o retorno é a própria Promise e `result` vem `undefined`.
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
 * Este hook é a porta de edição de toda tela de história. O ponto que mais importa é ele
 * falhar fechado: uma história vinculada a servidor cujo papel ainda não resolveu não pode
 * ser editável. O padrão antigo, que tratava "desconhecido" como dono, deixava um leitor
 * editar enquanto a cópia local dele não tivesse completado um ciclo de sincronização.
 */
describe('useStoryRole', () => {
  it('treats a story that was never linked to a server as owned', async () => {
    await seedStory({ serverId: null, myRole: null });

    const { result } = await renderStoryRole();

    expect(result.current).toMatchObject({ role: 'owner', canEdit: true });
  });

  it.each([
    ['owner', true],
    ['writer', true],
    ['reader', false],
  ] as const)('reports %s on a linked story', async (myRole, canEdit) => {
    await seedStory({ serverId: 'server-1', myRole });

    const { result } = await renderStoryRole();

    expect(result.current).toMatchObject({ role: myRole, canEdit });
  });

  it('fails closed while the role of a linked story has not resolved', async () => {
    await seedStory({ serverId: 'server-1', myRole: null });

    const { result } = await renderStoryRole();

    expect(result.current).toMatchObject({ role: null, canEdit: false });
  });

  it('reports no role at all without a story', async () => {
    const { result } = await renderStoryRole(null);

    expect(result.current).toMatchObject({ role: null, canEdit: false });
  });

  /**
   * Uma história ausente cai no mesmo ramo de "nunca vinculada a servidor" e sai como dona.
   * Não é o fail-closed que importa aqui: sem história não há nada para editar, e o caso que
   * o hook precisa barrar é o da história *vinculada* com papel ainda não resolvido, logo
   * abaixo.
   */
  it('treats a story that is not here as owned, since there is nothing to protect', async () => {
    const { result } = await renderStoryRole('nao-existe');

    expect(result.current).toMatchObject({ role: 'owner' });
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

    expect(result.current).toMatchObject({ role: null, canEdit: false });
  });

  /** Um colaborador rebaixado no servidor precisa perder a edição sem reabrir a tela. */
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
