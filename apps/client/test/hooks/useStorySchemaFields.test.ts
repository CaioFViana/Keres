/** @jest-environment node */
jest.mock('../../src/db', () => ({ useDrizzle: jest.fn() }));
jest.mock('../../src/services/storymanagement/StorySchemaFieldService', () => ({
  createStorySchemaFieldService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useStorySchemaFields } from '../../src/hooks/useStorySchemaFields';
import { createStorySchemaFieldService } from '../../src/services/storymanagement/StorySchemaFieldService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const service = { getFieldsByStoryAndEntityType: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({});
  (createStorySchemaFieldService as jest.Mock).mockReturnValue(service);
  service.getFieldsByStoryAndEntityType.mockResolvedValue([{ id: 'field', key: 'rank', order: 0 }]);
});

it('loads schema fields and reloads them when their story changes', async () => {
  const { result } = await renderHook(() => useStorySchemaFields('story', 'Character'));
  await waitFor(() => expect(result.current).toEqual([{ id: 'field', key: 'rank', order: 0 }]));
  service.getFieldsByStoryAndEntityType.mockClear();
  await act(async () => entityEventEmitter.emit('story_schema_field_changed', 'story'));
  expect(service.getFieldsByStoryAndEntityType).toHaveBeenCalledWith('story', 'Character');
});

it('returns no fields when there is no selected story', async () => {
  const { result } = await renderHook(() => useStorySchemaFields(null, 'Character'));
  await waitFor(() => expect(result.current).toEqual([]));
  expect(service.getFieldsByStoryAndEntityType).not.toHaveBeenCalled();
});
