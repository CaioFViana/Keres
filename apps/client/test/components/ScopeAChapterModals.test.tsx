import { act, render } from '@testing-library/react-native';
import { buildReorderItems } from '@keres/shared';
import React from 'react';
import type { ChapterSelect } from '../../src/db/schema';
import ChapterReorderModal from '../../src/components/features/chapters/ChapterReorderModal/ChapterReorderModal';
import ConvertContainerModal from '../../src/components/features/chapters/ConvertContainerModal/ConvertContainerModal';

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

// The real surface renders a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      onPress,
      disabled,
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <RN.View
        testID={testID ?? (typeof children === 'string' ? children : 'mock-button')}
        onPress={onPress}
        disabled={disabled}
      >
        <RN.Text>{children}</RN.Text>
      </RN.View>
    ),
  };
});

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    SingleSelectPill: ({
      options,
      value,
      onValueChange,
    }: {
      options: { label: string; value: string }[];
      value: string | null;
      onValueChange: (next: string | null) => void;
    }) => (
      <RN.View
        testID="single-select-pill"
        options={options}
        value={value}
        onValueChange={onValueChange}
      />
    ),
  };
});

jest.mock('../../src/vocabulary/useVocabularyEntityCopy', () => ({
  useVocabularyEntityCopy: (type: string) => ({
    convertTo: type === 'Chapter' ? 'Convert to chapter' : 'Convert to event',
  }),
}));

const mockReorderModal = jest.fn();
jest.mock('../../src/components/common/modals/ReorderModal/ReorderModal', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockReorderModal(props);
    return null;
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('ChapterReorderModal', () => {
  const chapters = [
    { id: 'ch-2', name: 'Second', index: 2 },
    { id: 'ch-1', name: 'First', index: 1 },
  ] as ChapterSelect[];

  it('hands the chapters over sorted with identity and label readers', async () => {
    const onClose = jest.fn();
    await render(
      <ChapterReorderModal
        isVisible
        onClose={onClose}
        chapters={chapters}
        onReorderConfirm={jest.fn()}
      />,
    );

    const props = mockReorderModal.mock.calls[0][0] as {
      isVisible: boolean;
      onClose: () => void;
      title: string;
      items: ChapterSelect[];
      getId: (chapter: ChapterSelect) => string;
      getLabel: (chapter: ChapterSelect) => string;
    };
    expect(props.isVisible).toBe(true);
    expect(props.onClose).toBe(onClose);
    expect(props.title).toBe('reorder_chapters_title');
    expect(props.items.map((chapter) => chapter.id)).toEqual(['ch-1', 'ch-2']);
    expect(props.getId(chapters[0])).toBe('ch-2');
    expect(props.getLabel(chapters[0])).toBe('Second');
  });

  it('maps the final order to index updates', async () => {
    const onReorderConfirm = jest.fn(async () => {});
    await render(
      <ChapterReorderModal
        isVisible
        onClose={jest.fn()}
        chapters={chapters}
        onReorderConfirm={onReorderConfirm}
      />,
    );

    const props = mockReorderModal.mock.calls[0][0] as {
      onReorderConfirm: (reordered: ChapterSelect[]) => Promise<void>;
    };
    const reordered = [chapters[0], chapters[1]];
    await act(async () => {
      await props.onReorderConfirm(reordered);
    });

    expect(onReorderConfirm).toHaveBeenCalledWith(
      buildReorderItems(reordered, (chapter) => chapter.id),
    );
    const confirmed = (onReorderConfirm.mock.calls as unknown as unknown[][])[0][0] as {
      id: string;
      newIndex: number;
    }[];
    expect(confirmed).toEqual([
      { id: 'ch-2', newIndex: expect.any(Number) },
      { id: 'ch-1', newIndex: expect.any(Number) },
    ]);
  });
});

describe('ConvertContainerModal', () => {
  const chapters = [
    { id: 'ch-1', name: 'First' },
    { id: 'ch-2', name: 'Second' },
  ];

  it('renders nothing when hidden', async () => {
    const view = await render(
      <ConvertContainerModal
        visible={false}
        name="Side Quest"
        currentType="event"
        chapterNames={chapters}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('converts an event back with a chosen spine slot', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <ConvertContainerModal
        visible
        name="Side Quest"
        currentType="event"
        chapterNames={chapters}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(view.getByText('Convert to chapter')).toBeTruthy();
    const pill = view.getByTestId('single-select-pill');
    expect(pill.props.options).toEqual([
      { label: 'chapter_convert_before', value: '1' },
      { label: 'chapter_convert_before', value: '2' },
      { label: 'chapter_convert_at_end', value: '3' },
    ]);
    // The end of the spine is the default claim.
    expect(pill.props.value).toBe('3');

    await act(async () => {
      pill.props.onValueChange('1');
    });
    await act(async () => {
      view.getByTestId('confirm-convert-container').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith('chapter', 1);
  });

  it('resets the slot to the end every time it opens', async () => {
    const view = await render(
      <ConvertContainerModal
        visible
        name="Side Quest"
        currentType="event"
        chapterNames={chapters}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    await act(async () => {
      view.getByTestId('single-select-pill').props.onValueChange('1');
    });
    expect(view.getByTestId('single-select-pill').props.value).toBe('1');

    await view.rerender(
      <ConvertContainerModal
        visible={false}
        name="Side Quest"
        currentType="event"
        chapterNames={chapters}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    await view.rerender(
      <ConvertContainerModal
        visible
        name="Side Quest"
        currentType="event"
        chapterNames={chapters}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    expect(view.getByTestId('single-select-pill').props.value).toBe('3');
  });

  it('converts a chapter to an event without asking for a slot', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const view = await render(
      <ConvertContainerModal
        visible
        name="Prologue"
        currentType="chapter"
        chapterNames={chapters}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(view.getByText('Convert to event')).toBeTruthy();
    expect(view.queryByTestId('single-select-pill')).toBeNull();

    await act(async () => {
      view.getByTestId('confirm-convert-container').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledWith('event', undefined);

    await act(async () => {
      view.getByTestId('cancel').props.onPress();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
