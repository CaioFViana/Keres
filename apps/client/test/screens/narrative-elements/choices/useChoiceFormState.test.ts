import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useChoiceFormState } from '../../../../src/screens/narrative-elements/choices/useChoiceFormState';
import type { ChoiceService } from '../../../../src/services/storymanagement/ChoiceService';

const createChoiceServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as ChoiceService,
});

const renderState = async (options: {
  initialChoiceId?: string;
  initialSceneId?: string;
  storyId?: string;
  choice?: object | null;
  serviceRef?: { current: ChoiceService | null };
}) => {
  const choiceServiceRef = options.serviceRef ?? createChoiceServiceRef();
  if (options.choice !== undefined && choiceServiceRef.current) {
    (choiceServiceRef.current.getById as jest.Mock).mockResolvedValue(options.choice);
  }
  const view = await renderHook(() =>
    useChoiceFormState({
      initialChoiceId: options.initialChoiceId,
      initialSceneId: options.initialSceneId,
      storyId: options.storyId ?? 'story-1',
      choiceServiceRef,
    }),
  );
  return { choiceServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('starts a creation form with the originating scene preselected', async () => {
  const { choiceServiceRef, view } = await renderState({ initialSceneId: 'scene-9' });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.sceneId).toBe('scene-9');
  expect(view.result.current.nextSceneId).toBeNull();
  expect(view.result.current.text).toBe('');
  expect(view.result.current.isEditing).toBe(false);
  expect(choiceServiceRef.current!.getById).not.toHaveBeenCalled();
});

it('retains a newly persisted choice id and exposes field setters', async () => {
  const { view } = await renderState({});

  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await act(async () => {
    view.result.current.setText('Open the gate');
    view.result.current.setNotes('Loud');
    view.result.current.retainPersistedChoiceId('choice-created');
  });

  expect(view.result.current.text).toBe('Open the gate');
  expect(view.result.current.notes).toBe('Loud');
  expect(view.result.current.currentChoiceId).toBe('choice-created');
  expect(view.result.current.isEditing).toBe(true);
});

it('hydrates the choice the form opens with', async () => {
  const { choiceServiceRef, view } = await renderState({
    initialChoiceId: 'choice-1',
    choice: {
      sceneId: 'scene-1',
      nextSceneId: 'scene-2',
      text: 'Go north',
      notes: 'Cold',
    },
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(choiceServiceRef.current!.getById).toHaveBeenCalledWith('choice-1');
  expect(view.result.current.sceneId).toBe('scene-1');
  expect(view.result.current.nextSceneId).toBe('scene-2');
  expect(view.result.current.text).toBe('Go north');
  expect(view.result.current.notes).toBe('Cold');
});

it('warns and finishes loading when the choice is missing', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { view } = await renderState({ initialChoiceId: 'missing', choice: null });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(warn).toHaveBeenCalledWith('Choice not found:', 'missing');
  expect(view.result.current.text).toBe('');
  warn.mockRestore();
});

it('finishes loading without a service instead of hanging', async () => {
  const { view } = await renderState({ serviceRef: { current: null } });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(view.result.current.isEditing).toBe(false);
});

it('logs and finishes loading when hydration fails', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const choiceServiceRef = createChoiceServiceRef();
  (choiceServiceRef.current.getById as jest.Mock).mockRejectedValue(new Error('db down'));
  const view = await renderHook(() =>
    useChoiceFormState({
      initialChoiceId: 'choice-1',
      storyId: 'story-1',
      choiceServiceRef,
    }),
  );

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(error).toHaveBeenCalledWith('Failed to load choice:', expect.any(Error));
  error.mockRestore();
});
