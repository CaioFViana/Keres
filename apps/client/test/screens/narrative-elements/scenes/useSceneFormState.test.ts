const mockGetValuesForEntity = jest.fn();

jest.mock('../../../../src/services/storymanagement/AttributeValueService', () => ({
  createAttributeValueService: () => ({ getValuesForEntity: mockGetValuesForEntity }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { StorySchemaField } from '@keres/shared';
import { useSceneFormState } from '../../../../src/screens/narrative-elements/scenes/useSceneFormState';
import type { SceneService } from '../../../../src/services/storymanagement/SceneService';

const createSceneServiceRef = () => ({
  current: {
    getById: jest.fn(),
  } as unknown as SceneService,
});
const drizzleDb = {} as never;
const customFields: StorySchemaField[] = [];

const renderState = async (initialSceneId?: string, scene?: object) => {
  const sceneServiceRef = createSceneServiceRef();
  if (scene) {
    (sceneServiceRef.current!.getById as jest.Mock).mockResolvedValue(scene);
  }
  const view = await renderHook(() =>
    useSceneFormState({
      initialSceneId,
      storyId: 'story-1',
      drizzleDb,
      sceneServiceRef,
      customFields,
    }),
  );
  return { sceneServiceRef, view };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetValuesForEntity.mockResolvedValue([]);
});

it('retains a newly created scene id without rehydrating over draft attributes', async () => {
  const { sceneServiceRef, view } = await renderState();

  await act(async () => {
    view.result.current.setCustomValues({ field: 'draft value' });
    view.result.current.retainPersistedSceneId('scene-created');
  });

  expect(view.result.current.currentSceneId).toBe('scene-created');
  expect(view.result.current.customValues).toEqual({ field: 'draft value' });
  expect(sceneServiceRef.current!.getById).not.toHaveBeenCalled();
  expect(mockGetValuesForEntity).not.toHaveBeenCalled();
});

it('still hydrates the scene and attributes supplied when the form opens', async () => {
  mockGetValuesForEntity.mockResolvedValue([{ fieldId: 'field', value: 'persisted value' }]);
  const { sceneServiceRef, view } = await renderState('scene-existing', {
    chapterId: 'chapter-1',
    locationId: null,
    name: 'Existing scene',
    summary: null,
    isFavorite: false,
    extraNotes: null,
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
  });

  await waitFor(() => expect(view.result.current.loading).toBe(false));

  expect(sceneServiceRef.current!.getById).toHaveBeenCalledWith('scene-existing');
  expect(mockGetValuesForEntity).toHaveBeenCalledWith('scene-existing');
  expect(view.result.current.name).toBe('Existing scene');
  expect(view.result.current.customValues).toEqual({ field: 'persisted value' });
});
