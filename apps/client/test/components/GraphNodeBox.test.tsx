jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      border: '#dddddd',
      primaryContainer: '#cde',
      surface: '#ffffff',
      textSecondary: '#666666',
      primary: '#0000ff',
      onPrimary: '#fefefe',
      text: '#111111',
    },
  }),
}));

import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import GraphNodeBox, {
  type GraphNodeBoxNode,
} from '../../src/components/features/graphs/GraphNodeBox/GraphNodeBox';

const NODE: GraphNodeBoxNode = {
  id: 'n1',
  x: 10,
  y: 20,
  width: 112,
  height: 44,
  labelLines: ['Ana', 'Souza'],
  isIsolated: false,
};

const renderNode = (
  overrides: Partial<React.ComponentProps<typeof GraphNodeBox>> = {},
  node: GraphNodeBoxNode = NODE,
) =>
  render(
    <GraphNodeBox
      node={node}
      shape="pill"
      selected={false}
      highlighted={false}
      dimmed={false}
      accessibilityLabel="Ana Souza, 3 relations"
      onPress={jest.fn()}
      {...overrides}
    />,
  );

/** The outer pressable and the inner box that carries the border and the fill. */
const boxes = (view: Awaited<ReturnType<typeof renderNode>>) => {
  const outer = view.getByRole('button');
  const inner = view.getByText('Ana').parent as NonNullable<typeof outer.parent>;
  return {
    outer: StyleSheet.flatten(outer.props.style),
    inner: StyleSheet.flatten(inner.props.style),
  };
};

describe('GraphNodeBox', () => {
  it('sits at the position of the node and shows every line of its name', async () => {
    const view = await renderNode();

    expect(boxes(view).outer).toMatchObject({ left: 10, top: 20, width: 112, height: 44 });
    expect(view.getByText('Ana')).toBeTruthy();
    expect(view.getByText('Souza')).toBeTruthy();
  });

  it('is a button a screen reader can name, and says whether it is selected', async () => {
    const plain = await renderNode();
    const button = plain.getByRole('button', { name: 'Ana Souza, 3 relations' });
    expect(button.props.accessibilityState).toEqual({ selected: false });

    const chosen = await renderNode({ selected: true });
    expect(chosen.getByRole('button').props.accessibilityState).toEqual({ selected: true });
  });

  it('presses', async () => {
    const onPress = jest.fn();
    const view = await renderNode({ onPress });

    await fireEvent.press(view.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws a person as a pill and a place as a box', async () => {
    const pill = boxes(await renderNode({ shape: 'pill' })).outer.borderRadius;
    const box = boxes(await renderNode({ shape: 'box' })).outer.borderRadius;

    expect(pill).toBeGreaterThan(box as number);
  });

  it('draws a node with no relations dashed on the plain surface', async () => {
    const view = await renderNode({}, { ...NODE, isIsolated: true });

    expect(boxes(view).inner).toMatchObject({
      borderStyle: 'dashed',
      backgroundColor: '#ffffff',
      borderColor: '#666666',
    });
  });

  it('outlines a node the filter chose in the primary colour, without filling it', async () => {
    const { inner } = boxes(await renderNode({ highlighted: true }));

    expect(inner).toMatchObject({ borderColor: '#0000ff', borderWidth: 2.5 });
    expect(inner.backgroundColor).toBe('#cde');
  });

  it('fills the selected node, with its name in the colour for that fill', async () => {
    const view = await renderNode({ selected: true });

    expect(boxes(view).inner).toMatchObject({ backgroundColor: '#0000ff', borderColor: '#0000ff' });
    expect(StyleSheet.flatten(view.getByText('Ana').props.style).color).toBe('#fefefe');
  });

  it('fades a node that is out of focus, and only then', async () => {
    expect(boxes(await renderNode({ dimmed: true })).inner.opacity).toBeLessThan(0.5);
    expect(boxes(await renderNode()).inner.opacity).toBeUndefined();
  });

  it('shows a small count in the corner only when it has one', async () => {
    const withBadge = await renderNode({ badge: '+3' });
    expect(withBadge.getByText('+3')).toBeTruthy();

    const without = await renderNode();
    expect(without.queryByText('+3')).toBeNull();
  });
});
