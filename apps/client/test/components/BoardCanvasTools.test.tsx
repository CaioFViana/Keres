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
    default: (props: Record<string, unknown>) => (
      <RN.View testID="multi-select-pill" {...props} />
    ),
  };
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
    onDoneSelect: jest.fn(),
  };
  const view = await render(
    <BoardCanvasTools
      groupedOptions={groupedOptions}
      pickerValues={[]}
      drawTool={null}
      canFinish={false}
      selectMode={false}
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

    await fireEvent.press(view.getByTestId('action-edit-overlays'));
    expect(handlers.onObjectsAction).toHaveBeenCalledWith('select');
  });

  it('swaps the actions for the select bar while selecting', async () => {
    const { view, handlers } = await setup({ selectMode: true });

    expect(view.queryAllByTestId('multi-select-pill')).toHaveLength(0);
    expect(view.getByText('overlay_select_hint')).toBeTruthy();
    await act(async () => {
      view.getByTestId('overlay_select_done').props.onPress();
    });
    expect(handlers.onDoneSelect).toHaveBeenCalledTimes(1);
  });
});
