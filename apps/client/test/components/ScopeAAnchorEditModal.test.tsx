import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import React from 'react';
import AnchorEditModal, {
  type AnchorDraft,
} from '../../src/components/features/chapters/AnchorManager/AnchorEditModal';
import type { AnchorSceneChoice } from '../../src/hooks/useChapterAnchors';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
      onPrimaryContainer: '#001',
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

jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: true, isMedium: false, isWide: false }),
}));

// The real surfaces render a native `Modal`, which RNTL cannot see into on this platform.
jest.mock('../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

jest.mock('../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => {
  const actual = jest.requireActual(
    '../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen',
  );
  return {
    __esModule: true,
    ...actual,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
      placeholder,
    }: {
      options: { label: string; value: string }[];
      value: string | null;
      onValueChange: (next: string | null) => void;
      placeholder?: string;
    }) => (
      <RN.View
        testID="single-select-pill"
        options={options}
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
      />
    ),
  };
});

const scenes: AnchorSceneChoice[] = [
  { id: 'scene-1', label: 'Arrival' },
  { id: 'scene-2', label: 'Betrayal' },
];

const emptyDraft: AnchorDraft = {
  startSceneId: null,
  startPosition: 'start',
  startOffset: null,
  startOffsetUnit: null,
  endSceneId: null,
  endPosition: null,
  endOffset: null,
  endOffsetUnit: null,
};

/** Presses the touchable that owns a label (segmented rows have no accessibility labels). */
async function pressText(view: RenderResult, text: string) {
  await fireEvent.press(view.getByText(text));
}

async function setPill(view: RenderResult, index: number, value: string | null) {
  await act(async () => {
    view.getAllByTestId('single-select-pill')[index].props.onValueChange(value);
  });
}

async function pressButton(view: RenderResult, testID: string) {
  await act(async () => {
    view.getByTestId(testID).props.onPress();
  });
}

beforeEach(() => jest.clearAllMocks());

describe('AnchorEditModal', () => {
  it('renders nothing when hidden', async () => {
    const view = await render(
      <AnchorEditModal
        visible={false}
        scenes={scenes}
        hasContents
        allowOpenStretch
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('confirms an open stretch once the start is picked', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <AnchorEditModal
        visible
        scenes={scenes}
        hasContents
        allowOpenStretch
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(view.getByText('anchor_modal_title')).toBeTruthy();
    expect(view.getByText('anchor_mode_open_hint')).toBeTruthy();
    expect(view.getByTestId('confirm-anchor').props.disabled).toBe(true);

    const [startScene] = view.getAllByTestId('single-select-pill');
    expect(startScene.props.options).toEqual([
      { label: 'Arrival', value: 'scene-1' },
      { label: 'Betrayal', value: 'scene-2' },
    ]);

    await setPill(view, 0, 'scene-1');
    expect(view.getByTestId('confirm-anchor').props.disabled).toBe(false);

    await pressButton(view, 'confirm-anchor');
    expect(onConfirm).toHaveBeenCalledWith({
      ...emptyDraft,
      startSceneId: 'scene-1',
      startPosition: 'start',
    });
  });

  it('edits positions through the segmented rows', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <AnchorEditModal
        visible
        scenes={scenes}
        hasContents
        allowOpenStretch
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    await setPill(view, 0, 'scene-1');
    await pressText(view, 'scene_position_middle');
    await pressButton(view, 'confirm-anchor');

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ startSceneId: 'scene-1', startPosition: 'middle' }),
    );
  });

  it('closes the stretch with a defaulted end', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <AnchorEditModal
        visible
        scenes={scenes}
        hasContents
        allowOpenStretch
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    await setPill(view, 0, 'scene-1');
    await pressText(view, 'anchor_mode_closed');

    // The end defaults to the start scene, so the draft stays confirmable.
    expect(view.getByTestId('confirm-anchor').props.disabled).toBe(false);
    await pressButton(view, 'confirm-anchor');
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        startSceneId: 'scene-1',
        endSceneId: 'scene-1',
        endPosition: 'end',
      }),
    );
  });

  it('refuses the open mode when another open stretch exists', async () => {
    const view = await render(
      <AnchorEditModal
        visible
        scenes={scenes}
        hasContents
        allowOpenStretch={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    // TouchableOpacity surfaces `disabled` on the host tree as `accessibilityState`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = view.getByText('anchor_mode_open');
    while (node && node?.props?.accessibilityState?.disabled === undefined) node = node.parent;
    expect(node?.props?.accessibilityState?.disabled).toBe(true);
    // Forced closed without an end: nothing to confirm yet.
    expect(view.getByTestId('confirm-anchor').props.disabled).toBe(true);
  });

  it('restores an existing draft including its distances', async () => {
    const initial: AnchorDraft = {
      ...emptyDraft,
      startSceneId: 'scene-1',
      startPosition: 'middle',
      startOffset: -3,
      startOffsetUnit: 'days',
      endSceneId: 'scene-2',
      endPosition: 'end',
    };
    const view = await render(
      <AnchorEditModal
        visible
        initial={initial}
        scenes={scenes}
        hasContents={false}
        allowOpenStretch
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    // A draft with an end always opens closed.
    const values = view.getAllByTestId('single-select-pill').map((pill) => pill.props.value);
    expect(values).toContain('scene-1');
    expect(values).toContain('scene-2');
    expect(values).toContain('days');
    // The stored distance reopens its editor with the amount prefilled.
    expect(view.getByPlaceholderText('anchor_offset_placeholder').props.value).toBe('3');
    expect(view.getAllByText('anchor_hide_distance')).toHaveLength(1);
  });

  it('records a typed distance with before/after direction', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <AnchorEditModal
        visible
        scenes={scenes}
        hasContents
        allowOpenStretch
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    await setPill(view, 0, 'scene-1');
    await pressText(view, 'anchor_show_distance');
    await fireEvent.changeText(view.getByPlaceholderText('anchor_offset_placeholder'), '2a');
    // Non-digits never reach the draft.
    await fireEvent.changeText(view.getByPlaceholderText('anchor_offset_placeholder'), '2');
    const unitPill = view
      .getAllByTestId('single-select-pill')
      .find((pill) => pill.props.placeholder === 'anchor_offset_unit_placeholder');
    await act(async () => {
      unitPill?.props.onValueChange('weeks');
    });
    await pressText(view, 'anchor_direction_before');
    await pressButton(view, 'confirm-anchor');

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ startOffset: -2, startOffsetUnit: 'weeks' }),
    );
  });

  it('cancels without confirming', async () => {
    const onCancel = jest.fn();
    const view = await render(
      <AnchorEditModal
        visible
        scenes={scenes}
        hasContents
        allowOpenStretch
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />,
    );

    await pressButton(view, 'cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
