import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import CanvasLine from '../../src/components/features/graphs/CanvasLine/CanvasLine';
import GraphCanvasControls from '../../src/components/features/graphs/GraphCanvasControls/GraphCanvasControls';
import GraphConnectionModal from '../../src/components/features/graphs/GraphConnectionModal/GraphConnectionModal';
import GraphNodeSheet from '../../src/components/features/graphs/GraphNodeSheet/GraphNodeSheet';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#aaf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <RN.View
        testID={typeof children === 'string' ? children : 'mock-button'}
        onPress={onPress}
        disabled={disabled}
      >
        <RN.Text>{children}</RN.Text>
      </RN.View>
    ),
  };
});

jest.mock('../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      value,
      onValueChange,
    }: {
      value: boolean;
      onValueChange: (next: boolean) => void;
    }) => <RN.View testID="themed-switch" value={value} onValueChange={onValueChange} />,
  };
});

/** The direction rows carry no accessibility labels, so press through their text. */
async function pressText(view: RenderResult, text: string) {
  await fireEvent.press(view.getByText(text));
}

function hostViews(view: RenderResult) {
  return view.container.queryAll((node: any) => node.type === 'View');
}

beforeEach(() => jest.clearAllMocks());

describe('CanvasLine', () => {
  it('draws a solid horizontal line', async () => {
    const view = await render(
      <CanvasLine left={10} top={20} length={100} thickness={4} color="#f00" />,
    );

    const [line] = hostViews(view);
    expect(line.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(line.props.style)).toMatchObject({
      left: 10,
      top: 20,
      width: 100,
      height: 4,
      backgroundColor: '#f00',
    });
  });

  it('draws a solid vertical line and clamps negative lengths', async () => {
    const view = await render(
      <CanvasLine left={0} top={0} length={-5} thickness={2} color="#0f0" vertical opacity={0.5} />,
    );

    const [line] = hostViews(view);
    expect(StyleSheet.flatten(line.props.style)).toMatchObject({
      width: 2,
      height: 0,
      opacity: 0.5,
    });
  });

  it('dashes long lines up to the ceiling', async () => {
    const short = await render(
      <CanvasLine left={0} top={0} length={90} thickness={2} color="#00f" dashed />,
    );
    // 90 points at a 5/4 rhythm: ten dashes.
    expect(hostViews(short)).toHaveLength(11);

    const long = await render(
      <CanvasLine left={0} top={0} length={100000} thickness={2} color="#00f" dashed vertical />,
    );
    // The frame plus the capped dashes.
    expect(hostViews(long)).toHaveLength(81);
  });
});

describe('GraphCanvasControls', () => {
  it('wires zoom, fit and export', async () => {
    const handlers = {
      onZoomIn: jest.fn(),
      onZoomOut: jest.fn(),
      onFit: jest.fn(),
      onExport: jest.fn(),
    };
    const view = await render(<GraphCanvasControls {...handlers} />);

    await fireEvent.press(view.getByLabelText('zoom_in'));
    await fireEvent.press(view.getByLabelText('zoom_out'));
    await fireEvent.press(view.getByLabelText('fit_to_screen'));
    await fireEvent.press(view.getByLabelText('story_map_export'));

    expect(handlers.onZoomIn).toHaveBeenCalledTimes(1);
    expect(handlers.onZoomOut).toHaveBeenCalledTimes(1);
    expect(handlers.onFit).toHaveBeenCalledTimes(1);
    expect(handlers.onExport).toHaveBeenCalledTimes(1);
  });

  it('hides export without a handler and spins while exporting', async () => {
    const plain = await render(
      <GraphCanvasControls onZoomIn={jest.fn()} onZoomOut={jest.fn()} onFit={jest.fn()} />,
    );
    expect(plain.queryByLabelText('story_map_export')).toBeNull();

    const busy = await render(
      <GraphCanvasControls
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onFit={jest.fn()}
        onExport={jest.fn()}
        exporting
        exportLabel="Save PNG"
      />,
    );
    expect(busy.getByLabelText('Save PNG').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(busy.container.queryAll((node: any) => node.type === 'ActivityIndicator')).toHaveLength(
      1,
    );
  });
});

describe('GraphNodeSheet', () => {
  const sections = [
    {
      title: 'Scenes',
      description: 'Linked scenes',
      items: [
        {
          id: 'scene-1',
          icon: 'film-outline',
          label: 'Arrival',
          detail: 'Ch.1',
          onPress: jest.fn(),
        },
        {
          id: 'scene-2',
          icon: 'film-outline',
          label: 'Ghost',
          extra: '2 checks',
          italicLabel: true,
          onPress: jest.fn(),
        },
      ],
    },
    { title: 'Notes', items: [], emptyMessage: 'Nothing here' },
  ] as React.ComponentProps<typeof GraphNodeSheet>['sections'];

  const baseProps = {
    title: 'Atlas',
    subtitle: { text: 'Region', color: '#123' },
    badges: [{ label: 'Canon', color: '#456' }],
    sections,
    actionLabel: 'Open details',
    onAction: jest.fn(),
    onClose: jest.fn(),
  };

  it('renders the header, badges and sections', async () => {
    const view = await render(<GraphNodeSheet {...baseProps} />);

    expect(view.getByText('Atlas')).toBeTruthy();
    expect(view.getByText('Region')).toBeTruthy();
    expect(view.getByText('Canon')).toBeTruthy();
    expect(view.getByText('Scenes')).toBeTruthy();
    expect(view.getByText('Linked scenes')).toBeTruthy();
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Ch.1')).toBeTruthy();
    expect(view.getByText('2 checks')).toBeTruthy();
    expect(view.getByText('Nothing here')).toBeTruthy();
    expect(view.getByText('Open details')).toBeTruthy();
  });

  it('wires item, action and close presses', async () => {
    const onAction = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <GraphNodeSheet {...baseProps} onAction={onAction} onClose={onClose} />,
    );

    await pressText(view, 'Arrival');
    expect(sections[0].items?.[0].onPress).toHaveBeenCalledTimes(1);
    await pressText(view, 'Open details');
    expect(onAction).toHaveBeenCalledTimes(1);
    await pressText(view, 'Ghost');
    expect(sections[0].items?.[1].onPress).toHaveBeenCalledTimes(1);
  });
});

describe('GraphConnectionModal', () => {
  const baseProps = {
    sourceName: 'Alpha',
    targetName: 'Beta',
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('confirms a directed forward link without a label', async () => {
    const onConfirm = jest.fn();
    const view = await render(<GraphConnectionModal {...baseProps} onConfirm={onConfirm} />);

    expect(view.getByText('graph_connection_title')).toBeTruthy();
    expect(view.getByText('graph_connection_description')).toBeTruthy();
    expect(view.getByTestId('themed-switch').props.value).toBe(true);

    await act(async () => {
      view.getByTestId('graph_connection_confirm').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith({ directed: true, direction: 'forward', label: null });
  });

  it('reverses the direction', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <GraphConnectionModal
        {...baseProps}
        directionHint="Contains runs downhill"
        onConfirm={onConfirm}
      />,
    );

    expect(view.getByText('Contains runs downhill')).toBeTruthy();
    await pressText(view, 'graph_connection_reverse');

    await act(async () => {
      view.getByTestId('graph_connection_confirm').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith({ directed: true, direction: 'reverse', label: null });
  });

  it('hides directions for an undirected link', async () => {
    const onConfirm = jest.fn();
    const view = await render(<GraphConnectionModal {...baseProps} onConfirm={onConfirm} />);

    await act(async () => {
      view.getByTestId('themed-switch').props.onValueChange(false);
    });

    expect(view.queryByText('graph_connection_forward')).toBeNull();
    await act(async () => {
      view.getByTestId('graph_connection_confirm').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith({ directed: false, direction: 'forward', label: null });
  });

  it('saves a trimmed label only when enabled', async () => {
    const onConfirm = jest.fn();
    const plain = await render(<GraphConnectionModal {...baseProps} onConfirm={onConfirm} />);
    expect(plain.queryByText('graph_connection_label')).toBeNull();

    const view = await render(
      <GraphConnectionModal {...baseProps} labelEnabled onConfirm={onConfirm} />,
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('graph_connection_label_placeholder'),
      '  leads to  ',
    );

    await act(async () => {
      view.getByTestId('graph_connection_confirm').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith({
      directed: true,
      direction: 'forward',
      label: 'leads to',
    });
  });

  it('clamps the label to the caller-provided limit', async () => {
    const view = await render(
      <GraphConnectionModal
        {...baseProps}
        labelEnabled
        labelMaxLength={500}
        onConfirm={jest.fn()}
      />,
    );

    expect(view.getByPlaceholderText('graph_connection_label_placeholder').props.maxLength).toBe(
      500,
    );
  });

  it('closes without confirming', async () => {
    const onClose = jest.fn();
    const view = await render(<GraphConnectionModal {...baseProps} onClose={onClose} />);

    await fireEvent.press(view.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => {
      view.getByTestId('mock-button').props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
