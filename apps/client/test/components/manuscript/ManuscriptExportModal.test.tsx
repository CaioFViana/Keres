import { cleanup, fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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

const twoArcs = [
  { id: 'arc-1', title: 'First Arc' },
  { id: 'arc-2', title: 'Second Arc' },
];

const baseProps = {
  visible: true,
  routeName: null as string | null,
  showLooseSwitch: true,
  looseCount: 2,
  chapterNumberingAvailable: true,
  arcs: [] as { id: string; title: string }[],
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

  it('keeps the options in a bounded scroll region with the actions fixed below', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} arcs={twoArcs} />);

    const scroll = view.getByTestId('export-options-scroll');
    expect(within(scroll).getByTestId('export-arc-arc-1')).toBeTruthy();
    expect(within(scroll).getByTestId('export-format-docx')).toBeTruthy();
    expect(within(scroll).getByTestId('export-scene-names')).toBeTruthy();
    // Actions stay outside the scroll region, always reachable.
    expect(within(scroll).queryByTestId('export-confirm')).toBeNull();
    expect(view.getByTestId('export-confirm')).toBeTruthy();
    expect(StyleSheet.flatten(scroll.props.style)?.maxHeight).toEqual(expect.any(Number));
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
      arcId: null,
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
      arcId: null,
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
      <ManuscriptExportModal
        {...baseProps}
        chapterNumberingAvailable={false}
        onExport={onExport}
      />,
    );

    await fireEvent.press(view.getByTestId('export-scene-names'));

    expect(view.queryByTestId('export-reset-numbers')).toBeNull();

    await fireEvent.press(view.getByTestId('export-confirm'));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ resetSceneNumbers: false }));
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

  it('hides the arc selector with zero or one arc', async () => {
    const none = await render(<ManuscriptExportModal {...baseProps} arcs={[]} />);
    expect(none.queryByTestId('export-arc-all')).toBeNull();
    expect(none.queryByText('export_manuscript_arc')).toBeNull();
  });

  it('hides the arc selector with a single arc', async () => {
    const view = await render(
      <ManuscriptExportModal {...baseProps} arcs={[{ id: 'arc-1', title: 'Only Arc' }]} />,
    );

    expect(view.queryByTestId('export-arc-all')).toBeNull();
    expect(view.queryByText('export_manuscript_arc')).toBeNull();
  });

  it('lists all arcs plus each arc with all selected by default', async () => {
    const view = await render(<ManuscriptExportModal {...baseProps} arcs={twoArcs} />);

    expect(view.getByText('export_manuscript_arc')).toBeTruthy();
    expect(view.getByTestId('export-arc-all').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByTestId('export-arc-arc-1').props.accessibilityState).toMatchObject({
      selected: false,
    });
    expect(view.getByText('First Arc')).toBeTruthy();
    expect(view.getByText('Second Arc')).toBeTruthy();
  });

  it('exports the picked arc', async () => {
    const onExport = jest.fn();
    const view = await render(
      <ManuscriptExportModal {...baseProps} arcs={twoArcs} onExport={onExport} />,
    );

    await fireEvent.press(view.getByTestId('export-arc-arc-2'));
    expect(view.getByTestId('export-arc-arc-2').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByTestId('export-arc-all').props.accessibilityState).toMatchObject({
      selected: false,
    });

    await fireEvent.press(view.getByTestId('export-confirm'));

    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ arcId: 'arc-2' }));
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
