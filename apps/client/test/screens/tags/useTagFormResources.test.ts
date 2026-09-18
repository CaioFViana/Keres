const mockUseDrizzle = jest.fn();
const mockCreateTagService = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/TagService', () => ({
  createTagService: (...args: unknown[]) => mockCreateTagService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useTagFormResources } from '../../../src/screens/tags/useTagFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'tag-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateTagService.mockReturnValue(fakeService);
});

it('creates the tag service once from the drizzle client', async () => {
  const view = await renderHook(() => useTagFormResources());

  expect(view.result.current.drizzleDb).toBe(fakeDb);
  expect(mockCreateTagService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.tagServiceRef.current).toBe(fakeService);

  view.rerender({});
  expect(mockCreateTagService).toHaveBeenCalledTimes(1);
});
