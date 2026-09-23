import { act, fireEvent, render } from '@testing-library/react-native';
import type { LocationMapContentType } from '@keres/shared';
import React from 'react';
import LocationMapConnectionModal from '../../src/components/features/location-maps/LocationMapConnectionModal';
import LocationMapMarkerConnectionModal from '../../src/components/features/location-maps/LocationMapMarkerConnectionModal';
import LocationMapTools from '../../src/components/features/location-maps/LocationMapTools';

if (!(global as any).requestAnimationFrame) {
  (global as any).requestAnimationFrame = (cb: () => void) => {
    cb();
    return 0;
  };
}

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
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
    default: ({
      options,
      selectedValues,
      onSelectionChange,
      placeholder,
      noOptionsText,
      searchPlaceholder,
    }: {
      options: { label: string; value: string }[];
      selectedValues: string[];
      onSelectionChange: (values: string[]) => void;
      placeholder?: string;
      noOptionsText?: string;
      searchPlaceholder?: string;
    }) => (
      <RN.View
        testID="multi-select-pill"
        options={options}
        selectedValues={selectedValues}
        onSelectionChange={onSelectionChange}
        placeholder={placeholder}
        noOptionsText={noOptionsText}
        searchPlaceholder={searchPlaceholder}
      />
    ),
  };
});

const mockGraphConnectionModal = jest.fn();
jest.mock('../../src/components/features/graphs/GraphConnectionModal/GraphConnectionModal', () => {
  const RN = jest.requireActual('react-native');
  return function MockGraphConnectionModal(props: Record<string, unknown>) {
    mockGraphConnectionModal(props);
    return <RN.View testID="graph-connection-modal" />;
  };
});

interface ConnectionChoice {
  directed: boolean;
  direction: 'forward' | 'reverse';
  label: string | null;
}

const lastModalProps = () =>
  mockGraphConnectionModal.mock.calls[mockGraphConnectionModal.mock.calls.length - 1][0] as {
    sourceName: string;
    targetName: string;
    labelEnabled: boolean;
    directionHint?: string;
    onClose: () => void;
    onConfirm: (choice: ConnectionChoice) => void;
  };

beforeEach(() => jest.clearAllMocks());

describe('LocationMapTools', () => {
  const imageOptions = [{ label: 'Atlas', value: 'gallery-1' }];
  const locationOptions = [{ label: 'Harbor', value: 'loc-1' }];

  it('wires the image, location and marker pickers', async () => {
    const onAddImages = jest.fn();
    const onAddLocations = jest.fn();
    const onAddMarker = jest.fn();
    const onObjectsAction = jest.fn();
    const view = await render(
      <LocationMapTools
        imageOptions={imageOptions}
        locationOptions={locationOptions}
        onAddImages={onAddImages}
        onAddLocations={onAddLocations}
        onAddMarker={onAddMarker}
        onObjectsAction={onObjectsAction}
        drawTool={null}
        canFinish={false}
        onFinishDraw={jest.fn()}
        onCancelDraw={jest.fn()}
        selectMode={false}
        onDoneSelect={jest.fn()}
      />,
    );

    const pills = view.getAllByTestId('multi-select-pill');
    expect(pills).toHaveLength(3);
    const [images, locations, objects] = pills;
    expect(images.props).toMatchObject({
      options: imageOptions,
      selectedValues: [],
      placeholder: 'location_map_add_images',
      noOptionsText: 'location_map_no_images',
      searchPlaceholder: 'search',
    });
    expect(locations.props).toMatchObject({
      options: locationOptions,
      placeholder: 'location_map_add_locations',
      noOptionsText: 'location_map_no_locations',
    });

    await act(async () => {
      images.props.onSelectionChange(['gallery-1']);
      locations.props.onSelectionChange(['loc-1']);
    });
    await fireEvent.press(view.getByTestId('action-add-marker'));
    expect(onAddImages).toHaveBeenCalledWith(['gallery-1']);
    expect(onAddLocations).toHaveBeenCalledWith(['loc-1']);
    expect(onAddMarker).toHaveBeenCalledTimes(1);

    // The third pill is the objects picker (groups mode); actions route through.
    expect(objects.props.placeholder).toBe('objects_add');
    await act(async () => {
      objects.props.onSelectionChange(['draw:line']);
    });
    expect(onObjectsAction).toHaveBeenCalledWith('draw:line');

    // The edit button arms the select tool directly.
    await fireEvent.press(view.getByTestId('action-edit-overlays'));
    expect(onObjectsAction).toHaveBeenCalledWith('select');
  });

  it('swaps the pickers for the draw bar while a tool is armed', async () => {
    const onFinishDraw = jest.fn();
    const onCancelDraw = jest.fn();
    const view = await render(
      <LocationMapTools
        imageOptions={imageOptions}
        locationOptions={locationOptions}
        onAddImages={jest.fn()}
        onAddLocations={jest.fn()}
        onAddMarker={jest.fn()}
        onObjectsAction={jest.fn()}
        drawTool="polygon"
        canFinish
        onFinishDraw={onFinishDraw}
        onCancelDraw={onCancelDraw}
        selectMode={false}
        onDoneSelect={jest.fn()}
      />,
    );

    expect(view.queryAllByTestId('multi-select-pill')).toHaveLength(0);
    expect(view.getByText('overlay_draw_polygon_hint')).toBeTruthy();
    await act(async () => {
      view.getByTestId('overlay_draw_finish').props.onPress();
      view.getByTestId('overlay_draw_cancel').props.onPress();
    });
    expect(onFinishDraw).toHaveBeenCalledTimes(1);
    expect(onCancelDraw).toHaveBeenCalledTimes(1);
  });

  it('swaps the pickers for the select bar while selecting', async () => {
    const onDoneSelect = jest.fn();
    const view = await render(
      <LocationMapTools
        imageOptions={imageOptions}
        locationOptions={locationOptions}
        onAddImages={jest.fn()}
        onAddLocations={jest.fn()}
        onAddMarker={jest.fn()}
        onObjectsAction={jest.fn()}
        drawTool={null}
        canFinish={false}
        onFinishDraw={jest.fn()}
        onCancelDraw={jest.fn()}
        selectMode
        onDoneSelect={onDoneSelect}
      />,
    );

    expect(view.queryAllByTestId('multi-select-pill')).toHaveLength(0);
    expect(view.getByText('overlay_select_hint')).toBeTruthy();
    await act(async () => {
      view.getByTestId('overlay_select_done').props.onPress();
    });
    expect(onDoneSelect).toHaveBeenCalledTimes(1);
  });
});

describe('LocationMapConnectionModal', () => {
  const content = (): LocationMapContentType =>
    ({ images: [], nodes: [], relationTexts: [] }) as unknown as LocationMapContentType;

  it('resolves node names with id fallbacks', async () => {
    await render(
      <LocationMapConnectionModal
        pair={{ from: 'a', to: 'missing' }}
        nodeNames={{ a: 'Alpha' }}
        setContent={jest.fn()}
        onConnect={jest.fn()}
        onSetParent={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(lastModalProps()).toMatchObject({
      sourceName: 'Alpha',
      targetName: 'missing',
      labelEnabled: true,
      directionHint: 'location_map_connection_direction_hint',
    });
  });

  it('connects undirected pairs and stores their label', async () => {
    let current = content();
    const setContent = jest.fn((update: React.SetStateAction<LocationMapContentType>) => {
      current =
        typeof update === 'function'
          ? (update as (value: LocationMapContentType) => LocationMapContentType)(current)
          : update;
    });
    const onConnect = jest.fn();
    const onSetParent = jest.fn();
    const onClose = jest.fn();
    await render(
      <LocationMapConnectionModal
        pair={{ from: 'a', to: 'b' }}
        nodeNames={{ a: 'Alpha', b: 'Beta' }}
        setContent={setContent}
        onConnect={onConnect}
        onSetParent={onSetParent}
        onClose={onClose}
      />,
    );

    await act(async () => {
      lastModalProps().onConfirm({ directed: false, direction: 'forward', label: 'road' });
    });

    expect(onConnect).toHaveBeenCalledWith('a', 'b');
    expect(onSetParent).not.toHaveBeenCalled();
    expect(current.relationTexts).toEqual([
      { sourceLocationId: 'a', destinationLocationId: 'b', text: 'road' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('turns directed links into contains relations', async () => {
    let current = content();
    const setContent = jest.fn((update: React.SetStateAction<LocationMapContentType>) => {
      current =
        typeof update === 'function'
          ? (update as (value: LocationMapContentType) => LocationMapContentType)(current)
          : update;
    });
    const onConnect = jest.fn();
    const onSetParent = jest.fn();
    await render(
      <LocationMapConnectionModal
        pair={{ from: 'a', to: 'b' }}
        nodeNames={{}}
        setContent={setContent}
        onConnect={onConnect}
        onSetParent={onSetParent}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      lastModalProps().onConfirm({ directed: true, direction: 'forward', label: null });
    });
    expect(onSetParent).toHaveBeenCalledWith('b', 'a');
    expect(onConnect).not.toHaveBeenCalled();
    expect(current.relationTexts).toEqual([]);

    await act(async () => {
      lastModalProps().onConfirm({ directed: true, direction: 'reverse', label: 'covers' });
    });
    expect(onSetParent).toHaveBeenCalledWith('a', 'b');
    expect(current.relationTexts).toEqual([
      { sourceLocationId: 'b', destinationLocationId: 'a', text: 'covers' },
    ]);
  });
});

describe('LocationMapMarkerConnectionModal', () => {
  const content = (): LocationMapContentType =>
    ({
      images: [],
      nodes: [
        { id: 'node-1', locationId: 'loc-1', labelAtPin: null },
        { id: 'node-2', locationId: 'loc-2', labelAtPin: 'Gate' },
      ],
      markers: [{ id: 'marker-1', title: 'Camp' }],
      markerConnections: [],
    }) as unknown as LocationMapContentType;

  it('names endpoints through pins, locations and markers', async () => {
    await render(
      <LocationMapMarkerConnectionModal
        pair={{ from: 'node-1', to: 'marker-1' }}
        content={content()}
        locationNames={{ 'loc-1': 'Harbor' }}
        setContent={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(lastModalProps()).toMatchObject({
      sourceName: 'Harbor',
      targetName: 'Camp',
      labelEnabled: true,
    });
  });

  it('prefers the pin label and falls back to the id', async () => {
    await render(
      <LocationMapMarkerConnectionModal
        pair={{ from: 'node-2', to: 'ghost' }}
        content={content()}
        locationNames={{}}
        setContent={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(lastModalProps()).toMatchObject({ sourceName: 'Gate', targetName: 'ghost' });
  });

  it('saves the marker link inside the map and closes', async () => {
    let current = content();
    const setContent = jest.fn((update: React.SetStateAction<LocationMapContentType>) => {
      current =
        typeof update === 'function'
          ? (update as (value: LocationMapContentType) => LocationMapContentType)(current)
          : update;
    });
    const onClose = jest.fn();
    await render(
      <LocationMapMarkerConnectionModal
        pair={{ from: 'node-1', to: 'marker-1' }}
        content={content()}
        locationNames={{}}
        setContent={setContent}
        onClose={onClose}
      />,
    );

    await act(async () => {
      lastModalProps().onConfirm({ directed: true, direction: 'reverse', label: 'trail' });
    });

    expect(current.markerConnections).toHaveLength(1);
    expect(current.markerConnections?.[0]).toMatchObject({
      fromId: 'marker-1',
      toId: 'node-1',
      directed: true,
      label: 'trail',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
