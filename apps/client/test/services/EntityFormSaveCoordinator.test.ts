import { saveEntityWithSecondaryData } from '../../src/services/storymanagement/EntityFormSaveCoordinator';

describe('saveEntityWithSecondaryData', () => {
  it('retains the created id before dependent writes and completes in order', async () => {
    const completed: string[] = [];

    const result = await saveEntityWithSecondaryData({
      createEntity: async () => {
        completed.push('entity');
        return { id: 'entity-1' };
      },
      updateEntity: jest.fn(),
      onEntityPersisted: (entityId) => completed.push(`retained:${entityId}`),
      persistSecondaryData: async (entityId) => {
        completed.push(`secondary:${entityId}`);
      },
    });

    expect(result).toEqual({ entityId: 'entity-1', created: true });
    expect(completed).toEqual(['entity', 'retained:entity-1', 'secondary:entity-1']);
  });

  it('retries a failed creation as an update without creating a duplicate', async () => {
    const createEntity = jest.fn(async () => ({ id: 'entity-1' }));
    const updateEntity = jest.fn(async () => undefined);
    let retainedEntityId: string | undefined;
    let attempt = 0;
    const save = () =>
      saveEntityWithSecondaryData({
        currentEntityId: retainedEntityId,
        createEntity,
        updateEntity,
        onEntityPersisted: (entityId) => {
          retainedEntityId = entityId;
        },
        persistSecondaryData: async () => {
          if (attempt === 0) throw new Error('secondary write failed');
        },
      });

    await expect(save()).rejects.toThrow('secondary write failed');
    attempt += 1;
    await expect(save()).resolves.toEqual({ entityId: 'entity-1', created: false });

    expect(createEntity).toHaveBeenCalledTimes(1);
    expect(updateEntity).toHaveBeenCalledTimes(1);
    expect(updateEntity).toHaveBeenCalledWith('entity-1');
  });
});
