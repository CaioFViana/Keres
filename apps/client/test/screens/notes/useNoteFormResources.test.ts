const mockUseDrizzle = jest.fn();
const mockCreateNoteService = jest.fn();

jest.mock('../../../src/db', () => ({
  useDrizzle: (...args: unknown[]) => mockUseDrizzle(...args),
}));
jest.mock('../../../src/services/storymanagement/NoteService', () => ({
  createNoteService: (...args: unknown[]) => mockCreateNoteService(...args),
}));

import { renderHook } from '@testing-library/react-native';
import { useNoteFormResources } from '../../../src/screens/notes/useNoteFormResources';

const fakeDb = { marker: 'db' };
const fakeService = { marker: 'note-service' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDrizzle.mockReturnValue(fakeDb);
  mockCreateNoteService.mockReturnValue(fakeService);
});

it('creates the note service once from the drizzle client', async () => {
  const view = await renderHook(() => useNoteFormResources());

  expect(view.result.current.drizzleDb).toBe(fakeDb);
  expect(mockCreateNoteService).toHaveBeenCalledWith(fakeDb);
  expect(view.result.current.noteServiceRef.current).toBe(fakeService);

  view.rerender({});
  expect(mockCreateNoteService).toHaveBeenCalledTimes(1);
});
