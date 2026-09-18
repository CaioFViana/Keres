// The hook lists `t` in its effect deps, so the mock must return a stable function like
// the real i18n does; a fresh closure per render re-triggers hydration forever.
const mockTranslate = jest.fn((key: string) => key);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useStoryFormState } from '../../../src/screens/enterstack/useStoryFormState';

const story = {
  title: 'Existing story',
  type: 'branching',
  description: 'a tale',
  genre: 'fantasy',
  language: 'en',
  author: 'author-1',
  isFavorite: true,
  favoriteBehavior: 'individual',
  extraNotes: null,
};

const renderState = async (options?: {
  initialStoryId?: string;
  fetched?: object | null;
  withService?: boolean;
  userId?: string | null;
}) => {
  const getStoryById = jest.fn().mockResolvedValue(options?.fetched ?? null);
  const storyServiceRef = {
    current: options?.withService === false ? null : ({ getStoryById } as never),
  };
  const view = await renderHook(() =>
    useStoryFormState({
      initialStoryId: options?.initialStoryId,
      storyServiceRef,
      userId: options?.userId ?? 'user-1',
    }),
  );
  return { getStoryById, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('skips hydration in create mode', async () => {
  const { getStoryById, view } = await renderState();

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(getStoryById).not.toHaveBeenCalled();
  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.error).toBeNull();
});

it('hydrates the identity draft when editing an existing story', async () => {
  const { getStoryById, view } = await renderState({
    initialStoryId: 'story-1',
    fetched: story,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(getStoryById).toHaveBeenCalledWith('story-1', 'user-1');
  expect(view.result.current.identity.title).toBe('Existing story');
  expect(view.result.current.identity.type).toBe('branching');
  expect(view.result.current.identity.genre).toBe('fantasy');
  expect(view.result.current.isEditing).toBe(true);
  expect(view.result.current.error).toBeNull();
});

it('reports a missing story instead of hydrating', async () => {
  const { view } = await renderState({ initialStoryId: 'story-gone', fetched: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.error).toBe('story_not_found');
  expect(view.result.current.identity.title).toBe('');
});

it('finishes loading when the service is not ready yet', async () => {
  const { getStoryById, view } = await renderState({
    initialStoryId: 'story-1',
    withService: false,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(getStoryById).not.toHaveBeenCalled();
  expect(view.result.current.error).toBeNull();
});
