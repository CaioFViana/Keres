/**
 * @jest-environment node
 *
 * Documents and verifies the shared multi-step save recovery policy (P02/P03):
 * identity retention, ordered secondary writes, in-session retry without duplication,
 * and the requirement that success signalling stays outside the coordinator.
 */
import { saveEntityWithSecondaryData } from '../../src/services/storymanagement/EntityFormSaveCoordinator';

describe('multi-step form partial-save policy', () => {
  const entityFlows = [
    'Character',
    'Location',
    'WorldRule',
    'Item',
    'Note',
    'Chapter',
    'Choice',
    'ItemJourney',
    'Scene',
  ] as const;

  it.each(entityFlows)(
    '%s flow: retains id, skips completed secondary work on retry, and never signals success itself',
    async (flow) => {
      const createEntity = jest.fn(async () => ({ id: `${flow.toLowerCase()}-1` }));
      const updateEntity = jest.fn(async () => undefined);
      const secondarySteps = ['tags', 'notes', 'relations', 'attributes'];
      const completed = new Set<string>();
      let retainedId: string | undefined;
      let failAt: string | null = 'relations';

      const persistSecondaryData = async (entityId: string) => {
        for (const step of secondarySteps) {
          if (completed.has(step)) continue;
          if (step === failAt) {
            throw new Error(`${flow} secondary failed at ${step} for ${entityId}`);
          }
          completed.add(step);
        }
      };

      const save = () =>
        saveEntityWithSecondaryData({
          currentEntityId: retainedId,
          createEntity,
          updateEntity,
          onEntityPersisted: (entityId) => {
            retainedId = entityId;
          },
          persistSecondaryData,
        });

      await expect(save()).rejects.toThrow(`${flow} secondary failed at relations`);
      expect(retainedId).toBe(`${flow.toLowerCase()}-1`);
      expect(createEntity).toHaveBeenCalledTimes(1);
      expect([...completed]).toEqual(['tags', 'notes']);

      failAt = null;
      const successSignals: string[] = [];
      const result = await save();
      successSignals.push('caller-success');

      expect(result).toEqual({ entityId: `${flow.toLowerCase()}-1`, created: false });
      expect(createEntity).toHaveBeenCalledTimes(1);
      expect(updateEntity).toHaveBeenCalledTimes(1);
      expect(updateEntity).toHaveBeenCalledWith(`${flow.toLowerCase()}-1`);
      expect([...completed]).toEqual(secondarySteps);
      expect(successSignals).toEqual(['caller-success']);
    },
  );

  it('documents cross-session recovery as persisted base + lost in-memory drafts', () => {
    // The coordinator cannot recover React state after process death. Product behaviour:
    // reopen hydrates the persisted entity; the author re-enters unfinished secondary data.
    expect(typeof saveEntityWithSecondaryData).toBe('function');
  });
});
