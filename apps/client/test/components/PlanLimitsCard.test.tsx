import { render } from '@testing-library/react-native';
import PlanLimitsCard from '../../src/components/features/servers/PlanLimitsCard';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { border: '#ddd', card: '#fff', text: '#111', textSecondary: '#555', error: '#f00' },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

const plan = (over: Record<string, unknown> = {}) =>
  ({
    tierName: 'Free',
    isDefault: true,
    maxStories: 3,
    maxEntitiesPerStory: 200,
    maxEntitiesTotal: 500,
    maxPublicationsPerDay: 1,
    maxPublishedArcs: null,
    maxCommentsPerStory: 50,
    maxContributorsPerStory: null,
    storiesUsed: 2,
    entitiesUsedTotal: 480,
    ...over,
  }) as never;

describe('PlanLimitsCard', () => {
  it('names the plan, says it is the one every account starts on, and lists what it comes with', async () => {
    const view = await render(<PlanLimitsCard plan={plan()} />);

    expect(view.getByText('Free')).toBeTruthy();
    expect(view.getByText('plan_card_default_hint')).toBeTruthy();
    expect(view.getByText('plan_limit_stories_other:{"count":3}')).toBeTruthy();
    expect(view.getByText('plan_limit_entities_other:{"count":500}')).toBeTruthy();
    expect(view.getByText('plan_limit_publications_one:{"count":1}')).toBeTruthy();
    expect(view.getByText('plan_limit_works_unlimited')).toBeTruthy();
    expect(view.getByText('plan_limit_comments_other:{"count":50}')).toBeTruthy();
  });

  it('lists the cap on collaborators per story', async () => {
    const view = await render(<PlanLimitsCard plan={plan({ maxContributorsPerStory: 2 })} />);

    expect(view.getByText('plan_limit_contributors_other:{"count":2}')).toBeTruthy();
  });

  it('says a plan with no collaborators per story allows none', async () => {
    const view = await render(<PlanLimitsCard plan={plan({ maxContributorsPerStory: 0 })} />);

    expect(view.getByText('plan_limit_contributors_none')).toBeTruthy();
  });

  it('shows how much of the stories and of the total items is in use', async () => {
    const view = await render(<PlanLimitsCard plan={plan()} />);

    expect(view.getByText('plan_card_stories_used:{"used":2,"limit":3}')).toBeTruthy();
    expect(view.getByText('plan_card_entities_used:{"used":480,"limit":500}')).toBeTruthy();
  });

  it('leaves out the usage of a ceiling the plan does not have, and the default hint of a chosen plan', async () => {
    const view = await render(
      <PlanLimitsCard
        plan={plan({ tierName: 'Pro', isDefault: false, maxStories: null, maxEntitiesTotal: null })}
      />,
    );

    expect(view.getByText('Pro')).toBeTruthy();
    expect(view.queryByText('plan_card_default_hint')).toBeNull();
    expect(view.queryByText(/plan_card_stories_used/)).toBeNull();
    expect(view.queryByText(/plan_card_entities_used/)).toBeNull();
  });

  it('says there are no limits when the server has no plan at all', async () => {
    const view = await render(
      <PlanLimitsCard
        plan={plan({ tierName: null, isDefault: false, maxStories: null, maxEntitiesTotal: null })}
      />,
    );

    expect(view.getByText('plan_card_no_plan')).toBeTruthy();
  });
});
