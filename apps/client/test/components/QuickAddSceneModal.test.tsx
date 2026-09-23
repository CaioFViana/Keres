import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import QuickAddSceneModal from '../../src/components/features/chapters/QuickAddSceneModal';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});

jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View testID="quick-add-modal">{children}</View> : null,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const baseProps = {
  visible: true,
  groupName: 'Arrival',
  onSubmit: jest.fn(),
  onClose: jest.fn(),
};

describe('QuickAddSceneModal', () => {
  it('renders nothing while hidden', async () => {
    const view = await render(<QuickAddSceneModal {...baseProps} visible={false} />);

    expect(view.queryByTestId('quick-add-scene')).toBeNull();
  });

  it('names the group the captured scenes land in', async () => {
    const view = await render(<QuickAddSceneModal {...baseProps} />);

    expect(view.getByText('quick_add_scene_title:{"group":"Arrival"}')).toBeTruthy();
    expect(view.getByPlaceholderText('quick_add_scene_placeholder')).toBeTruthy();
  });

  it('submits trimmed titles and stays open for the next one', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const view = await render(<QuickAddSceneModal {...baseProps} onSubmit={onSubmit} />);

    await fireEvent.changeText(
      view.getByPlaceholderText('quick_add_scene_placeholder'),
      '  Betrayal  ',
    );
    await act(async () => {
      fireEvent.press(view.getByTestId('quick-add-scene-row-submit'));
    });

    expect(onSubmit).toHaveBeenCalledWith('Betrayal');
    expect(view.getByPlaceholderText('quick_add_scene_placeholder').props.value).toBe('');
    expect(view.getByTestId('quick-add-scene')).toBeTruthy();
  });

  it('ignores blank titles', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const view = await render(<QuickAddSceneModal {...baseProps} onSubmit={onSubmit} />);

    await fireEvent.changeText(view.getByPlaceholderText('quick_add_scene_placeholder'), '   ');
    await act(async () => {
      fireEvent.press(view.getByTestId('quick-add-scene-row-submit'));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the typed title when creation fails', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('offline'));
    const view = await render(<QuickAddSceneModal {...baseProps} onSubmit={onSubmit} />);

    await fireEvent.changeText(view.getByPlaceholderText('quick_add_scene_placeholder'), 'Arrival');
    await act(async () => {
      fireEvent.press(view.getByTestId('quick-add-scene-row-submit'));
    });

    expect(onSubmit).toHaveBeenCalledWith('Arrival');
    expect(view.getByPlaceholderText('quick_add_scene_placeholder').props.value).toBe('Arrival');
  });

  it('closes through the close button', async () => {
    const onClose = jest.fn();
    const view = await render(<QuickAddSceneModal {...baseProps} onClose={onClose} />);

    await fireEvent.press(view.getByTestId('quick-add-scene-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
