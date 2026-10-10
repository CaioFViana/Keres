import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import Button from '../../../src/components/common/controls/Button/Button';
import ThemedSwitch from '../../../src/components/common/controls/ThemedSwitch/ThemedSwitch';
import TriStateToggleButton from '../../../src/components/common/controls/TriStateToggleButton/TriStateToggleButton';

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({
      isDarkMode: false,
      colors: {
        primary: '#0000ff',
        primaryContainer: '#ddddff',
        onPrimary: '#ffffff',
        onPrimaryContainer: '#000088',
        secondary: '#00aaaa',
        onSecondary: '#ffffff',
        background: '#ffffff',
        surface: '#f5f5f5',
        card: '#eeeeee',
        onSurface: '#111111',
        text: '#111111',
        textSecondary: '#555555',
        border: '#dddddd',
        error: '#ff0000',
        onError: '#ffffff',
        accent: '#00ff00',
        onAccent: '#001100',
        notification: '#ffaa00',
        onNotification: '#221100',
        shadow: '#000000',
      },
    }),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Icon',
  MaterialCommunityIcons: 'MIcon',
}));

describe('Button', () => {
  it('renders a string child as themed text and fires onPress', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <Button onPress={onPress} testID="save">
        Save
      </Button>,
    );

    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(screen.getByTestId('save').props.style).backgroundColor).toBe(
      '#0000ff',
    );
  });

  it('renders node children as-is', async () => {
    const screen = await render(
      <Button onPress={() => {}} testID="wrap">
        <View testID="kid" />
      </Button>,
    );

    expect(screen.getByTestId('kid')).toBeTruthy();
  });

  it('does not fire when disabled and shows the disabled treatment', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <Button onPress={onPress} testID="off" disabled>
        Save
      </Button>,
    );

    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(screen.getByTestId('off').props.style).opacity).toBe(0.6);
  });

  it('forwards style and accessibility props', async () => {
    const screen = await render(
      <Button
        onPress={() => {}}
        testID="a11y"
        style={{ backgroundColor: '#123456' }}
        accessibilityLabel="Save story"
        accessibilityHint="Saves the current story"
      >
        Save
      </Button>,
    );

    const host = screen.getByTestId('a11y');
    expect(StyleSheet.flatten(host.props.style).backgroundColor).toBe('#123456');
    expect(host.props.accessibilityLabel).toBe('Save story');
    expect(host.props.accessibilityHint).toBe('Saves the current story');
  });
});

describe('Button variants', () => {
  const styleOf = (screen: Awaited<ReturnType<typeof render>>, testID: string) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style);

  it('draws secondary and danger as outlines, and primary as the fill', async () => {
    const screen = await render(
      <>
        <Button testID="primary" onPress={jest.fn()}>
          Go
        </Button>
        <Button testID="secondary" variant="secondary" onPress={jest.fn()}>
          Maybe
        </Button>
        <Button testID="danger" variant="danger" onPress={jest.fn()}>
          Stop
        </Button>
      </>,
    );

    expect(styleOf(screen, 'primary')).toMatchObject({ backgroundColor: '#0000ff' });
    expect(styleOf(screen, 'secondary')).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: '#0000ff',
    });
    expect(styleOf(screen, 'danger')).toMatchObject({
      backgroundColor: 'transparent',
      borderColor: '#ff0000',
    });
    // The label takes the outline's color, so it reads on the page behind it.
    expect(StyleSheet.flatten(screen.getByText('Stop').props.style).color).toBe('#ff0000');
    expect(StyleSheet.flatten(screen.getByText('Maybe').props.style).color).toBe('#0000ff');
  });

  it('fills a destructive button in the error colour, with no outline', async () => {
    const screen = await render(
      <Button testID="destructive" variant="destructive" onPress={jest.fn()}>
        Delete
      </Button>,
    );

    const style = styleOf(screen, 'destructive');
    expect(style).toMatchObject({ backgroundColor: '#ff0000' });
    expect(style).not.toHaveProperty('borderWidth');
    expect(StyleSheet.flatten(screen.getByText('Delete').props.style).color).not.toBe('#ff0000');
  });
});

const iconsOf = (view: Awaited<ReturnType<typeof render>>) =>
  view.container.queryAll((node: any) => node.type === 'Icon') as any[];

describe('Button icon', () => {
  it('draws the icon before a text label, in the label color, and keeps the word', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <Button variant="danger" icon="ban-outline" onPress={onPress}>
        Block
      </Button>,
    );

    const icon = iconsOf(screen)[0];
    expect(icon.props).toMatchObject({ name: 'ban-outline', size: 18, color: '#ff0000' });
    expect(StyleSheet.flatten(screen.getByText('Block').props.style).color).toBe('#ff0000');
    await fireEvent.press(screen.getByText('Block'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the on-fill color for the icon of a filled button', async () => {
    const screen = await render(
      <Button icon="checkmark" onPress={jest.fn()}>
        Accept
      </Button>,
    );

    const icon = iconsOf(screen)[0];
    expect(icon.props.color).toBe(StyleSheet.flatten(screen.getByText('Accept').props.style).color);
  });

  it('has no icon unless one is given, and leaves node children alone', async () => {
    const plain = await render(<Button onPress={jest.fn()}>Plain</Button>);
    expect(iconsOf(plain)).toHaveLength(0);

    const custom = await render(
      <Button icon="ban-outline" onPress={jest.fn()}>
        <View testID="custom" />
      </Button>,
    );
    expect(custom.getByTestId('custom')).toBeTruthy();
    expect(iconsOf(custom)).toHaveLength(0);
  });
});

describe('ThemedSwitch', () => {
  it('toggles the value when pressed', async () => {
    const onValueChange = jest.fn();
    const screen = await render(
      <ThemedSwitch value={false} onValueChange={onValueChange} testID="sw" />,
    );

    await fireEvent.press(screen.getByTestId('sw'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('does not fire when disabled', async () => {
    const onValueChange = jest.fn();
    const screen = await render(
      <ThemedSwitch value={false} onValueChange={onValueChange} testID="sw" disabled />,
    );

    await fireEvent.press(screen.getByTestId('sw'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('sw').props.accessibilityState).toEqual({
      checked: false,
      disabled: true,
    });
  });

  it('reflects the value in its state and icon', async () => {
    const off = await render(<ThemedSwitch value={false} onValueChange={() => {}} testID="sw" />);
    expect(off.getByTestId('sw').props.accessibilityState.checked).toBe(false);
    expect(off.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe('close');
    await off.unmount();

    const on = await render(<ThemedSwitch value onValueChange={() => {}} testID="sw" />);
    expect(on.getByTestId('sw').props.accessibilityState.checked).toBe(true);
    expect(on.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe('checkmark');
  });

  it('survives a value change after mount', async () => {
    const screen = await render(
      <ThemedSwitch value={false} onValueChange={() => {}} testID="sw" />,
    );
    await screen.rerender(<ThemedSwitch value onValueChange={() => {}} testID="sw" />);
    expect(screen.getByTestId('sw').props.accessibilityState.checked).toBe(true);
  });
});

describe('TriStateToggleButton', () => {
  const pressIcon = async (screen: Awaited<ReturnType<typeof render>>) => {
    const icons = screen.container.queryAll((node) => node.type === 'Icon');
    expect(icons).toHaveLength(1);
    await fireEvent.press(icons[0]);
  };

  const backgroundOf = (screen: Awaited<ReturnType<typeof render>>) => {
    const icon = screen.container.queryAll((node) => node.type === 'Icon')[0];
    let node = icon.parent;
    while (node) {
      const background = StyleSheet.flatten(node.props.style)?.backgroundColor;
      if (background !== undefined) return background;
      node = node.parent;
    }
    return undefined;
  };

  it('cycles from any to true with the primary treatment', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <TriStateToggleButton label="Favorite" value={undefined} onChange={onChange} />,
    );

    expect(screen.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe(
      'square-outline',
    );
    expect(backgroundOf(screen)).toBe('#eeeeee');
    await pressIcon(screen);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('cycles from true to false with the error treatment', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <TriStateToggleButton label="Favorite" value onChange={onChange} />,
    );

    expect(screen.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe(
      'checkmark-circle',
    );
    expect(backgroundOf(screen)).toBe('#0000ff');
    await pressIcon(screen);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('cycles from false back to any', async () => {
    const onChange = jest.fn();
    const screen = await render(
      <TriStateToggleButton label="Favorite" value={false} onChange={onChange} />,
    );

    expect(screen.container.queryAll((node) => node.type === 'Icon')[0].props.name).toBe(
      'close-circle',
    );
    expect(backgroundOf(screen)).toBe('#ff0000');
    await pressIcon(screen);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
