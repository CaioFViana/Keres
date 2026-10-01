import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import BoardCanvasTools from '../../src/components/features/boards/BoardCanvasTools';

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
    default: (props: Record<string, unknown>) => <RN.View testID="multi-select-pill" {...props} />,
  };
});
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: jest.fn(() => ({
    width: 390,
    height: 844,
    breakpoint: 'compact',
    isCompact: true,
    isMedium: false,
    isWide: false,
  })),
}));

import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';

const mockScreenAnchor = jest.fn();
jest.mock('../../src/guides/useGuideAnchor', () => ({
  __esModule: true,
  useGuideAnchor: jest.fn(() => () => {}),
  useScreenAnchor: (...args: unknown[]) => mockScreenAnchor(...args),
}));

const mockLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;
const compactLayout = {
  width: 390,
  height: 844,
  breakpoint: 'compact' as const,
  isCompact: true,
  isMedium: false,
  isWide: false,
};
const wideLayout = {
  width: 1200,
  height: 800,
  breakpoint: 'wide' as const,
  isCompact: false,
  isMedium: false,
  isWide: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLayout.mockReturnValue(compactLayout);
});

const groupedOptions = [
  {
    key: 'Character',
    label: 'Characters',
    options: [{ label: 'Atena', value: 'char-1' }],
  },
];

async function setup(overrides: Record<string, unknown> = {}) {
  const handlers = {
    onPickEntity: jest.fn(),
    onAddNote: jest.fn(),
    onObjectsAction: jest.fn(),
    onFinishDraw: jest.fn(),
    onCancelDraw: jest.fn(),
    onToggleLayout: jest.fn(),
    onToggleConnectionMode: jest.fn(),
    onToggleOverlayEdit: jest.fn(),
  };
  const view = await render(
    <BoardCanvasTools
      groupedOptions={groupedOptions}
      pickerValues={[]}
      drawTool={null}
      canFinish={false}
      layoutEditing={false}
      connectionMode={false}
      overlayEditing={false}
      {...handlers}
      {...overrides}
    />,
  );
  return { view, handlers };
}

describe('BoardCanvasTools', () => {
  it('wires the entity picker, note, objects and edit actions', async () => {
    const { view, handlers } = await setup();

    const pills = view.getAllByTestId('multi-select-pill');
    expect(pills).toHaveLength(2);
    expect(pills[0].props).toMatchObject({
      groups: groupedOptions,
      placeholder: 'board_add_entity',
      noOptionsText: 'board_no_entities',
    });
    await act(async () => {
      (pills[0].props.onSelectionChange as (values: string[]) => void)(['char-1']);
    });
    expect(handlers.onPickEntity).toHaveBeenCalledWith(['char-1']);

    await fireEvent.press(view.getByTestId('action-add-note'));
    expect(handlers.onAddNote).toHaveBeenCalledTimes(1);

    expect(pills[1].props.placeholder).toBe('objects_add');
    await act(async () => {
      (pills[1].props.onSelectionChange as (values: string[]) => void)(['draw:line']);
    });
    expect(handlers.onObjectsAction).toHaveBeenCalledWith('draw:line');
  });

  it('routes the mode toggles from the tools bar', async () => {
    const { view, handlers } = await setup();

    expect(mockScreenAnchor).toHaveBeenCalledWith('BoardCanvas', 'add');
    expect(mockScreenAnchor).toHaveBeenCalledWith('BoardCanvas', 'modes');
    await fireEvent.press(view.getByTestId('action-board-connection-mode'));
    await fireEvent.press(view.getByTestId('action-board-edit-overlays'));
    await fireEvent.press(view.getByTestId('action-board-edit-layout'));
    expect(handlers.onToggleConnectionMode).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleOverlayEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleLayout).toHaveBeenCalledTimes(1);
  });

  it('stacks the modes above the add actions on compact screens', async () => {
    mockLayout.mockReturnValue(compactLayout);
    const { view } = await setup();

    const modes = view.getByTestId('board-modes');
    const adds = view.getByTestId('board-add-actions');
    expect(modes.parent?.props.testID).toBe('board-tools');
    expect(adds.parent?.props.testID).toBe('board-tools');
    const siblings = modes.parent?.children ?? [];
    expect(siblings.indexOf(modes)).toBeLessThan(siblings.indexOf(adds));
  });

  it('docks the modes right of the add actions on medium and wide screens', async () => {
    mockLayout.mockReturnValue(wideLayout);
    const { view } = await setup();

    const modes = view.getByTestId('board-modes');
    const adds = view.getByTestId('board-add-actions');
    expect(adds.parent?.props.testID).toBeUndefined();
    expect(adds.parent?.children[0]).toBe(adds);
    expect(modes.parent?.parent).toBe(adds.parent);
  });
});
