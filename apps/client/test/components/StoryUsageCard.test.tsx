import { render } from '@testing-library/react-native';
import StoryUsageCard from '@/src/components/features/servers/StoryUsageCard';

jest.mock('@/src/theme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      card: '#fff',
      text: '#111',
      textSecondary: '#555',
      error: '#f00',
      accent: '#fa0',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

const stories = [
  { id: 'a', title: 'Alpha', total: 200 },
  { id: 'b', title: 'Beta', total: 185 },
  { id: 'c', title: 'Gamma', total: 20 },
];

const colorOf = (view: Awaited<ReturnType<typeof render>>, text: string) =>
  // The last colour wins, as it does on screen.
  (view.getByText(text).props.style as { color?: string }[])
    .flat()
    .filter((s) => s?.color)
    .at(-1)?.color;

describe('StoryUsageCard', () => {
  it('shows each story with its count against the ceiling, coloured by how close it is', async () => {
    const view = await render(<StoryUsageCard stories={stories} limit={200} />);

    expect(view.getByText('Alpha')).toBeTruthy();
    expect(view.getByText('plan_card_story_items_of:{"used":200,"limit":200}')).toBeTruthy();
    expect(colorOf(view, 'plan_card_story_items_of:{"used":200,"limit":200}')).toBe('#f00');
    expect(colorOf(view, 'plan_card_story_items_of:{"used":185,"limit":200}')).toBe('#fa0');
    expect(colorOf(view, 'plan_card_story_items_of:{"used":20,"limit":200}')).toBe('#111');
  });

  it('shows only the count when the plan has no per-story ceiling', async () => {
    const view = await render(<StoryUsageCard stories={stories} limit={null} />);

    expect(view.getByText('200')).toBeTruthy();
    expect(view.queryByText(/plan_card_story_items_of/)).toBeNull();
    expect(colorOf(view, '200')).toBe('#111');
  });

  it('shows nothing when there is no story', async () => {
    const view = await render(<StoryUsageCard stories={[]} limit={200} />);

    expect(view.queryByTestId('story-usage-card')).toBeNull();
  });
});
