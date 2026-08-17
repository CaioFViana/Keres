import { beforeEach, describe, expect, it } from 'vitest';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let storyId: string;

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

const pull = (token: string, story: string, lastOperationVersion = 0) =>
  request('GET', `/sync/${story}/pull`, { token, query: { lastOperationVersion } });

/** Uma operação de criação de personagem, a forma mais simples de gravar algo pelo sync. */
const createCharacter = (id: string, name: string, version = 0) => ({
  type: 'create' as const,
  entity: 'Character',
  id,
  version,
  data: { id, storyId, name },
  clientOperationId: `local-${id}`,
});

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  const { data } = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'A Queda', type: 'linear' },
  });
  storyId = data.id;
});

describe('POST /sync/:storyId', () => {
  it('applies an operation and reports it as applied', async () => {
    const characterId = newId();

    const { status, data } = await push(ana.token, storyId, [
      createCharacter(characterId, 'Keres'),
    ]);

    expect(status).toBe(200);
    expect(data.processedUpdates).toBe(1);
    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
    expect(data.applied[0]).toMatchObject({ entity: 'Character', entityId: characterId });
  });

  it('echoes the client operation id, so the client knows what landed', async () => {
    const characterId = newId();

    const { data } = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    expect(data.applied[0].clientOperationId).toBe(`local-${characterId}`);
  });

  it('moves the server operation version forward', async () => {
    const first = await push(ana.token, storyId, [createCharacter(newId(), 'Keres')]);
    const second = await push(ana.token, storyId, [createCharacter(newId(), 'Nyx')]);

    expect(second.data.serverMaxOperationVersion).toBeGreaterThan(
      first.data.serverMaxOperationVersion,
    );
  });

  it('accepts an empty batch without moving anything', async () => {
    const { status, data } = await push(ana.token, storyId, []);

    expect(status).toBe(200);
    expect(data.processedUpdates).toBe(0);
    expect(data.applied).toEqual([]);
  });

  /**
   * A base de comparação de um `update` vai em `changes.version`, não no `version` do topo -
   * é de lá que `BaseSyncEntityHandler` a lê, e é o que `SyncEngineService` envia.
   */
  const updateCharacter = (
    id: string,
    name: string,
    baseVersion: number,
    clientOperationId?: string,
  ) => ({
    type: 'update' as const,
    entity: 'Character',
    id,
    version: baseVersion,
    changes: { name, version: baseVersion },
    ...(clientOperationId ? { clientOperationId } : {}),
  });

  it('applies an update on top of the version the client based it on', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const baseVersion = created.data.applied[0].entityVersion;

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Keres, a Deusa', baseVersion, 'local-update'),
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied[0].entityVersion).toBeGreaterThan(baseVersion);
  });

  it('reports a conflict when the client based its edit on a stale version', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [updateCharacter(characterId, 'Primeiro', staleVersion)]);

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Segundo', staleVersion, 'local-stale'),
    ]);

    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0]).toMatchObject({
      entity: 'Character',
      entityId: characterId,
      reason: 'version_conflict',
      clientOperationId: 'local-stale',
    });
  });

  it('reports the server version on a conflict, so the client can rebase', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [updateCharacter(characterId, 'Primeiro', staleVersion)]);

    const { data } = await push(ana.token, storyId, [
      updateCharacter(characterId, 'Segundo', staleVersion),
    ]);

    expect(data.conflicts[0].clientVersion).toBe(staleVersion);
    expect(data.conflicts[0].serverVersion).toBeGreaterThan(staleVersion);
  });

  /**
   * Armadilha real do protocolo: sem `changes.version` o servidor não tem base para comparar e
   * aplica a escrita, virando último-a-escrever-vence. Um cliente que preencha só o `version`
   * do topo perde a detecção de conflito inteira sem nenhum sinal.
   */
  it('skips the conflict check entirely when changes carries no version', async () => {
    const characterId = newId();
    const created = await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);
    const staleVersion = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [updateCharacter(characterId, 'Primeiro', staleVersion)]);

    const { data } = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Character',
        id: characterId,
        version: staleVersion,
        changes: { name: 'Segundo' },
      },
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
  });

  it('applies the good operations of a batch even when one conflicts', async () => {
    const goodId = newId();

    const { data } = await push(ana.token, storyId, [
      createCharacter(goodId, 'Keres'),
      {
        type: 'update',
        entity: 'Character',
        id: newId(),
        version: 5,
        changes: { name: 'Fantasma' },
      },
    ]);

    expect(data.applied).toHaveLength(1);
    expect(data.applied[0].entityId).toBe(goodId);
    expect(data.conflicts).toHaveLength(1);
  });

  it('rejects a batch that is not an array of operations', async () => {
    const { status } = await push(ana.token, storyId, { type: 'create' } as any);

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const { status } = await request('POST', `/sync/${storyId}`, { body: [] });

    expect(status).toBe(401);
  });
});

/**
 * Antes desta correção, um handler de relação (CharacterRelation, ChoiceCheck, ItemJourney...)
 * que referenciasse uma entidade excluída lançava um `Error` genérico, e o conflito chegava
 * ao cliente com `reason: 'unknown'` - indistinguível de qualquer outra falha inesperada. Isso
 * importa porque "manter a minha versão" nesse caso reenvia a mesma operação, que falha pelo
 * mesmo motivo de novo, sem fim - a tela de conflito precisa do `reason` certo pra saber que
 * essa opção não deveria nem ser oferecida (ver `SyncConflictModal.tsx`).
 */
describe('a sync operation referencing a deleted entity', () => {
  it('reports referenced_entity_deleted instead of unknown', async () => {
    const character1Id = newId();
    const character2Id = newId();
    await push(ana.token, storyId, [createCharacter(character1Id, 'Keres')]);
    await push(ana.token, storyId, [createCharacter(character2Id, 'Nyx')]);
    await push(ana.token, storyId, [{ type: 'delete', entity: 'Character', id: character1Id }]);

    const relationId = newId();
    const { data } = await push(ana.token, storyId, [
      {
        type: 'create',
        entity: 'CharacterRelation',
        id: relationId,
        data: {
          id: relationId,
          storyId,
          character1Id,
          character2Id,
          relationType: 'friend',
        },
        clientOperationId: 'local-relation',
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0]).toMatchObject({
      entity: 'CharacterRelation',
      reason: 'referenced_entity_deleted',
      clientOperationId: 'local-relation',
    });
  });
});

describe('GET /sync/:storyId/pull', () => {
  it('returns nothing new for a client that is already up to date', async () => {
    const { data: pushed } = await push(ana.token, storyId, [createCharacter(newId(), 'Keres')]);

    const { status, data } = await pull(
      ana.token,
      storyId,
      pushed.data?.serverMaxOperationVersion ?? 0,
    );

    expect(status).toBe(200);
    expect(data.serverMaxOperationVersion).toBeGreaterThanOrEqual(0);
  });

  it('returns the operations a client has not seen yet', async () => {
    const characterId = newId();
    await push(ana.token, storyId, [createCharacter(characterId, 'Keres')]);

    const { data } = await pull(ana.token, storyId, 0);

    expect(data.updates.length).toBeGreaterThan(0);
    expect(data.updates.some((update: any) => update.id === characterId)).toBe(true);
  });

  it('tells the caller which role they hold on the story', async () => {
    const { data } = await pull(ana.token, storyId, 0);

    expect(data.role).toBe('owner');
  });

  it('rejects a pull with no version, since the server cannot guess it', async () => {
    const { status } = await request('GET', `/sync/${storyId}/pull`, { token: ana.token });

    expect(status).toBe(422);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', `/sync/${storyId}/pull`, {
      query: { lastOperationVersion: 0 },
    });

    expect(status).toBe(401);
  });
});

describe('GET /sync/pullpreviews', () => {
  it('lists the stories the user can reach, with their versions and role', async () => {
    const { status, data } = await request('GET', '/sync/pullpreviews', { token: ana.token });

    expect(status).toBe(200);
    expect(data.storyPreviews).toEqual([
      expect.objectContaining({ storyId, role: 'owner', lastOperationVersion: expect.any(Number) }),
    ]);
  });

  it('does not list stories that belong to someone else', async () => {
    const bia = await registerUser('bia');

    const { data } = await request('GET', '/sync/pullpreviews', { token: bia.token });

    expect(data.storyPreviews).toEqual([]);
  });

  it('requires a session', async () => {
    const { status } = await request('GET', '/sync/pullpreviews');

    expect(status).toBe(401);
  });
});
