const mockShowNotification = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector: (state: unknown) => unknown) =>
    selector({ showNotification: (...args: unknown[]) => mockShowNotification(...args) }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySelect } from '../../../src/db/schema';
import { usePackFormState } from '../../../src/screens/packs/usePackFormState';
import type { PackService } from '../../../src/services/storymanagement/PackService';

const createPackServiceRef = () => ({
  current: {
    listPacks: jest.fn(),
  } as unknown as PackService,
});

const stories = [
  { id: 'story-1', title: 'First tale', language: 'en', author: 'Ada' },
] as StorySelect[];

const renderState = async (options: {
  initialPackId?: string;
  packs?: object[];
  stories?: StorySelect[];
  serviceRef?: { current: PackService | null };
}) => {
  const packServiceRef = options.serviceRef ?? createPackServiceRef();
  if (options.packs !== undefined && packServiceRef.current) {
    (packServiceRef.current.listPacks as jest.Mock).mockResolvedValue(options.packs);
  }
  const view = await renderHook(() =>
    usePackFormState({
      initialPackId: options.initialPackId,
      packServiceRef,
      stories: options.stories ?? stories,
    }),
  );
  return { packServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('starts a creation form with every selection off', async () => {
  const { view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
  expect(view.result.current.nothingSelected).toBe(true);
  expect(view.result.current.selection).toEqual({
    customAttributes: false,
    suggestions: false,
    suggestionsIncludeUsed: false,
    stats: false,
    tags: false,
    extras: false,
  });
});

it('hydrates the pack being re-extracted', async () => {
  const { packServiceRef, view } = await renderState({
    initialPackId: 'pack-1',
    packs: [
      {
        id: 'pack-1',
        name: 'Starter',
        description: 'Desc',
        language: 'pt',
        authorName: 'Bea',
        sourceStoryId: 'story-1',
      },
    ],
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(packServiceRef.current!.listPacks).toHaveBeenCalled();
  expect(view.result.current.isEditing).toBe(true);
  expect(view.result.current.name).toBe('Starter');
  expect(view.result.current.description).toBe('Desc');
  expect(view.result.current.language).toBe('pt');
  expect(view.result.current.authorName).toBe('Bea');
  expect(view.result.current.sourceStoryId).toBe('story-1');
});

it('finishes loading when the pack is gone or the service is missing', async () => {
  const gone = await renderState({ initialPackId: 'missing', packs: [] });
  await waitFor(() => expect(gone.view.result.current.loading).toBe(false));
  expect(gone.view.result.current.name).toBe('');

  const noService = await renderState({
    initialPackId: 'pack-1',
    serviceRef: { current: null },
  });
  await waitFor(() => expect(noService.view.result.current.loading).toBe(false));
});

it('notifies and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const packServiceRef = createPackServiceRef();
  (packServiceRef.current.listPacks as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    usePackFormState({ initialPackId: 'pack-1', packServiceRef, stories }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('PackFormScreen: failed to load.', expect.any(Error));
  expect(mockShowNotification).toHaveBeenCalledWith('packs_load_failed', 'error');
  error.mockRestore();
});

it('prefills language, author and name from the story chosen while creating', async () => {
  const { view } = await renderState({});
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  await act(async () => {
    view.result.current.chooseStory('story-1');
  });

  expect(view.result.current.sourceStoryId).toBe('story-1');
  expect(view.result.current.language).toBe('en');
  expect(view.result.current.authorName).toBe('Ada');
  expect(view.result.current.name).toBe('First tale');
});

it('never overwrites an edited name or an editing form with story prefill', async () => {
  const { view } = await renderState({});
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  // Separate commits: chooseStory reads the name from its render closure, so the edit
  // must land before the story is chosen for the keep-my-edit branch to apply.
  await act(async () => {
    view.result.current.setName('Mine');
  });
  await act(async () => {
    view.result.current.chooseStory('story-1');
  });
  expect(view.result.current.name).toBe('Mine');
  expect(view.result.current.language).toBe('en');

  const editing = await renderState({ initialPackId: 'pack-1', packs: [] });
  await waitFor(() => expect(editing.view.result.current.loading).toBe(false));
  await act(async () => {
    editing.view.result.current.chooseStory('story-1');
  });
  expect(editing.view.result.current.sourceStoryId).toBe('story-1');
  expect(editing.view.result.current.language).toBe('');
});

it('ignores a story choice that matches nothing', async () => {
  const { view } = await renderState({});
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  await act(async () => {
    view.result.current.chooseStory('unknown');
  });

  expect(view.result.current.sourceStoryId).toBe('unknown');
  expect(view.result.current.name).toBe('');
});

it('toggles selections and clears the used-suggestions sub-toggle with its parent', async () => {
  const { view } = await renderState({});
  await waitFor(() => expect(view.result.current.loading).toBe(false));

  await act(async () => {
    view.result.current.toggle('tags')(true);
  });
  expect(view.result.current.selection.tags).toBe(true);
  expect(view.result.current.nothingSelected).toBe(false);

  await act(async () => {
    view.result.current.setSelection((current) => ({
      ...current,
      suggestions: true,
      suggestionsIncludeUsed: true,
    }));
    view.result.current.toggle('suggestions')(false);
  });
  expect(view.result.current.selection.suggestions).toBe(false);
  expect(view.result.current.selection.suggestionsIncludeUsed).toBe(false);
});
