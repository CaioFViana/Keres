import { render } from '@testing-library/react-native';
import LocationMapImageView from '../../src/components/features/location-maps/LocationMapImageView';
import LocationMapNodeView from '../../src/components/features/location-maps/LocationMapNodeView';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({ colors: { primary: '#85f', surface: '#111', text: '#fff' } }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});

function responderOf(view: { container: unknown }, label?: string) {
  const root = view.container as {
    queryAll: (predicate: (node: any) => boolean) => any[];
  };
  const responders = root.queryAll(
    (node) => typeof node.props?.onStartShouldSetResponder === 'function',
  );
  if (!label) return responders[0].props;
  const found = responders.find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`no responder labeled "${label}"`);
  return found.props;
}

const noop = () => undefined;

describe('overlay editing suppression', () => {
  it('makes map points ignore taps and drags', async () => {
    const props = {
      node: { id: 'n-1', x: 10, y: 20, icon: 'pin', color: '#f00' },
      name: 'Harbor',
      selected: false,
      layoutEditing: false,
      scale: 1,
      onSelect: noop,
      onMove: noop,
      onDragStart: noop,
      onDragEnd: noop,
      onBringToFront: noop,
      onSendToBack: noop,
    } as any;
    const suppressed = await render(<LocationMapNodeView {...props} overlayEditing />);
    const responder = responderOf(suppressed);
    expect(responder.onStartShouldSetResponder()).toBe(false);
    expect(responder.onMoveShouldSetResponder({}, { dx: 50, dy: 0 })).toBe(false);

    const live = await render(<LocationMapNodeView {...props} />);
    expect(responderOf(live).onStartShouldSetResponder()).toBe(true);
  });

  it('makes image bases ignore taps and drags', async () => {
    const props = {
      image: { id: 'img-1', x: 0, y: 0, width: 100, height: 80 },
      uri: null,
      selected: false,
      layoutEditing: false,
      scale: 1,
      locked: false,
      onSelect: noop,
      onMove: noop,
      onResize: noop,
      onDragStart: noop,
      onDragEnd: noop,
      onBringToFront: noop,
      onSendToBack: noop,
      onToggleLock: noop,
      onRemove: noop,
    } as any;
    const suppressed = await render(<LocationMapImageView {...props} overlayEditing />);
    const responder = responderOf(suppressed);
    expect(responder.onStartShouldSetResponder()).toBe(false);
    expect(responder.onMoveShouldSetResponder({}, { dx: 50, dy: 0 })).toBe(false);

    const live = await render(<LocationMapImageView {...props} />);
    expect(responderOf(live).onStartShouldSetResponder()).toBe(true);
  });
});
