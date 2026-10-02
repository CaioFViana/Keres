/**
 * @jest-environment node
 */
const mockCountForStory = jest.fn();
const mockGetPlan = jest.fn();
const mockNotify = jest.fn();

jest.mock('../../src/services/storymanagement/StoryEntityCountService', () => ({
  __esModule: true,
  createStoryEntityCountService: () => ({ countForStory: mockCountForStory }),
}));
jest.mock('../../src/services/StoryPlanService', () => ({
  __esModule: true,
  createStoryPlanService: () => ({ getPlan: mockGetPlan }),
}));
jest.mock('../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: { getState: () => ({ showNotification: mockNotify }) },
}));
jest.mock('../../src/utils/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, options: { used: number; limit: number }) =>
      `${key}:${options.used}/${options.limit}`,
  },
}));

import {
  PLAN_CACHE_MS,
  refreshPlanUsage,
  resetPlanUsageState,
} from '../../src/services/PlanUsageService';
import { usePlanUsageStore } from '../../src/state/planUsageStore';

const db = {} as never;
const story = { id: 'story-1', serverId: 'server-1' };
const plan = (over: Record<string, unknown> = {}) => ({
  tierName: 'Pro',
  maxEntitiesPerStory: 100,
  maxEntitiesTotal: null,
  entitiesUsedTotal: 0,
  ...over,
});
const summary = () => usePlanUsageStore.getState().summary;

beforeEach(() => {
  jest.clearAllMocks();
  resetPlanUsageState();
  mockCountForStory.mockResolvedValue({ total: 10, byType: {} });
  mockGetPlan.mockResolvedValue(plan());
});

describe('refreshPlanUsage', () => {
  it('has nothing to show for a story that is only on this device, and does not ask for a plan', async () => {
    usePlanUsageStore.getState().set('story-1', { story: null, total: null, worst: null });

    await refreshPlanUsage(db, { id: 'story-1', serverId: null });

    expect(usePlanUsageStore.getState().summary).toBeNull();
    expect(mockGetPlan).not.toHaveBeenCalled();
  });

  it('measures the story count against the plan and keeps it for the editor', async () => {
    mockCountForStory.mockResolvedValue({ total: 92, byType: {} });

    await refreshPlanUsage(db, story);

    expect(usePlanUsageStore.getState().storyId).toBe('story-1');
    expect(summary()?.story).toMatchObject({ used: 92, limit: 100, level: 'warning' });
    expect(summary()?.worst?.scope).toBe('story');
    // A warning is the editor's business; the notification waits for the alert mark.
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('announces once when the alert mark is reached, in the plan words, and not on every edit', async () => {
    mockCountForStory.mockResolvedValue({ total: 96, byType: {} });

    await refreshPlanUsage(db, story);
    await refreshPlanUsage(db, story);
    await refreshPlanUsage(db, story);

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith('plan_usage_toast_story:96/100', 'warning');
  });

  it('says the limit is reached, rather than close, once it is', async () => {
    mockCountForStory.mockResolvedValue({ total: 100, byType: {} });

    await refreshPlanUsage(db, story);

    expect(mockNotify).toHaveBeenCalledWith('plan_usage_reached_story:100/100', 'warning');
  });

  it('announces again after the story went back under the alert mark', async () => {
    mockCountForStory.mockResolvedValue({ total: 96, byType: {} });
    await refreshPlanUsage(db, story);
    mockCountForStory.mockResolvedValue({ total: 80, byType: {} });
    await refreshPlanUsage(db, story);
    mockCountForStory.mockResolvedValue({ total: 97, byType: {} });

    await refreshPlanUsage(db, story);

    expect(mockNotify).toHaveBeenCalledTimes(2);
  });

  it('keeps the story and the total ceilings apart, each announced for itself', async () => {
    mockGetPlan.mockResolvedValue(plan({ maxEntitiesTotal: 1000, entitiesUsedTotal: 970 }));
    mockCountForStory.mockResolvedValue({ total: 96, byType: {} });

    await refreshPlanUsage(db, story);

    expect(mockNotify).toHaveBeenCalledWith('plan_usage_toast_story:96/100', 'warning');
    expect(mockNotify).toHaveBeenCalledWith('plan_usage_toast_total:970/1000', 'warning');
  });

  it('moves the total with what this story gained since the plan was read, without asking again', async () => {
    mockGetPlan.mockResolvedValue(plan({ maxEntitiesTotal: 1000, entitiesUsedTotal: 900 }));
    mockCountForStory.mockResolvedValue({ total: 10, byType: {} });
    await refreshPlanUsage(db, story, 0);

    mockCountForStory.mockResolvedValue({ total: 60, byType: {} });
    await refreshPlanUsage(db, story, 1000);

    expect(mockGetPlan).toHaveBeenCalledTimes(1);
    expect(summary()?.total).toMatchObject({ used: 950, limit: 1000, level: 'alert' });
  });

  it('reads the plan again once it is old', async () => {
    await refreshPlanUsage(db, story, 0);
    await refreshPlanUsage(db, story, PLAN_CACHE_MS - 1);
    expect(mockGetPlan).toHaveBeenCalledTimes(1);

    await refreshPlanUsage(db, story, PLAN_CACHE_MS);

    expect(mockGetPlan).toHaveBeenCalledTimes(2);
  });

  it('keeps the last plan it read when the server cannot be reached', async () => {
    mockCountForStory.mockResolvedValue({ total: 92, byType: {} });
    await refreshPlanUsage(db, story, 0);
    mockGetPlan.mockResolvedValue(null);

    await refreshPlanUsage(db, story, PLAN_CACHE_MS);

    expect(summary()?.story).toMatchObject({ used: 92, limit: 100 });
  });

  it('has nothing to compare with when no plan was ever read', async () => {
    mockGetPlan.mockResolvedValue(null);

    await refreshPlanUsage(db, story);

    expect(summary()).toBeNull();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('survives a count that fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCountForStory.mockRejectedValue(new Error('db down'));

    await expect(refreshPlanUsage(db, story)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
