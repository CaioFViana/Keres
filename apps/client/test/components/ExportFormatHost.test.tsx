import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ExportFormatHost from '../../src/components/features/export/ExportFormatHost';
import { useExportFormatPromptStore } from '../../src/state/exportFormatPromptStore';

jest.mock('../../src/utils/exportFormatPrompt', () =>
  jest.requireActual('../../src/utils/exportFormatPrompt'),
);
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
const mockT = (key: string) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#fff',
      border: '#ddd',
      text: '#111',
      textSecondary: '#555',
      primary: '#00f',
    },
  }),
}));
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: ({ children }: any) => <View>{children}</View> };
});

// eslint-disable-next-line import/first
import { chooseExportFormat } from '../../src/utils/exportFormatPrompt';

describe('export format chooser', () => {
  afterEach(() => useExportFormatPromptStore.getState().answer(null));

  it('shows nothing until an export asks, then resolves the tapped format', async () => {
    await render(<ExportFormatHost />);
    expect(screen.queryByTestId('export-format-svg')).toBeNull();

    let answer: string | null | undefined;
    await act(async () => {
      void chooseExportFormat().then((format) => {
        answer = format;
      });
    });
    expect(screen.getByTestId('export-format-svg')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('export-format-png'));
    await act(async () => undefined);
    expect(answer).toBe('png');
    expect(screen.queryByTestId('export-format-svg')).toBeNull();
  });

  it('resolves null when dismissed, and a second request dismisses the first', async () => {
    await render(<ExportFormatHost />);
    const answers: Array<string | null> = [];
    await act(async () => {
      void chooseExportFormat().then((format) => answers.push(format));
      void chooseExportFormat().then((format) => answers.push(format));
    });
    expect(answers).toEqual([null]);
    await fireEvent.press(screen.getByLabelText('close'));
    await act(async () => undefined);
    expect(answers).toEqual([null, null]);
  });
});
