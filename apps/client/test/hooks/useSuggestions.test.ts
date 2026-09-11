const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/SuggestionService', () => ({
  __esModule: true,
  createSuggestionService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSuggestions } from '../../src/hooks/useSuggestions';
import { createSuggestionService } from '../../src/services/storymanagement/SuggestionService';

const getSuggestions = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getSuggestions.mockResolvedValue([
    ['Mage', 4],
    ['Scholar', 1],
  ]);
  (createSuggestionService as jest.Mock).mockReturnValue({ getSuggestions });
});

describe('useSuggestions', () => {
  it('loads the stored and in-story suggestion catalog on demand', async () => {
    const view = await renderHook(() => useSuggestions('story', 'character_role'));
    await act(async () => view.result.current.reload());

    expect(getSuggestions).toHaveBeenCalledWith('character_role', 'story');
    expect(view.result.current).toMatchObject({
      suggestions: [
        ['Mage', 4],
        ['Scholar', 1],
      ],
      loading: false,
    });
  });

  it('clears missing inputs and failed requests instead of showing stale options', async () => {
    const view = await renderHook(() => useSuggestions(undefined, 'character_role'));
    await act(async () => view.result.current.reload());
    expect(getSuggestions).not.toHaveBeenCalled();
    expect(view.result.current.suggestions).toEqual([]);

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getSuggestions.mockRejectedValueOnce(new Error('offline'));
    const failingView = await renderHook(() => useSuggestions('story', 'character_role'));
    await act(async () => failingView.result.current.reload());
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Failed to fetch suggestions:', expect.any(Error)),
    );
    expect(failingView.result.current).toMatchObject({ suggestions: [], loading: false });
  });
});
