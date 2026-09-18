import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useItemJourneyFormState } from '../../../src/screens/itemJourneys/useItemJourneyFormState';
import type { ItemJourneyService } from '../../../src/services/storymanagement/ItemJourneyService';

const createItemJourneyServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ItemJourneyService,
});

const renderState = async (options?: {
  initialItemJourneyId?: string;
  prefilledItemId?: string;
  journey?: object;
  storyId?: string;
}) => {
  const itemJourneyServiceRef = createItemJourneyServiceRef();
  if (options?.journey) {
    (itemJourneyServiceRef.current!.getById as jest.Mock).mockResolvedValue(options.journey);
  }
  const view = await renderHook(() =>
    useItemJourneyFormState({
      initialItemJourneyId: options?.initialItemJourneyId,
      prefilledItemId: options?.prefilledItemId,
      storyId: options?.storyId ?? 'story-1',
      itemJourneyServiceRef,
    }),
  );
  return { itemJourneyServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps the prefilled item for a new journey without hydrating', async () => {
  const { itemJourneyServiceRef, view } = await renderState({ prefilledItemId: 'item-1' });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.itemId).toBe('item-1');
  expect(view.result.current.isEditing).toBe(false);
  expect(itemJourneyServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('retains a newly created journey id without touching the draft fields', async () => {
  const { view } = await renderState({ prefilledItemId: 'item-1' });

  await act(async () => {
    view.result.current.setNewState('broken');
    view.result.current.retainPersistedItemJourneyId('journey-created');
  });

  expect(view.result.current.currentItemJourneyId).toBe('journey-created');
  expect(view.result.current.newState).toBe('broken');
  expect(view.result.current.itemId).toBe('item-1');
});

it('hydrates the journey supplied when the form opens', async () => {
  const { itemJourneyServiceRef, view } = await renderState({
    initialItemJourneyId: 'journey-existing',
    journey: {
      itemId: 'item-2',
      sceneId: 'scene-3',
      newCharacterOwnerId: 'character-4',
      newState: 'reforged',
      extraNotes: 'a note',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(itemJourneyServiceRef.current!.getById).toHaveBeenCalledWith('journey-existing');
  expect(view.result.current.itemId).toBe('item-2');
  expect(view.result.current.sceneId).toBe('scene-3');
  expect(view.result.current.newCharacterOwnerId).toBe('character-4');
  expect(view.result.current.newState).toBe('reforged');
  expect(view.result.current.extraNotes).toBe('a note');
  expect(view.result.current.isEditing).toBe(true);
});

it('finishes loading without a service even when an id was supplied', async () => {
  const view = await renderHook(() =>
    useItemJourneyFormState({
      initialItemJourneyId: 'journey-existing',
      storyId: 'story-1',
      itemJourneyServiceRef: { current: null },
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.isEditing).toBe(true);
});
