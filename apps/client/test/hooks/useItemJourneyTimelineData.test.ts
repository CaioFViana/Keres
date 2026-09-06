const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/ItemJourneyService', () => ({
  __esModule: true,
  createItemJourneyService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useItemJourneyTimelineData } from '../../src/hooks/useItemJourneyTimelineData';
import { createCharacterService } from '../../src/services/storymanagement/CharacterService';
import { createChapterService } from '../../src/services/storymanagement/ChapterService';
import { createChoiceService } from '../../src/services/storymanagement/ChoiceService';
import { createItemJourneyService } from '../../src/services/storymanagement/ItemJourneyService';
import { createSceneService } from '../../src/services/storymanagement/SceneService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const journeyService = {
  getItemJourneysByItemId: jest.fn().mockResolvedValue([{ id: 'journey' }]),
};

beforeEach(() => {
  jest.clearAllMocks();
  journeyService.getItemJourneysByItemId.mockResolvedValue([{ id: 'journey' }]);
  (createItemJourneyService as jest.Mock).mockReturnValue(journeyService);
  (createSceneService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'scene' }]),
  });
  (createChapterService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'chapter' }]),
  });
  (createChoiceService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'choice' }]),
  });
  (createCharacterService as jest.Mock).mockReturnValue({
    getAllByStoryId: jest.fn().mockResolvedValue([{ id: 'character' }]),
  });
});

describe('useItemJourneyTimelineData', () => {
  it('loads every timeline dependency together', async () => {
    const view = await renderHook(() => useItemJourneyTimelineData('story', 'item'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({
      journeys: [{ id: 'journey' }],
      scenes: [{ id: 'scene' }],
      chapters: [{ id: 'chapter' }],
      choices: [{ id: 'choice' }],
      characters: [{ id: 'character' }],
    });
  });

  it('reloads when the item changes in this story', async () => {
    const view = await renderHook(() => useItemJourneyTimelineData('story', 'item'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    await act(async () => entityEventEmitter.emit('item_journey_changed', 'other-story'));
    expect(journeyService.getItemJourneysByItemId).toHaveBeenCalledTimes(1);
    await act(async () => entityEventEmitter.emit('item_journey_changed', 'story'));
    await waitFor(() => expect(journeyService.getItemJourneysByItemId).toHaveBeenCalledTimes(2));
  });
});
