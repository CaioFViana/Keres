import { cleanup, fireEvent, render } from '@testing-library/react-native';
import type { ManuscriptSection } from '@keres/shared';
import ManuscriptIndexModal from '../../../src/components/features/manuscript/ManuscriptIndexModal/ManuscriptIndexModal';

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
      onPrimaryContainer: '#001',
      background: '#fff',
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
      visible ? <View>{children}</View> : null,
  };
});

function sceneSection(
  id: string,
  name: string,
  position: number,
  chapterId: string | null,
): ManuscriptSection {
  return {
    key: `scene-${id}`,
    kind: 'scene',
    scene: { id, chapterId, name, index: position, body: 'Prose.', isDeleted: false },
    position,
  };
}

const linearSections: ManuscriptSection[] = [
  {
    key: 'container-ch-1',
    kind: 'container',
    containerId: 'ch-1',
    name: 'Arrival',
    index: 1,
    containerType: 'chapter',
  },
  sceneSection('s-1', 'Opening', 1, 'ch-1'),
  sceneSection('s-2', 'Inland', 2, 'ch-1'),
  { key: 'loose-heading', kind: 'loose-heading' },
  sceneSection('s-3', 'Fragment', 3, null),
];

const baseProps = {
  visible: true,
  sections: linearSections,
  currentSectionIndex: null as number | null,
  looseHeadingLabel: 'Appendix',
  onSelectSection: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ManuscriptIndexModal', () => {
  it('renders nothing while hidden', async () => {
    const view = await render(<ManuscriptIndexModal {...baseProps} visible={false} />);

    expect(view.queryByTestId('manuscript-index-modal')).toBeNull();
  });

  it('lists chapters with their scenes and an appendix for loose scenes', async () => {
    const view = await render(<ManuscriptIndexModal {...baseProps} />);

    expect(view.getByText('manuscript_index_title')).toBeTruthy();
    expect(view.getByText('1. Arrival')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-container-ch-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-2')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-loose-heading')).toBeTruthy();
    expect(view.getByText('Appendix')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-3')).toBeTruthy();
    expect(view.getByText('3. Fragment')).toBeTruthy();
  });

  it('shows event titles without a chapter number', async () => {
    const sections: ManuscriptSection[] = [
      {
        key: 'container-ev-1',
        kind: 'container',
        containerId: 'ev-1',
        name: 'The War',
        index: 2,
        containerType: 'event',
      },
      sceneSection('s-9', 'Aftermath', 1, 'ev-1'),
    ];
    const view = await render(<ManuscriptIndexModal {...baseProps} sections={sections} />);

    expect(view.getByText('The War')).toBeTruthy();
    expect(view.queryByText('2. The War')).toBeNull();
  });

  it('collapses and re-expands a chapter on press', async () => {
    const view = await render(<ManuscriptIndexModal {...baseProps} />);

    expect(
      view.getByTestId('manuscript-index-container-ch-1').props.accessibilityState,
    ).toMatchObject({ expanded: true });
    await fireEvent.press(view.getByTestId('manuscript-index-container-ch-1'));

    expect(view.queryByTestId('manuscript-index-scene-s-1')).toBeNull();
    expect(
      view.getByTestId('manuscript-index-container-ch-1').props.accessibilityState,
    ).toMatchObject({ expanded: false });

    await fireEvent.press(view.getByTestId('manuscript-index-container-ch-1'));
    expect(view.getByTestId('manuscript-index-scene-s-1')).toBeTruthy();
  });

  it('reports the section index of the picked scene', async () => {
    const onSelectSection = jest.fn();
    const view = await render(
      <ManuscriptIndexModal {...baseProps} onSelectSection={onSelectSection} />,
    );

    await fireEvent.press(view.getByTestId('manuscript-index-scene-s-3'));

    expect(onSelectSection).toHaveBeenCalledWith(4);
  });

  it('highlights the scene the reader is on', async () => {
    const view = await render(
      <ManuscriptIndexModal {...baseProps} currentSectionIndex={1} />,
    );

    expect(view.getByTestId('manuscript-index-scene-s-1').props.accessibilityState).toMatchObject(
      { selected: true },
    );
    expect(view.getByTestId('manuscript-index-scene-s-2').props.accessibilityState).toMatchObject(
      { selected: false },
    );
  });

  it('highlights nothing before the reader has a position', async () => {
    const view = await render(<ManuscriptIndexModal {...baseProps} />);

    expect(view.getByTestId('manuscript-index-scene-s-1').props.accessibilityState).toMatchObject(
      { selected: false },
    );
  });

  it('renders route scenes flat when there are no containers', async () => {
    const sections: ManuscriptSection[] = [
      {
        key: 'step-step-1',
        kind: 'scene',
        scene: { id: 's-a', chapterId: 'ch-1', name: 'Alpha', index: 1, body: 'First.', isDeleted: false },
        position: 1,
      },
      {
        key: 'step-step-2',
        kind: 'scene',
        scene: { id: 's-b', chapterId: 'ch-1', name: 'Beta', index: 2, body: 'Second.', isDeleted: false },
        position: 2,
      },
    ];
    const view = await render(<ManuscriptIndexModal {...baseProps} sections={sections} />);

    expect(view.getByTestId('manuscript-index-step-step-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-step-step-2')).toBeTruthy();
    expect(view.getByText('1. Alpha')).toBeTruthy();
    expect(view.queryByText('Appendix')).toBeNull();
  });

  it('shows an empty state without scenes', async () => {
    const view = await render(<ManuscriptIndexModal {...baseProps} sections={[]} />);

    expect(view.getByText('manuscript_no_scenes')).toBeTruthy();
  });

  it('closes from the close button', async () => {
    const onClose = jest.fn();
    const view = await render(<ManuscriptIndexModal {...baseProps} onClose={onClose} />);

    await fireEvent.press(view.getByTestId('manuscript-index-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
