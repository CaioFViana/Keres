const mockDb = {};
const mockT = (key: string) => key;
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/services/storymanagement/AttributeValueService', () => ({
  __esModule: true,
  createAttributeValueService: jest.fn(),
}));
jest.mock('../../src/services/EntityService', () => ({
  __esModule: true,
  EntityService: { getEntityIdentifier: jest.fn() },
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useEntityInitialLoad: (load: () => Promise<void>) =>
      React.useEffect(() => {
        void load();
      }, [load]),
  };
});

import { AttributeType } from '@keres/shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useCustomAttributeValues } from '../../src/hooks/useCustomAttributeValues';
import { EntityService } from '../../src/services/EntityService';
import { createAttributeValueService } from '../../src/services/storymanagement/AttributeValueService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const getValuesForEntity = jest.fn();
const fields = [
  { id: 'text', type: AttributeType.TEXT },
  { id: 'relation', type: AttributeType.ENTITY, targetEntityType: 'Character' },
] as never;

beforeEach(() => {
  jest.clearAllMocks();
  getValuesForEntity.mockResolvedValue([
    { fieldId: 'text', value: 'A note' },
    { fieldId: 'relation', value: 'character-1' },
  ]);
  (createAttributeValueService as jest.Mock).mockReturnValue({ getValuesForEntity });
  (EntityService.getEntityIdentifier as jest.Mock).mockResolvedValue('Mira');
});

describe('useCustomAttributeValues', () => {
  it('loads raw values and resolves only populated entity attributes', async () => {
    const view = await renderHook(() => useCustomAttributeValues('story', 'entity', fields));
    await waitFor(() =>
      expect(view.result.current.values).toEqual({ text: 'A note', relation: 'character-1' }),
    );
    expect(EntityService.getEntityIdentifier).toHaveBeenCalledWith(
      mockDb,
      'Character',
      'character-1',
      'story',
      expect.any(Function),
    );
    expect(view.result.current.resolvedEntityNames).toEqual({ relation: 'Mira' });
  });

  it('reloads after an attribute change and fails closed on read errors', async () => {
    const view = await renderHook(() => useCustomAttributeValues('story', 'entity', fields));
    await waitFor(() => expect(getValuesForEntity).toHaveBeenCalledTimes(1));
    await act(async () => entityEventEmitter.emit('attribute_value_changed', 'story'));
    await waitFor(() => expect(getValuesForEntity).toHaveBeenCalledTimes(2));

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getValuesForEntity.mockRejectedValueOnce(new Error('offline'));
    await act(async () => entityEventEmitter.emit('attribute_value_changed', 'story'));
    await waitFor(() => expect(view.result.current.values).toEqual({}));
    expect(view.result.current.resolvedEntityNames).toEqual({});
  });
});
