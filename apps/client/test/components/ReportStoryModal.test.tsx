import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import ReportStoryModal from '../../src/components/features/story/ReportStoryModal/ReportStoryModal';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
  getCommonInputStyles: () => ({ multiline: {} }),
}));

jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});

// The real input pulls the keyboard-aware layout context; a bare field keeps this test about
// the dialog's own logic (trimming, gating, closing).
jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput: RNTextInput } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <RNTextInput {...(props as object)} />,
  };
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const baseProps = {
  visible: true,
  sending: false,
  storyTitle: 'A Queda',
  onClose: jest.fn(),
  onSend: jest.fn(),
};

describe('ReportStoryModal', () => {
  it('renders nothing while hidden', async () => {
    const view = await render(<ReportStoryModal {...baseProps} visible={false} />);

    expect(view.queryByTestId('report-send')).toBeNull();
  });

  it('sends the trimmed reason and closes on success', async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    const onClose = jest.fn();
    const view = await render(
      <ReportStoryModal {...baseProps} onSend={onSend} onClose={onClose} />,
    );

    await fireEvent.changeText(view.getByTestId('report-reason-input'), '  spam links  ');
    await act(async () => {
      fireEvent.press(view.getByTestId('report-send'));
    });

    expect(onSend).toHaveBeenCalledWith('spam links');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when sending fails and refuses an empty reason', async () => {
    const onSend = jest.fn().mockResolvedValue(false);
    const onClose = jest.fn();
    const view = await render(
      <ReportStoryModal {...baseProps} onSend={onSend} onClose={onClose} />,
    );

    // Empty: the send button is disabled, so nothing is sent.
    await act(async () => {
      fireEvent.press(view.getByTestId('report-send'));
    });
    expect(onSend).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByTestId('report-reason-input'), 'rude');
    await act(async () => {
      fireEvent.press(view.getByTestId('report-send'));
    });
    expect(onSend).toHaveBeenCalledWith('rude');
    expect(onClose).not.toHaveBeenCalled();
  });
});
