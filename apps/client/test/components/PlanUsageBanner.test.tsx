/**
 * @jest-environment jsdom
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${options.used}/${options.limit}:${options.percent}` : key,
  }),
}));
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: 'Icon' }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { error: '#ff0000', accent: '#ffaa00', surface: '#f5f5f5', text: '#111111' },
  }),
}));

import { act, render } from '@testing-library/react-native';
import PlanUsageBanner from '../../src/components/common/feedback/PlanUsageBanner/PlanUsageBanner';
import { usePlanUsageStore } from '../../src/state/planUsageStore';
import { useStoryStore } from '../../src/state/storyStore';
import { evaluatePlanUsage } from '../../src/utils/planUsage';

const plan = { maxEntitiesPerStory: 100, maxEntitiesTotal: 1000 };
const show = (storyUsed: number, totalUsed = 0, storyId = 'story-1') =>
  usePlanUsageStore.getState().set(storyId, evaluatePlanUsage(plan, storyUsed, totalUsed));

beforeEach(() => {
  usePlanUsageStore.getState().clear();
  useStoryStore.setState({ selectedStory: { id: 'story-1' } as never });
});

describe('PlanUsageBanner', () => {
  it('shows nothing while the story is well inside its plan, or no plan was read', async () => {
    const view = await render(<PlanUsageBanner />);
    expect(view.queryByTestId('plan-usage-banner')).toBeNull();

    await act(async () => show(50));
    expect(view.queryByTestId('plan-usage-banner')).toBeNull();
  });

  it('warns from 90% of a ceiling, with how much is used', async () => {
    const view = await render(<PlanUsageBanner />);

    await act(async () => show(91));

    expect(view.getByTestId('plan-usage-banner')).toBeTruthy();
    expect(view.getByText('plan_usage_banner_story:91/100:91')).toBeTruthy();
  });

  it('speaks of the total ceiling when that is the one closest to its limit', async () => {
    const view = await render(<PlanUsageBanner />);

    await act(async () => show(10, 960));

    expect(view.getByText('plan_usage_banner_total:960/1000:96')).toBeTruthy();
  });

  it('says nothing more can be created once the limit is reached', async () => {
    const view = await render(<PlanUsageBanner />);

    await act(async () => show(100));

    expect(view.getByText('plan_usage_reached_story:100/100:100')).toBeTruthy();
  });

  it('ignores a summary that belongs to another story', async () => {
    const view = await render(<PlanUsageBanner />);

    await act(async () => show(99, 0, 'another-story'));

    expect(view.queryByTestId('plan-usage-banner')).toBeNull();
  });

  it('goes away when the story is back inside its plan', async () => {
    const view = await render(<PlanUsageBanner />);
    await act(async () => show(97));
    expect(view.queryByTestId('plan-usage-banner')).not.toBeNull();

    await act(async () => show(40));

    expect(view.queryByTestId('plan-usage-banner')).toBeNull();
  });
});
