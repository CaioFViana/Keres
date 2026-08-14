/** @jest-environment node */
jest.mock('../../src/db', () => ({ useDrizzle: jest.fn() }));
jest.mock('../../src/utils/entityOptions', () => ({ loadEntityOptions: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useEntityPickerOptions } from '../../src/hooks/useEntityPickerOptions';
import { loadEntityOptions } from '../../src/utils/entityOptions';

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({});
  (loadEntityOptions as jest.Mock).mockResolvedValue([{ label: 'Mira', value: 'mira' }]);
});

it('loads options for the schema target and exposes manual reload', async () => {
  const { result } = await renderHook(() => useEntityPickerOptions('story', 'Character'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.options).toEqual([{ label: 'Mira', value: 'mira' }]);
  await act(async () => result.current.reload());
  expect(loadEntityOptions).toHaveBeenCalledTimes(2);
});

it('clears options without querying when the schema target is missing', async () => {
  const { result } = await renderHook(() => useEntityPickerOptions('story', null));
  await waitFor(() => expect(result.current.options).toEqual([]));
  expect(loadEntityOptions).not.toHaveBeenCalled();
});
