import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import type { StoryArcSelect } from '../../src/db/schema';
import AppearsInArcsSection from '../../src/components/features/arcs/AppearsInArcsSection';
import ArcPickerModal from '../../src/components/features/arcs/ArcPickerModal';

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
// (Prototype-chained, not spread: spreading `react-native` trips native-only getters.)
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const mocked = Object.create(actual);
  // defineProperty: the prototype's exports are setter-less getters, so plain
  // assignment would silently keep the real component.
  Object.defineProperty(mocked, 'Modal', {
    value: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? children : null,
  });
  return mocked;
});

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { primary: '#00f', surface: '#fff', text: '#111' } }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  useStoryVocabulary: () => ({
    term: (value: string, plural = false) => (plural ? `${value}s` : value),
  }),
}));

const mockCollapsibleCard = jest.fn();
jest.mock('../../src/components/common/display/CollapsibleCard/CollapsibleCard', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  const { View } = jest.requireActual('react-native');
  return function MockCollapsibleCard({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    mockCollapsibleCard(title);
    return React.createElement(View, { testID: 'collapsible-card' }, children);
  };
});

const mockRelationList = jest.fn();
jest.mock('../../src/components/common/display/EntityRelationList/EntityRelationList', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: { items: unknown[]; emptyText: string }) => {
      mockRelationList(props);
      return React.createElement(View, { testID: 'relation-list' });
    },
  };
});

const arc = (overrides: Partial<StoryArcSelect> = {}): StoryArcSelect =>
  ({
    id: 'arc-1',
    title: 'First Arc',
    icon: 'library',
    color: '#123456',
    ...overrides,
  }) as StoryArcSelect;

beforeEach(() => jest.clearAllMocks());

describe('AppearsInArcsSection', () => {
  it('renders nothing when there are no arcs', async () => {
    const view = await render(<AppearsInArcsSection arcs={[]} />);

    expect(view.toJSON()).toBeNull();
    expect(mockRelationList).not.toHaveBeenCalled();
  });

  it('maps arcs to relation rows with icon and color fallbacks', async () => {
    await render(
      <AppearsInArcsSection
        arcs={[
          arc(),
          arc({ id: 'arc-2', title: 'Second', icon: 'keres:castle', color: null }),
          arc({ id: 'arc-3', title: 'Third', icon: null, color: null }),
        ]}
      />,
    );

    expect(mockCollapsibleCard).toHaveBeenCalledWith('appears_in_arcs');
    const props = mockRelationList.mock.calls[0][0] as {
      items: {
        id: string;
        title: string;
        color: string;
        leading: { props: { children: { props: Record<string, unknown> } } };
      }[];
      emptyText: string;
    };
    expect(props.emptyText).toBe('appears_in_arcs_empty');
    expect(props.items.map((item) => [item.id, item.title, item.color])).toEqual([
      ['arc-1', 'First Arc', '#123456'],
      ['arc-2', 'Second', '#00f'],
      ['arc-3', 'Third', '#00f'],
    ]);
    // Each row draws the arc's stored icon through MapIcon - the Keres pick passes
    // through, while a missing icon falls back to the library.
    const icons = props.items.map((item) => item.leading.props.children.props);
    expect(icons[0]).toMatchObject({ name: 'library', color: '#123456' });
    expect(icons[1]).toMatchObject({ name: 'keres:castle', color: '#00f' });
    expect(icons[2]).toMatchObject({ name: 'library', color: '#00f' });
  });
});

describe('ArcPickerModal', () => {
  const arcs = [arc(), arc({ id: 'arc-2', title: 'Second Arc', color: null })];

  it('renders nothing when hidden', async () => {
    const view = await render(
      <ArcPickerModal
        visible={false}
        arcs={arcs}
        activeArcId={null}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('chooses "all arcs" and closes', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <ArcPickerModal
        visible
        arcs={arcs}
        activeArcId="arc-1"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(view.getByText('arc_picker_title')).toBeTruthy();
    await fireEvent.press(view.getByText('all_arcs'));

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('chooses one arc and closes', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <ArcPickerModal
        visible
        arcs={arcs}
        activeArcId={null}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    await fireEvent.press(view.getByText('Second Arc'));

    expect(onSelect).toHaveBeenCalledWith('arc-2');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
