import { act, fireEvent, render } from '@testing-library/react-native';
import type { CalendarDefinitionType } from '@keres/shared';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import CalendarAnchorsModal from '../../src/components/features/calendars/CalendarAnchorsModal';
import CalendarRowList, {
  type CalendarRowField,
} from '../../src/components/features/calendars/CalendarRowList';
import type { CalendarAnchorPreviewRow } from '../../src/utils/calendarAnchorPreview';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      primaryContainer: '#aaf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The spinner's native host type is platform-specific, so stand in a named host
// element. (Prototype-chained, not spread: spreading `react-native` trips
// native-only getters.)
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const mocked = Object.create(actual);
  // defineProperty: the prototype's exports are setter-less getters, so plain
  // assignment would silently keep the real component.
  Object.defineProperty(mocked, 'ActivityIndicator', { value: 'MockActivityIndicator' });
  return mocked;
});

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
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <RN.View
        testID={typeof children === 'string' ? children : 'mock-button'}
        onPress={onPress}
        disabled={disabled}
      >
        <RN.Text>{children}</RN.Text>
      </RN.View>
    ),
  };
});

const mockCalendarAnchorPreview = jest.fn();
jest.mock('../../src/hooks/useCalendarAnchorPreview', () => ({
  useCalendarAnchorPreview: (...args: unknown[]) => mockCalendarAnchorPreview(...args),
}));

const mockNavigateToEntity = jest.fn();
jest.mock('../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockNavigateToEntity,
}));

beforeEach(() => jest.clearAllMocks());

interface MonthRow {
  name: string;
  days: number;
  [key: string]: unknown;
}

const monthFields: CalendarRowField<MonthRow>[] = [
  { key: 'name', label: 'Name', placeholder: 'Month name', kind: 'text', flex: 2 },
  { key: 'days', label: 'Days', placeholder: '30', kind: 'number', flex: 1 },
];

describe('CalendarRowList', () => {
  const baseProps = {
    title: 'Months',
    hint: 'Twelve of them',
    fields: monthFields,
    blank: () => ({ name: '', days: 0 }),
    addLabel: 'Add month',
    emptyLabel: 'No months yet',
  };

  it('shows the empty label and adds a blank row', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarRowList<MonthRow> {...baseProps} rows={[]} editable onChange={onChange} />,
    );

    expect(view.getByText('Months')).toBeTruthy();
    expect(view.getByText('Twelve of them')).toBeTruthy();
    expect(view.getByText('No months yet')).toBeTruthy();

    await fireEvent.press(view.getByText('Add month'));
    expect(onChange).toHaveBeenCalledWith([{ name: '', days: 0 }]);
  });

  it('hides editing affordances when read-only', async () => {
    const view = await render(
      <CalendarRowList<MonthRow>
        {...baseProps}
        rows={[{ name: 'Ember', days: 31 }]}
        editable={false}
        onChange={jest.fn()}
      />,
    );

    expect(view.queryByText('Add month')).toBeNull();
    expect(view.queryByLabelText('delete')).toBeNull();
  });

  it('patches text and numeric cells, and drops untypable numbers', async () => {
    const onChange = jest.fn();
    const rows = [{ name: 'Ember', days: 31 }];
    const view = await render(
      <CalendarRowList<MonthRow> {...baseProps} rows={rows} editable onChange={onChange} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Month name'), 'Emberfall');
    expect(onChange).toHaveBeenCalledWith([{ name: 'Emberfall', days: 31 }]);

    await fireEvent.changeText(view.getByPlaceholderText('30'), '28');
    expect(onChange).toHaveBeenCalledWith([{ name: 'Ember', days: 28 }]);

    onChange.mockClear();
    await fireEvent.changeText(view.getByPlaceholderText('30'), 'abc');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a row', async () => {
    const onChange = jest.fn();
    const view = await render(
      <CalendarRowList<MonthRow>
        {...baseProps}
        rows={[
          { name: 'Ember', days: 31 },
          { name: 'Frost', days: 30 },
        ]}
        editable
        onChange={onChange}
      />,
    );

    await fireEvent.press(view.getAllByLabelText('delete')[1]);
    expect(onChange).toHaveBeenCalledWith([{ name: 'Ember', days: 31 }]);
  });

  it('cycles choice cells through their options', async () => {
    interface SeasonRow {
      name: string;
      kind: string;
      [key: string]: unknown;
    }
    const onChange = jest.fn();
    const fields: CalendarRowField<SeasonRow>[] = [
      { key: 'name', label: 'Name', placeholder: 'Season', kind: 'text', flex: 2 },
      {
        key: 'kind',
        label: 'Kind',
        placeholder: 'Pick',
        kind: 'choice',
        choices: [
          { value: 'wet', label: 'Wet' },
          { value: 'dry', label: 'Dry' },
        ],
        flex: 1,
      },
    ];
    const view = await render(
      <CalendarRowList<SeasonRow>
        title="Seasons"
        rows={[{ name: 'Rains', kind: 'wet' }]}
        fields={fields}
        blank={() => ({ name: '', kind: 'wet' })}
        addLabel="Add season"
        editable
        onChange={onChange}
      />,
    );

    expect(view.getByText('Wet')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Kind'));
    expect(onChange).toHaveBeenCalledWith([{ name: 'Rains', kind: 'dry' }]);
  });
});

describe('CalendarAnchorsModal', () => {
  const definition = { id: 'cal' } as unknown as CalendarDefinitionType;
  const comparison = { id: 'cal-next' } as unknown as CalendarDefinitionType;

  const row = (overrides: Partial<CalendarAnchorPreviewRow> = {}): CalendarAnchorPreviewRow =>
    ({
      id: 'row-1',
      kind: 'anchor-start',
      containerId: 'ch-1',
      containerName: 'Chapter One',
      containerType: 'chapter',
      sceneId: 'scene-1',
      sceneName: 'Arrival',
      position: 'start',
      date: 'Year 1, Day 2',
      ...overrides,
    }) as CalendarAnchorPreviewRow;

  const previewFor = (rows: CalendarAnchorPreviewRow[], loading = false) => ({
    rows,
    loading,
  });

  beforeEach(() => {
    mockCalendarAnchorPreview.mockImplementation((used: CalendarDefinitionType) =>
      previewFor(used === comparison ? [row({ id: 'row-1', date: 'Year 1, Day 9' })] : [row()]),
    );
  });

  it('renders nothing when hidden', async () => {
    const view = await render(
      <CalendarAnchorsModal
        visible={false}
        calendarName="Imperial"
        definition={definition}
        onClose={jest.fn()}
      />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('shows a spinner while the preview loads', async () => {
    mockCalendarAnchorPreview.mockReturnValue(previewFor([], true));
    const view = await render(
      <CalendarAnchorsModal
        visible
        calendarName="Imperial"
        definition={definition}
        onClose={jest.fn()}
      />,
    );

    expect(
      // Composite nodes carry the component as `type`; the lib types it as string.
      view.container.queryAll((node) => node.type === (ActivityIndicator as unknown as string)),
    ).toHaveLength(1);
  });

  it('shows the empty state when no anchor reads the calendar', async () => {
    mockCalendarAnchorPreview.mockReturnValue(previewFor([]));
    const view = await render(
      <CalendarAnchorsModal
        visible
        calendarName="Imperial"
        definition={definition}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('calendar_anchors_empty')).toBeTruthy();
  });

  it('lists current readings in inspection mode', async () => {
    const view = await render(
      <CalendarAnchorsModal
        visible
        calendarName="Imperial"
        definition={definition}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('calendar_anchors_title')).toBeTruthy();
    expect(view.getByText('Chapter One · calendar_anchor_start: Arrival')).toBeTruthy();
    expect(view.getByText('Year 1, Day 2')).toBeTruthy();
    expect(view.queryByText('calendar_change_new')).toBeNull();
  });

  it('labels the story start and unknown names', async () => {
    mockCalendarAnchorPreview.mockReturnValue(
      previewFor([
        row({ id: 's', kind: 'story-start', sceneId: null }),
        row({
          id: 'u',
          kind: 'anchor-end',
          containerName: null,
          sceneName: null,
          sceneId: null,
          date: null,
        }),
      ]),
    );
    const view = await render(
      <CalendarAnchorsModal
        visible
        calendarName="Imperial"
        definition={definition}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('calendar_anchor_story_start')).toBeTruthy();
    expect(
      view.getByText(
        'calendar_anchor_unknown_container · calendar_anchor_end: calendar_anchor_unknown_scene',
      ),
    ).toBeTruthy();
    expect(view.getByText('calendar_anchor_no_epoch')).toBeTruthy();
  });

  it('compares readings side by side when reviewing a change', async () => {
    const view = await render(
      <CalendarAnchorsModal
        visible
        calendarName="Imperial"
        definition={definition}
        comparisonDefinition={comparison}
        onClose={jest.fn()}
      />,
    );

    expect(view.getByText('calendar_change_preview_title')).toBeTruthy();
    expect(view.getByText('calendar_change_new')).toBeTruthy();
    expect(view.getByText('Year 1, Day 2')).toBeTruthy();
    expect(view.getByText('Year 1, Day 9')).toBeTruthy();
  });

  it('opens the anchored scene and closes itself', async () => {
    const onClose = jest.fn();
    const view = await render(
      <CalendarAnchorsModal
        visible
        calendarName="Imperial"
        definition={definition}
        onClose={onClose}
      />,
    );

    await fireEvent.press(view.getByLabelText('calendar_anchor_open_scene'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigateToEntity).toHaveBeenCalledWith('Scene', 'scene-1');
  });

  it('confirms the pending change', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <CalendarAnchorsModal
        visible
        calendarName="Imperial"
        definition={definition}
        comparisonDefinition={comparison}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    await act(async () => {
      view.getByTestId('calendar_change_confirm').props.onPress();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
