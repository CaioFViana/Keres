const mockUseDrizzle = jest.fn();
const mockCreateStorySchemaFieldService = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/StorySchemaFieldService', () => ({
  createStorySchemaFieldService: (...args: unknown[]) => mockCreateStorySchemaFieldService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useStorySchemaFieldFormResources } from '../../../src/screens/storyschema/useStorySchemaFieldFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'story-schema-field-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateStorySchemaFieldService.mockReturnValue(fakeService);
});

it('creates the story-schema field service once from the drizzle client', async () => {
  const view = await renderHook(() => useStorySchemaFieldFormResources());

  expect(view.result.current.drizzleDb).toBe(fakeDb);
  expect(mockCreateStorySchemaFieldService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.storySchemaFieldServiceRef.current).toBe(fakeService);

  view.rerender({});
  expect(mockCreateStorySchemaFieldService).toHaveBeenCalledTimes(1);
});
