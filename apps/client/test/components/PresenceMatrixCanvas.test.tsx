import { act, render } from '@testing-library/react-native';
import { graphSeriesColor } from '@keres/shared';
import React from 'react';
import PresenceMatrixCanvas from '../../src/components/features/presence-matrix/PresenceMatrixCanvas';
import {
  MAX_VISIBLE_SERIES,
  seriesColor,
} from '../../src/components/features/presence-matrix/presenceMatrixConstants';
import {
  buildPresenceMatrixLayout,
  MATRIX_HEADER_HEIGHT,
  MATRIX_LABEL_WIDTH,
  MATRIX_PADDING,
  type PresenceMatrixLayout,
} from '@keres/shared/graphs/presenceMatrixLayout';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

const mockViewportOptions = { current: null as Record<string, any> | null };
jest.mock('../../src/hooks/useCanvasViewport', () => ({
  __esModule: true,
  useCanvasViewport: (_ref: unknown, _layout: unknown, options: Record<string, unknown>) => {
    mockViewportOptions.current = options as Record<string, any>;
    return {
      containerRef: { current: null },
      handleLayout: jest.fn(),
      panHandlers: {},
      animatedTransform: [],
      renderWindow: { x: -100000, y: -100000, width: 200000, height: 200000 },
    };
  },
}));

jest.mock('../../src/components/features/graphs/GraphCanvasFrame/GraphCanvasFrame', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, { testID: 'canvas-frame' }, children),
  };
});

jest.mock('../../src/components/features/graphs/CanvasLine/CanvasLine', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'canvas-line', ...props }),
  };
});

beforeEach(() => {
  mockViewportOptions.current = null;
});

const layoutOf = (): PresenceMatrixLayout =>
  buildPresenceMatrixLayout(
    [
      { id: 'sc-1', name: 'Scene 1', chapterName: 'Chapter One', chapterColor: '#111' },
      { id: 'sc-2', name: 'Scene 2', chapterName: 'Chapter One', chapterColor: '#111' },
    ],
    [
      { id: 'row-1', label: 'Alice', color: '#f00', cells: new Map([['sc-1', '✓']]) },
      { id: 'row-2', label: 'Bob', color: '#00f', cells: new Map([['sc-2', 'hurt']]) },
    ],
  );

describe('presenceMatrixConstants', () => {
  it('caps the visible series at twelve', () => {
    expect(MAX_VISIBLE_SERIES).toBe(12);
  });

  it('delegates the series palette to the shared graph colors', () => {
    expect(seriesColor(0, 3)).toBe(graphSeriesColor(0, 3));
    expect(seriesColor(2, 3)).toBe(graphSeriesColor(2, 3));
  });
});

describe('PresenceMatrixCanvas', () => {
  const baseProps = () => ({
    layout: layoutOf(),
    onPressScene: jest.fn(),
    onPressRow: jest.fn(),
    showRowCoverage: true,
  });

  it('numbers the scenes and groups the chapters', async () => {
    const screen = await render(<PresenceMatrixCanvas {...baseProps()} />);

    expect(screen.getByText('1. Scene 1')).toBeTruthy();
    expect(screen.getByText('2. Scene 2')).toBeTruthy();
    expect(screen.getByText('Chapter One')).toBeTruthy();
  });

  it('labels the rows and shows their coverage when asked', async () => {
    const screen = await render(<PresenceMatrixCanvas {...baseProps()} />);

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getAllByText('1/2 (50%)')).toHaveLength(2);
  });

  it('hides the coverage line when it carries no meaning', async () => {
    const screen = await render(<PresenceMatrixCanvas {...baseProps()} showRowCoverage={false} />);

    expect(screen.queryByText('1/2 (50%)')).toBeNull();
  });

  it('draws the cells with their values', async () => {
    const screen = await render(<PresenceMatrixCanvas {...baseProps()} />);

    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('hurt')).toBeTruthy();
  });

  it('opens the row tapped in the label band', async () => {
    const props = baseProps();
    await render(<PresenceMatrixCanvas {...props} />);
    const gridTop = MATRIX_PADDING + MATRIX_HEADER_HEIGHT;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: 10, y: gridTop + 10 });
    });

    expect(props.onPressRow).toHaveBeenCalledWith('row-1');
    expect(props.onPressScene).not.toHaveBeenCalled();
  });

  it('opens the scene tapped anywhere in its column', async () => {
    const props = baseProps();
    const screen = await render(<PresenceMatrixCanvas {...props} />);
    const gridLeft = MATRIX_PADDING + MATRIX_LABEL_WIDTH;
    void screen;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: gridLeft + 5, y: MATRIX_PADDING });
    });
    expect(props.onPressScene).toHaveBeenCalledWith('sc-1');

    await act(async () => {
      mockViewportOptions.current?.onTap({
        x: gridLeft + props.layout.sceneWidth + 5,
        y: MATRIX_PADDING,
      });
    });
    expect(props.onPressScene).toHaveBeenCalledWith('sc-2');
  });

  it('ignores taps above the grid', async () => {
    const props = baseProps();
    await render(<PresenceMatrixCanvas {...props} />);
    const gridLeft = MATRIX_PADDING + MATRIX_LABEL_WIDTH;

    await act(async () => {
      mockViewportOptions.current?.onTap({ x: gridLeft + 5, y: MATRIX_PADDING - 1 });
    });

    expect(props.onPressScene).not.toHaveBeenCalled();
    expect(props.onPressRow).not.toHaveBeenCalled();
  });
});
