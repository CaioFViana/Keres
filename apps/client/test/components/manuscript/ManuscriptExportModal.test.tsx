import { cleanup, fireEvent, render } from '@testing-library/react-native';
import ManuscriptExportModal from '../../../src/components/features/manuscript/ManuscriptExportModal/ManuscriptExportModal';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#555',
      surface: '#fff',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ccf',
      onPrimary: '#fff',
      shadow: '#000',
    },
  }),
}));

jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});

jest.mock('../../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View testID="export-modal">{children}</View> : null,
  };
});

const baseProps = {
  visible: true,
  routeName: null as string | null,
  showLooseSwitch: true,
  looseCount: 2,
  chapterNumberingAvailable: true,
  onExport: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ManuscriptExportModal', () => {
  it('renders nothing while hidden', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} visible={false} />);

    expect(view.queryByTestId('export-modal')).toBeNull();
  });

  it('lists every format with docx selected', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} />);

    expect(view.getByTestId('export-format-docx')).toBeTruthy();
    expect(view.getByTestId('export-format-pdf')).toBeTruthy();
    expect(view.getByTestId('export-format-md')).toBeTruthy();
    expect(view.getByTestId('export-format-txt')).toBeTruthy();
    expect(view.getByTestId('export-format-docx').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByTestId('export-format-md').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('exports the chosen format with all switches off by default', async () => {
    const onExport = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <ManuscriptExportModal {...baseProps} onExport={onExport} onClose={onClose} />,
    );

    expect(view.getByTestId('export-scene-names').props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(view.getByTestId('export-loose').props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(view.getByTestId('export-index').props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(view.queryByTestId('export-reset-numbers')).toBeNull();

    await fireEvent.press(view.getByTestId('export-confirm'));

    expect(onExport).toHaveBeenCalledWith({
      format: 'docx',
      includeSceneNames: false,
      includeLooseScenes: false,
      resetSceneNumbers: false,
      includeIndex: false,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exports the toggled choices', async () => {
    const onExport = jest.fn();
    const view = await render(<ManuscriptExportModal {...baseProps} onExport={onExport} />);

    await fireEvent.press(view.getByTestId('export-format-md'));
    await fireEvent.press(view.getByTestId('export-scene-names'));
    await fireEvent.press(view.getByTestId('export-reset-numbers'));
    await fireEvent.press(view.getByTestId('export-loose'));
    await fireEvent.press(view.getByTestId('export-index'));
    await fireEvent.press(view.getByTestId('export-confirm'));

    expect(onExport).toHaveBeenCalledWith({
      format: 'md',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: true,
      includeIndex: true,
    });
  });

  it('hides the reset switch while scene names stay off', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} />);

    expect(view.queryByTestId('export-reset-numbers')).toBeNull();

    await fireEvent.press(view.getByTestId('export-scene-names'));

    expect(view.getByTestId('export-reset-numbers')).toBeTruthy();
  });

  it('hides the reset switch for branching stories', async () => {
    const onExport = jest.fn();
    const view = await render(
      <ManuscriptExportModal {...baseProps} chapterNumberingAvailable={false} onExport={onExport} />,
    );

    await fireEvent.press(view.getByTestId('export-scene-names'));

    expect(view.queryByTestId('export-reset-numbers')).toBeNull();

    await fireEvent.press(view.getByTestId('export-confirm'));

    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({ resetSceneNumbers: false }),
    );
  });

  it('hides the index switch for plain text only', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} />);

    expect(view.getByTestId('export-index')).toBeTruthy();

    await fireEvent.press(view.getByTestId('export-format-txt'));

    expect(view.queryByTestId('export-index')).toBeNull();

    await fireEvent.press(view.getByTestId('export-format-md'));

    expect(view.getByTestId('export-index')).toBeTruthy();
  });

  it('hides the loose switch when there is nothing loose to include', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} showLooseSwitch={false} />);

    expect(view.queryByTestId('export-loose')).toBeNull();
    expect(view.getByTestId('export-scene-names')).toBeTruthy();
  });

  it('labels the loose switch with the count', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} looseCount={3} />);

    expect(view.getByText('export_manuscript_include_loose:{"count":3}')).toBeTruthy();
  });

  it('names the route being exported', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} routeName="Main" />);

    expect(view.getByText('export_manuscript_route_note:{"route":"Main"}')).toBeTruthy();
  });

  it('shows no route note without a route', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} routeName={null} />);

    expect(view.queryByText('export_manuscript_route_note', { exact: false })).toBeNull();
  });

  it('closes without exporting on cancel', async () => {
    const onExport = jest.fn();
    const onClose = jest.fn();
    const view = await render(
      <ManuscriptExportModal {...baseProps} onExport={onExport} onClose={onClose} />,
    );

    await fireEvent.press(view.getByTestId('export-cancel'));

    expect(onExport).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
