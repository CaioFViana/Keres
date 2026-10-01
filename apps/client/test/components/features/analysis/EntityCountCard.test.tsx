import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}));
jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      primary: '#0000ff',
      primaryContainer: '#eeeeff',
      onPrimaryContainer: '#000066',
      secondary: '#008888',
      accent: '#ffaa00',
      error: '#ff0000',
      card: '#ffffff',
      surface: '#f5f5f5',
      text: '#111111',
      textSecondary: '#555555',
      border: '#dddddd',
    },
  }),
}));

import EntityCountCard from '../../../../src/components/features/analysis/EntityCountCard/EntityCountCard';

const labels: Record<string, string> = {
  Character: 'Characters',
  Scene: 'Scenes',
  TagRelation: 'Tag assignments',
};
const labelFor = (type: string) => labels[type] ?? type;
const byType = { Scene: 5, Character: 2, TagRelation: 9 };

/** The types in the order the rows appear on screen. */
const order = (view: Awaited<ReturnType<typeof render>>) => {
  const tree = JSON.stringify(view.toJSON());
  return ['Character', 'Scene', 'TagRelation']
    .map((type) => ({ type, at: tree.indexOf(`"entity-count-${type}"`) }))
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.type);
};

describe('EntityCountCard', () => {
  it('lists the types most numerous first, and flips each header on a second tap', async () => {
    const view = await render(
      <EntityCountCard
        total={16}
        byType={byType}
        labelFor={labelFor}
        plan={null}
        onServer={false}
      />,
    );
    expect(order(view)).toEqual(['TagRelation', 'Scene', 'Character']);
    expect(view.getByTestId('entity-count-sort-count-desc')).toBeTruthy();

    await fireEvent.press(view.getByTestId('entity-count-sort-count'));
    expect(order(view)).toEqual(['Character', 'Scene', 'TagRelation']);
    expect(view.getByTestId('entity-count-sort-count-asc')).toBeTruthy();

    // Names read A to Z first (Characters, Scenes, Tag assignments); the same header again turns it around.
    await fireEvent.press(view.getByTestId('entity-count-sort-name'));
    expect(order(view)).toEqual(['Character', 'Scene', 'TagRelation']);
    expect(view.getByTestId('entity-count-sort-name-asc')).toBeTruthy();
    expect(view.queryByTestId('entity-count-sort-count-asc')).toBeNull();
    await fireEvent.press(view.getByTestId('entity-count-sort-name'));
    expect(order(view)).toEqual(['TagRelation', 'Scene', 'Character']);
    expect(view.getByTestId('entity-count-sort-name-desc')).toBeTruthy();
  });

  it('says so, and offers no sorting, for a story with nothing in it', async () => {
    const view = await render(
      <EntityCountCard total={0} byType={{}} labelFor={labelFor} plan={null} onServer={false} />,
    );

    expect(view.getByTestId('entity-count-total').props.children).toBe(0);
    expect(view.getByText('entity_count_empty')).toBeTruthy();
    expect(view.queryByTestId('entity-count-sort-name')).toBeNull();
  });

  it('puts the count against the plan, and leaves the plan out when there is none to show', async () => {
    const view = await render(
      <EntityCountCard
        total={251}
        byType={{ Character: 251 }}
        labelFor={labelFor}
        plan={{
          tierName: 'Pro',
          maxEntitiesPerStory: 500,
          maxEntitiesTotal: 900,
          entitiesUsedTotal: 640,
        }}
        onServer
      />,
    );
    expect(view.getByText('entity_count_plan_named:Pro')).toBeTruthy();
    expect(view.getByText('251 / 500')).toBeTruthy();
    expect(view.getByText('640 / 900')).toBeTruthy();

    const without = await render(
      <EntityCountCard
        total={251}
        byType={{ Character: 251 }}
        labelFor={labelFor}
        plan={null}
        onServer={false}
      />,
    );
    expect(without.queryByTestId('entity-count-plan')).toBeNull();
  });

  it('shows an unlimited plan without a bar, and no total row without a total ceiling', async () => {
    const view = await render(
      <EntityCountCard
        total={30}
        byType={{ Character: 30 }}
        labelFor={labelFor}
        plan={{
          tierName: null,
          maxEntitiesPerStory: null,
          maxEntitiesTotal: null,
          entitiesUsedTotal: 0,
        }}
        onServer
      />,
    );
    expect(view.getByText('entity_count_plan')).toBeTruthy();
    expect(view.getByText('30 · entity_count_unlimited')).toBeTruthy();
    expect(view.queryByTestId('entity-count-plan-total')).toBeNull();
  });

  it('words its note differently for a story that lives only on this device', async () => {
    const local = await render(
      <EntityCountCard
        total={1}
        byType={{ Character: 1 }}
        labelFor={labelFor}
        plan={null}
        onServer={false}
      />,
    );
    expect(local.getByText('entity_count_hint_local')).toBeTruthy();
    expect(local.queryByText('entity_count_hint')).toBeNull();

    // On a server whose plan could not be read, it is still the server's way of counting.
    const synced = await render(
      <EntityCountCard
        total={1}
        byType={{ Character: 1 }}
        labelFor={labelFor}
        plan={null}
        onServer
      />,
    );
    expect(synced.getByText('entity_count_hint')).toBeTruthy();
  });
});
