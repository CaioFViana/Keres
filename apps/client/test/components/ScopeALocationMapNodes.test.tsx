import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import { LOCATION_MAP_NODE_SIZE } from '@keres/shared/graphs/locationMapLayout';
import React from 'react';
import { StyleSheet } from 'react-native';
import LocationMapImageView from '../../src/components/features/location-maps/LocationMapImageView';
import LocationMapNodeSheet from '../../src/components/features/location-maps/LocationMapNodeSheet';
import LocationMapNodeView from '../../src/components/features/location-maps/LocationMapNodeView';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Icons render as a host element that keeps their props, so assertions can read name/color.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('expo-image', () => ({
  Image: (props: Record<string, unknown>) => mockImage(props) ?? null,
}));

const mockImage = jest.fn();

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
      <RN.View testID={typeof children === 'string' ? children : 'mock-button'} onPress={onPress}>
        <RN.Text>{children}</RN.Text>
      </RN.View>
    ),
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: Record<string, unknown>) => (
      <RN.View testID="single-select-pill" {...props} />
    ),
    default: (props: Record<string, unknown>) => <RN.View testID="multi-select-pill" {...props} />,
  };
});

jest.mock('../../src/components/common/inputs/ColorPickerInput/ColorPickerInput', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const RN = jest.requireActual('react-native');
    return <RN.View testID="color-picker" {...props} />;
  },
}));

jest.mock('../../src/components/common/inputs/IconPickerInput/IconPickerInput', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const RN = jest.requireActual('react-native');
    return <RN.View testID="icon-picker" {...props} />;
  },
}));

/**
 * PanResponder derives its gestureState from the event's touch history (a second `dx`/`dy`
 * argument would simply be ignored), so the fakes below carry a single touch's positions and
 * let the real centroid math accumulate the deltas.
 */
let touchClock = 0;
const touchHistoryAt = (x: number, y: number, px: number, py: number) => {
  touchClock += 16;
  return {
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: touchClock,
    touchBank: [
      {
        touchActive: true,
        startPageX: x,
        startPageY: y,
        startTimeStamp: touchClock,
        currentPageX: x,
        currentPageY: y,
        currentTimeStamp: touchClock,
        previousPageX: px,
        previousPageY: py,
        previousTimeStamp: touchClock - 16,
      },
    ],
  };
};
const grantEvent = (x = 200, y = 200) => ({
  nativeEvent: {},
  currentTarget: {},
  touchHistory: touchHistoryAt(x, y, x, y),
});
const dragFrom = (x: number, y: number) => {
  let px = x;
  let py = y;
  return {
    grant: () => grantEvent(x, y),
    moveTo: (nx: number, ny: number) => {
      const event = { nativeEvent: {}, touchHistory: touchHistoryAt(nx, ny, px, py) };
      px = nx;
      py = ny;
      return event;
    },
    release: () => grantEvent(px, py),
  };
};

function responderOf(view: RenderResult, label?: string) {
  const responders = view.container.queryAll(
    (node) => typeof node.props?.onStartShouldSetResponder === 'function',
  );
  if (!label) return responders[0].props;
  const found = responders.find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`no responder labeled "${label}"`);
  return found.props;
}

function circleStyleOf(view: RenderResult) {
  const circles = view.container.queryAll((node: any) => {
    const style = node.props?.style;
    if (style == null || typeof style !== 'object') return false;
    const flat = StyleSheet.flatten(style) as { borderRadius?: number } | null;
    return flat?.borderRadius === LOCATION_MAP_NODE_SIZE / 2;
  });
  return StyleSheet.flatten(circles[0].props.style) as Record<string, unknown>;
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

describe('LocationMapNodeView', () => {
  const node = { id: 'point-1', x: 100, y: 80, icon: 'flag', color: '#f00', zIndex: 2 };
  const handlers = () => ({
    onSelect: jest.fn(),
    onMove: jest.fn(),
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
    onBringToFront: jest.fn(),
    onSendToBack: jest.fn(),
    onOpenDestination: jest.fn(),
    onConnectionStart: jest.fn(),
    onConnectionMove: jest.fn(),
    onConnectionEnd: jest.fn(),
    onConnectionCancel: jest.fn(),
  });
  const baseProps = { node, name: 'Harbor', selected: false, layoutEditing: false, scale: 1 };

  it('draws the point with its icon and name', async () => {
    const view = await render(<LocationMapNodeView {...baseProps} {...handlers()} />);

    expect(view.getByText('Harbor')).toBeTruthy();
    const [icon] = view.container.queryAll((node: any) => node.type === Ionicons);
    expect(icon.props).toMatchObject({ name: 'flag', color: '#f00' });
    expect(circleStyleOf(view)).toMatchObject({ borderWidth: 1.5, borderColor: '#f00' });
  });

  it('rings the selected point and badges linked maps', async () => {
    const view = await render(
      <LocationMapNodeView
        {...baseProps}
        node={{ ...node, destinationMapId: 'map-2' }}
        selected
        {...handlers()}
      />,
    );

    expect(circleStyleOf(view)).toMatchObject({ borderWidth: 2.5, borderColor: '#00f' });
    const icons = view.container.queryAll((node: any) => node.type === Ionicons);
    expect(icons.some((icon) => icon.props.name === 'open-outline')).toBe(true);
  });

  it('exposes layer controls while layout editing', async () => {
    const hooks = handlers();
    const view = await render(
      <LocationMapNodeView {...baseProps} selected layoutEditing {...hooks} />,
    );

    await fireEvent.press(view.getByLabelText('Send location point to back'));
    expect(hooks.onSendToBack).toHaveBeenCalledWith('point-1');
    await fireEvent.press(view.getByLabelText('Bring location point to front'));
    expect(hooks.onBringToFront).toHaveBeenCalledWith('point-1');
  });

  it('selects on tap and drags with zoom compensation', async () => {
    const hooks = handlers();
    const view = await render(<LocationMapNodeView {...baseProps} scale={2} {...hooks} />);

    const root = responderOf(view);
    const tap = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(tap.grant());
      root.onResponderRelease(tap.release());
    });
    expect(hooks.onSelect).toHaveBeenCalledWith('point-1');

    hooks.onSelect.mockClear();
    const drag = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(drag.grant());
      root.onResponderMove(drag.moveTo(210, 200));
      root.onResponderRelease(drag.release());
    });
    expect(hooks.onMove).toHaveBeenCalledWith('point-1', 105, 80);
    expect(hooks.onSelect).not.toHaveBeenCalled();
  });

  it('opens the destination on a long hold, not on a tap', async () => {
    const hooks = handlers();
    const view = await render(
      <LocationMapNodeView
        {...baseProps}
        node={{ ...node, destinationMapId: 'map-2' }}
        {...hooks}
      />,
    );

    const now = jest.spyOn(Date, 'now');
    try {
      const root = responderOf(view);
      now.mockReturnValue(1000);
      await act(async () => {
        root.onResponderGrant(grantEvent());
      });
      now.mockReturnValue(1400);
      await act(async () => {
        root.onResponderRelease(grantEvent());
      });
      expect(hooks.onSelect).toHaveBeenCalledWith('point-1');
      expect(hooks.onOpenDestination).not.toHaveBeenCalled();

      now.mockReturnValue(2000);
      await act(async () => {
        root.onResponderGrant(grantEvent());
      });
      now.mockReturnValue(2600);
      await act(async () => {
        root.onResponderRelease(grantEvent());
      });
      expect(hooks.onOpenDestination).toHaveBeenCalledWith('point-1');
    } finally {
      now.mockRestore();
    }
  });

  it('hints the hold action while the press lingers', async () => {
    const view = await render(
      <LocationMapNodeView
        {...baseProps}
        node={{ ...node, destinationMapId: 'map-2' }}
        {...handlers()}
      />,
    );

    jest.useFakeTimers();
    const root = responderOf(view);
    await act(async () => {
      root.onResponderGrant(grantEvent());
    });
    expect(view.queryByTestId('location-map-destination-hold-hint-point-1')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(view.getByTestId('location-map-destination-hold-hint-point-1')).toBeTruthy();

    await act(async () => {
      root.onResponderRelease(grantEvent());
    });
    expect(view.queryByTestId('location-map-destination-hold-hint-point-1')).toBeNull();
  });

  it('streams connection gestures in connection mode', async () => {
    const hooks = handlers();
    const view = await render(
      <LocationMapNodeView {...baseProps} connectionMode scale={2} {...hooks} />,
    );

    const root = responderOf(view);
    const drag = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(drag.grant());
      root.onResponderMove(drag.moveTo(208, 204));
      root.onResponderRelease(drag.release());
    });
    expect(hooks.onConnectionStart).toHaveBeenCalledWith('point-1');
    expect(hooks.onConnectionMove).toHaveBeenCalledWith('point-1', 4, 2);
    expect(hooks.onConnectionEnd).toHaveBeenCalledWith('point-1', 4, 2);

    await act(async () => {
      root.onResponderTerminate(drag.release());
    });
    expect(hooks.onConnectionCancel).toHaveBeenCalledTimes(1);
  });
});

describe('LocationMapImageView', () => {
  const image = {
    id: 'image-1',
    galleryId: 'gallery-1',
    x: 5,
    y: 6,
    width: 200,
    height: 100,
    locked: false,
  };
  const handlers = () => ({
    onSelect: jest.fn(),
    onMove: jest.fn(),
    onResize: jest.fn(),
    onDragStart: jest.fn(),
    onDragEnd: jest.fn(),
    onBringToFront: jest.fn(),
    onSendToBack: jest.fn(),
    onToggleLock: jest.fn(),
    onRemove: jest.fn(),
  });
  const baseProps = {
    image,
    uri: 'file:///base.png',
    selected: false,
    layoutEditing: false,
    scale: 1,
    locked: false,
  };

  it('paints the base image when resolved', async () => {
    const view = await render(<LocationMapImageView {...baseProps} {...handlers()} />);

    expect(mockImage).toHaveBeenCalledWith(
      expect.objectContaining({ source: { uri: 'file:///base.png' } }),
    );
    expect(
      view.container.queryAll(
        (node: any) => typeof node.props?.onStartShouldSetResponder === 'function',
      ),
    ).toHaveLength(1);
  });

  it('renders an empty frame without a uri', async () => {
    await render(<LocationMapImageView {...baseProps} uri={null} {...handlers()} />);

    expect(mockImage).not.toHaveBeenCalled();
  });

  it('exposes image actions while layout editing', async () => {
    const hooks = handlers();
    const view = await render(
      <LocationMapImageView {...baseProps} selected layoutEditing {...hooks} />,
    );

    await fireEvent.press(view.getByLabelText('Send map image to back'));
    expect(hooks.onSendToBack).toHaveBeenCalledWith('image-1');
    await fireEvent.press(view.getByLabelText('Bring map image to front'));
    expect(hooks.onBringToFront).toHaveBeenCalledWith('image-1');
    await fireEvent.press(view.getByLabelText('Toggle map image lock'));
    expect(hooks.onToggleLock).toHaveBeenCalledWith('image-1');
    await fireEvent.press(view.getByLabelText('Remove map image'));
    expect(hooks.onRemove).toHaveBeenCalledWith('image-1');
  });

  it('resizes keeping the aspect ratio', async () => {
    const hooks = handlers();
    const view = await render(
      <LocationMapImageView {...baseProps} selected layoutEditing scale={2} {...hooks} />,
    );

    const resize = responderOf(view, 'Resize map image');
    const drag = dragFrom(200, 200);
    await act(async () => {
      resize.onResponderGrant(drag.grant());
      resize.onResponderMove(drag.moveTo(240, 200));
      resize.onResponderRelease(drag.release());
    });
    // +20 points wide at 2x zoom, height following the 2:1 ratio (with float dust).
    expect(hooks.onResize).toHaveBeenCalledWith('image-1', 220, expect.closeTo(110, 10));
    expect(hooks.onDragEnd).toHaveBeenCalledWith('image-1');
  });

  it('selects on tap and never moves while locked', async () => {
    const hooks = handlers();
    const view = await render(<LocationMapImageView {...baseProps} locked {...hooks} />);

    const root = responderOf(view);
    expect(root.onStartShouldSetResponder()).toBe(true);
    expect(root.onResponderTerminationRequest()).toBe(true);
    expect(hooks.onDragStart).not.toHaveBeenCalled();

    const lockedDrag = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(lockedDrag.grant());
      root.onResponderMove(lockedDrag.moveTo(250, 250));
      root.onResponderRelease(lockedDrag.release());
    });
    expect(hooks.onMove).not.toHaveBeenCalled();
    expect(hooks.onDragEnd).not.toHaveBeenCalled();
    expect(hooks.onSelect).toHaveBeenCalledWith('image-1');
  });

  it('drags unlocked images and yields termination only when locked', async () => {
    const hooks = handlers();
    const view = await render(<LocationMapImageView {...baseProps} {...hooks} />);

    const root = responderOf(view);
    expect(root.onResponderTerminationRequest()).toBe(false);

    const drag = dragFrom(200, 200);
    await act(async () => {
      root.onResponderGrant(drag.grant());
      root.onResponderMove(drag.moveTo(212, 208));
      root.onResponderRelease(drag.release());
    });
    expect(hooks.onMove).toHaveBeenCalledWith('image-1', 17, 14);
    expect(hooks.onDragEnd).toHaveBeenCalledWith('image-1');
    expect(hooks.onSelect).not.toHaveBeenCalled();
  });
});

describe('LocationMapNodeSheet', () => {
  const baseProps = {
    name: 'Harbor',
    icon: 'flag',
    color: '#f00',
    parent: null,
    childLocations: [],
    connections: [],
    parentCandidates: [{ id: 'loc-9', name: 'Region' }],
    childCandidates: [{ id: 'loc-3', name: 'Dock' }],
    connectCandidates: [{ id: 'loc-4', name: 'Market' }],
    canEdit: true,
    destinationUnavailable: false,
    destinationOptions: [{ label: 'Cellar', value: 'map-2' }],
    onChangeIcon: jest.fn(),
    onChangeColor: jest.fn(),
    onSetParent: jest.fn(),
    onRemoveParent: jest.fn(),
    onAddChild: jest.fn(),
    onRemoveRelation: jest.fn(),
    onAddConnection: jest.fn(),
    onRemoveConnection: jest.fn(),
    onRemoveNode: jest.fn(),
    onChangeDestination: jest.fn(),
    onCreateDestination: jest.fn(),
    onOpenDestination: jest.fn(),
    onOpenLocation: jest.fn(),
    onClose: jest.fn(),
  };

  const pillByPlaceholder = (view: RenderResult, placeholder: string) =>
    view.getAllByTestId('multi-select-pill').find((pill) => pill.props.placeholder === placeholder);

  it('opens the location and closes', async () => {
    const onOpenLocation = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <LocationMapNodeSheet {...baseProps} onOpenLocation={onOpenLocation} onClose={onClose} />,
    );

    expect(view.getByText('Harbor')).toBeTruthy();
    await fireEvent.press(view.getByText('location_map_open_location'));
    expect(onOpenLocation).toHaveBeenCalledTimes(1);
    await fireEvent.press(view.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the summary or its absence', async () => {
    const full = await render(
      <LocationMapNodeSheet {...baseProps} summary={{ title: 'Harbor', details: 'A busy port' }} />,
    );
    expect(full.getByText('A busy port')).toBeTruthy();

    const empty = await render(
      <LocationMapNodeSheet {...baseProps} summary={{ title: 'Harbor', details: null }} />,
    );
    expect(empty.getByText('common_na')).toBeTruthy();

    const missing = await render(<LocationMapNodeSheet {...baseProps} />);
    expect(missing.queryByText('location_map_location_summary')).toBeNull();
  });

  it('edits the icon and color when editable', async () => {
    const onChangeIcon = jest.fn();
    const onChangeColor = jest.fn();
    const view = await render(
      <LocationMapNodeSheet
        {...baseProps}
        onChangeIcon={onChangeIcon}
        onChangeColor={onChangeColor}
      />,
    );

    expect(view.getByTestId('icon-picker').props.currentIcon).toBe('flag');
    await act(async () => {
      view.getByTestId('icon-picker').props.onSelectIcon('anchor');
      view.getByTestId('color-picker').props.onSelectColor('#0f0');
    });
    expect(onChangeIcon).toHaveBeenCalledWith('anchor');
    expect(onChangeColor).toHaveBeenCalledWith('#0f0');

    const locked = await render(<LocationMapNodeSheet {...baseProps} canEdit={false} />);
    expect(locked.queryByTestId('icon-picker')).toBeNull();
    expect(locked.queryByTestId('color-picker')).toBeNull();
  });

  it('manages the destination link', async () => {
    const onChangeDestination = jest.fn();
    const view = await render(
      <LocationMapNodeSheet
        {...baseProps}
        destinationMapId="map-2"
        onChangeDestination={onChangeDestination}
        onOpenDestination={jest.fn()}
      />,
    );

    const [destination] = view.getAllByTestId('single-select-pill');
    expect(destination.props.value).toBe('map-2');
    await act(async () => {
      destination.props.onValueChange('');
    });
    expect(onChangeDestination).toHaveBeenCalledWith(null);

    await act(async () => {
      view.getByTestId('location_map_open_destination').props.onPress();
    });
  });

  it('creates a destination when none is linked', async () => {
    const onCreateDestination = jest.fn();
    const view = await render(
      <LocationMapNodeSheet {...baseProps} onCreateDestination={onCreateDestination} />,
    );

    await act(async () => {
      view.getByTestId('location_map_create_destination').props.onPress();
    });
    expect(onCreateDestination).toHaveBeenCalledTimes(1);

    const locked = await render(<LocationMapNodeSheet {...baseProps} canEdit={false} />);
    expect(locked.getByText('location_map_destination_none')).toBeTruthy();
  });

  it('flags an unavailable destination', async () => {
    const view = await render(
      <LocationMapNodeSheet {...baseProps} destinationMapId="map-2" destinationUnavailable />,
    );

    expect(view.getByText('location_map_destination_unavailable')).toBeTruthy();
    expect(view.queryByTestId('location_map_open_destination')).toBeNull();
  });

  it('manages the parent relation', async () => {
    const onRemoveParent = jest.fn();
    const onSetParent = jest.fn();
    const view = await render(
      <LocationMapNodeSheet
        {...baseProps}
        parent={{ relationId: 'rel-1', locationId: 'loc-9', name: 'Region' }}
        onRemoveParent={onRemoveParent}
        onSetParent={onSetParent}
      />,
    );

    expect(view.getByText('Region')).toBeTruthy();
    await fireEvent.press(view.getAllByLabelText('delete')[0]);
    expect(onRemoveParent).toHaveBeenCalledTimes(1);

    await act(async () => {
      pillByPlaceholder(view, 'set_parent')?.props.onSelectionChange(['loc-9']);
    });
    expect(onSetParent).toHaveBeenCalledWith('loc-9');

    await act(async () => {
      pillByPlaceholder(view, 'set_parent')?.props.onSelectionChange([]);
    });
    expect(onSetParent).toHaveBeenCalledTimes(1);
  });

  it('shows the no-parent copy without one', async () => {
    const view = await render(<LocationMapNodeSheet {...baseProps} parentCandidates={[]} />);

    expect(view.getByText('no_parent_location')).toBeTruthy();
    expect(pillByPlaceholder(view, 'set_parent')).toBeUndefined();
  });

  it('manages children and connections', async () => {
    const onRemoveRelation = jest.fn();
    const onAddChild = jest.fn();
    const onRemoveConnection = jest.fn();
    const onAddConnection = jest.fn();
    const view = await render(
      <LocationMapNodeSheet
        {...baseProps}
        childLocations={[{ relationId: 'rel-2', locationId: 'loc-3', name: 'Dock' }]}
        connections={[{ relationId: 'rel-3', otherLocationId: 'loc-4', otherName: 'Market' }]}
        onRemoveRelation={onRemoveRelation}
        onAddChild={onAddChild}
        onRemoveConnection={onRemoveConnection}
        onAddConnection={onAddConnection}
      />,
    );

    expect(view.getByText('Dock')).toBeTruthy();
    expect(view.getByText('Market')).toBeTruthy();
    const [removeChild, removeConnection] = view.getAllByLabelText('delete');
    await fireEvent.press(removeChild);
    expect(onRemoveRelation).toHaveBeenCalledWith('rel-2');
    await fireEvent.press(removeConnection);
    expect(onRemoveConnection).toHaveBeenCalledWith('rel-3');

    await act(async () => {
      pillByPlaceholder(view, 'add_child_location')?.props.onSelectionChange(['loc-3']);
      pillByPlaceholder(view, 'add_connection')?.props.onSelectionChange(['loc-4']);
    });
    expect(onAddChild).toHaveBeenCalledWith('loc-3');
    expect(onAddConnection).toHaveBeenCalledWith('loc-4');
  });

  it('shows empty relation copies', async () => {
    const view = await render(
      <LocationMapNodeSheet
        {...baseProps}
        childCandidates={[]}
        connectCandidates={[]}
        parentCandidates={[]}
      />,
    );

    expect(view.getByText('no_parent_location')).toBeTruthy();
    expect(view.getByText('no_child_locations')).toBeTruthy();
    expect(view.getByText('no_connected_locations')).toBeTruthy();
  });

  it('removes the point only when editable', async () => {
    const onRemoveNode = jest.fn();
    const view = await render(<LocationMapNodeSheet {...baseProps} onRemoveNode={onRemoveNode} />);

    await act(async () => {
      view.getByTestId('location_map_remove_node').props.onPress();
    });
    expect(onRemoveNode).toHaveBeenCalledTimes(1);

    const locked = await render(<LocationMapNodeSheet {...baseProps} canEdit={false} />);
    expect(locked.queryByTestId('location_map_remove_node')).toBeNull();
    expect(locked.queryByLabelText('delete')).toBeNull();
  });
});
