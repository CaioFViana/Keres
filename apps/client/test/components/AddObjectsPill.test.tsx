import { act, render } from '@testing-library/react-native';
import AddObjectsPill from '../../src/components/features/graphs/CanvasOverlay/AddObjectsPill';

if (!(global as any).requestAnimationFrame) {
  (global as any).requestAnimationFrame = (cb: () => void) => {
    cb();
    return 0;
  };
}

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

// Captures the pill props (groups, trigger) instead of rendering the modal.
jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const RN = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <RN.View testID="objects-pill" {...props} />,
  };
});

describe('AddObjectsPill', () => {
  it('builds the groups and routes actions once', async () => {
    const onAction = jest.fn();
    const view = await render(<AddObjectsPill includeNote onAction={onAction} />);

    const pill = view.getByTestId('objects-pill');
    const groups = pill.props.groups as { key: string; options: { value: string }[] }[];
    expect(groups.map((group) => group.key)).toEqual(['note', 'draw', 'presets', 'stamp', 'select']);
    expect(
      groups.find((group) => group.key === 'draw')?.options.map((option) => option.value),
    ).toContain('draw:line');

    await act(async () => {
      (pill.props.onSelectionChange as (values: string[]) => void)(['draw:line']);
    });
    expect(onAction).toHaveBeenCalledWith('draw:line');
  });

  it('drops the note group on maps and forwards the trigger', async () => {
    const { Text, TouchableOpacity } = jest.requireActual('react-native');
    const onAction = jest.fn();
    const trigger = jest.fn((open: () => void) => (
      <TouchableOpacity testID="objects-trigger" onPress={open}>
        <Text>icon</Text>
      </TouchableOpacity>
    ));
    const view = await render(
      <AddObjectsPill includeNote={false} onAction={onAction} trigger={trigger} />,
    );

    const pill = view.getByTestId('objects-pill');
    const groups = pill.props.groups as { key: string }[];
    expect(groups.map((group) => group.key)).not.toContain('note');
    expect(pill.props.trigger).toBe(trigger);
  });
});
