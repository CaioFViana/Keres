jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { text: '#111', textSecondary: '#555', surface: '#fff', border: '#ddd' },
  }),
}));

import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import GraphLegend from '../../src/components/features/graphs/GraphLegend/GraphLegend';

const ITEMS = [
  { id: 'a', label: 'Friends', color: '#ff0000' },
  { id: 'b', label: 'Connected', color: '#00ff00', dashed: true },
];

describe('GraphLegend', () => {
  it('draws nothing when there is nothing to explain', async () => {
    const view = await render(<GraphLegend title="Legend" items={[]} />);

    expect(view.toJSON()).toBeNull();
  });

  it('starts closed: only the chip shows', async () => {
    const view = await render(<GraphLegend title="Legend" items={ITEMS} />);

    expect(view.getByRole('button', { name: 'Legend' }).props.accessibilityState).toEqual({
      expanded: false,
    });
    expect(view.queryByText('Friends')).toBeNull();
  });

  it('opens into the list on a press, and closes on the next', async () => {
    const view = await render(<GraphLegend title="Legend" items={ITEMS} />);

    await fireEvent.press(view.getByRole('button', { name: 'Legend' }));
    expect(view.getByText('Friends')).toBeTruthy();
    expect(view.getByText('Connected')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Legend' }).props.accessibilityState).toEqual({
      expanded: true,
    });

    await fireEvent.press(view.getByRole('button', { name: 'Legend' }));
    expect(view.queryByText('Friends')).toBeNull();
  });

  it('draws each item with its colour, dashed only where asked', async () => {
    const view = await render(<GraphLegend title="Legend" items={ITEMS} />);
    await fireEvent.press(view.getByRole('button', { name: 'Legend' }));

    const swatchOf = (id: string) =>
      StyleSheet.flatten(view.getByTestId(`graph-legend-swatch-${id}`).props.style);
    expect(swatchOf('a')).toMatchObject({ borderTopColor: '#ff0000' });
    expect(swatchOf('a')).not.toHaveProperty('borderStyle');
    expect(swatchOf('b')).toMatchObject({
      borderTopColor: '#00ff00',
      borderStyle: 'dashed',
    });
  });

  describe('rows that switch a kind of line', () => {
    it('are switches, reporting whether the kind is shown', async () => {
      const onToggle = jest.fn();
      const view = await render(
        <GraphLegend
          title="Legend"
          items={[
            { id: 'a', label: 'Friends', color: '#f00', onToggle },
            { id: 'b', label: 'Rivals', color: '#0f0', onToggle: jest.fn(), hidden: true },
          ]}
        />,
      );
      await fireEvent.press(view.getByRole('button', { name: 'Legend' }));

      expect(view.getByRole('checkbox', { name: 'Friends' }).props.accessibilityState).toEqual({
        checked: true,
      });
      expect(view.getByRole('checkbox', { name: 'Rivals' }).props.accessibilityState).toEqual({
        checked: false,
      });

      await fireEvent.press(view.getByRole('checkbox', { name: 'Friends' }));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('strike out the name of a kind that is hidden', async () => {
      const view = await render(
        <GraphLegend
          title="Legend"
          items={[{ id: 'b', label: 'Rivals', color: '#0f0', onToggle: jest.fn(), hidden: true }]}
        />,
      );
      await fireEvent.press(view.getByRole('button', { name: 'Legend' }));

      expect(StyleSheet.flatten(view.getByText('Rivals').props.style).textDecorationLine).toBe(
        'line-through',
      );
    });

    it('leave a row without a handler as plain text', async () => {
      const view = await render(<GraphLegend title="Legend" items={ITEMS} />);
      await fireEvent.press(view.getByRole('button', { name: 'Legend' }));

      expect(view.queryByRole('checkbox')).toBeNull();
    });
  });
});
