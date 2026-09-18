import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import NavigatorRoutePersistenceModal from '../../src/components/features/routes/NavigatorRoutePersistenceModal';

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

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? ReactActual.createElement(View, null, children) : null,
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'route-select', ...props }),
  };
});

jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactActual.createElement(View, { testID: 'route-name-input', ...props }),
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) =>
      ReactActual.createElement(Text, { testID: `button-${String(children)}`, onPress }, children),
  };
});

jest.mock('../../src/components/common/controls/FormActions/FormActions', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
  };
});

const routes = [
  { id: 'route-1', name: 'First route' },
  { id: 'route-2', name: 'Second route' },
] as any[];

const baseProps = () => ({
  visible: true,
  mode: 'new' as const,
  routes,
  suggestedName: 'Route 3',
  stepCount: 4,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
});

describe('NavigatorRoutePersistenceModal', () => {
  it('renders nothing while hidden', async () => {
    const screen = await render(
      <NavigatorRoutePersistenceModal {...baseProps()} visible={false} />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it('names a new route starting from the suggestion', async () => {
    const screen = await render(<NavigatorRoutePersistenceModal {...baseProps()} />);

    expect(screen.getByText('navigator_save_as_route')).toBeTruthy();
    expect(screen.getByText('navigator_route_steps_ready')).toBeTruthy();
    expect(screen.getByTestId('route-name-input').props.value).toBe('Route 3');
    expect(screen.queryByTestId('route-select')).toBeNull();
  });

  it('confirms the trimmed name', async () => {
    const props = baseProps();
    const screen = await render(<NavigatorRoutePersistenceModal {...props} />);

    await act(async () => {
      screen.getByTestId('route-name-input').props.onChangeText('  My route  ');
    });
    await fireEvent.press(screen.getByTestId('button-continue'));

    expect(props.onConfirm).toHaveBeenCalledWith({ name: 'My route' });
  });

  it('refuses an empty name', async () => {
    const props = baseProps();
    const screen = await render(<NavigatorRoutePersistenceModal {...props} />);

    await act(async () => {
      screen.getByTestId('route-name-input').props.onChangeText('   ');
    });
    await fireEvent.press(screen.getByTestId('button-continue'));

    expect(screen.getByText('route_name_required')).toBeTruthy();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('clears the error as soon as the name changes', async () => {
    const props = baseProps();
    const screen = await render(<NavigatorRoutePersistenceModal {...props} />);

    await act(async () => {
      screen.getByTestId('route-name-input').props.onChangeText('   ');
    });
    await fireEvent.press(screen.getByTestId('button-continue'));
    expect(screen.getByText('route_name_required')).toBeTruthy();

    await act(async () => {
      screen.getByTestId('route-name-input').props.onChangeText('Fixed');
    });
    expect(screen.queryByText('route_name_required')).toBeNull();
  });

  it('preselects the first route to replace', async () => {
    const screen = await render(<NavigatorRoutePersistenceModal {...baseProps()} mode="replace" />);

    expect(screen.getByText('navigator_replace_route')).toBeTruthy();
    expect(screen.getByTestId('route-select').props.options).toEqual([
      { value: 'route-1', label: 'First route' },
      { value: 'route-2', label: 'Second route' },
    ]);
    expect(screen.getByTestId('route-select').props.value).toBe('route-1');
    expect(screen.queryByTestId('route-name-input')).toBeNull();
  });

  it('confirms the route chosen to replace', async () => {
    const props = baseProps();
    const screen = await render(<NavigatorRoutePersistenceModal {...props} mode="replace" />);

    await act(async () => {
      screen.getByTestId('route-select').props.onValueChange('route-2');
    });
    await fireEvent.press(screen.getByTestId('button-continue'));

    expect(props.onConfirm).toHaveBeenCalledWith({ routeId: 'route-2' });
  });

  it('refuses to replace when no route is chosen', async () => {
    const props = { ...baseProps(), mode: 'replace' as const, routes: [] as any[] };
    const screen = await render(<NavigatorRoutePersistenceModal {...props} />);

    expect(screen.getByTestId('route-select').props.value).toBeNull();
    await fireEvent.press(screen.getByTestId('button-continue'));

    expect(screen.getByText('navigator_select_route_to_replace')).toBeTruthy();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('resets its draft every time it opens', async () => {
    const props = baseProps();
    const screen = await render(<NavigatorRoutePersistenceModal {...props} />);

    await act(async () => {
      screen.getByTestId('route-name-input').props.onChangeText('Changed');
    });
    await screen.rerender(<NavigatorRoutePersistenceModal {...props} visible={false} />);
    await screen.rerender(<NavigatorRoutePersistenceModal {...props} suggestedName="Route 4" />);

    expect(screen.getByTestId('route-name-input').props.value).toBe('Route 4');
  });

  it('closes without confirming', async () => {
    const props = baseProps();
    const screen = await render(<NavigatorRoutePersistenceModal {...props} />);

    await fireEvent.press(screen.getByTestId('button-cancel'));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
