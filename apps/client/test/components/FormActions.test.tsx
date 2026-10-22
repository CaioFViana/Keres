import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import FormActions, {
  markActionGroup,
} from '@/src/components/common/controls/FormActions/FormActions';

import { useResponsiveLayout } from '@/src/hooks/ui/useResponsiveLayout';

jest.mock('@/src/hooks/ui/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: jest.fn(() => ({
    width: 390,
    height: 844,
    breakpoint: 'compact',
    isCompact: true,
    isMedium: false,
    isWide: false,
  })),
}));

const mockLayout = useResponsiveLayout as jest.MockedFunction<typeof useResponsiveLayout>;

describe('FormActions equal share', () => {
  beforeEach(() => {
    mockLayout.mockReturnValue({
      width: 390,
      height: 844,
      breakpoint: 'compact',
      isCompact: true,
      isMedium: false,
      isWide: false,
    });
  });

  it('shares the row equally on a compact screen when not stacked', async () => {
    const screen = await render(
      <FormActions>
        <Text>Cancel</Text>
        <Text>Confirm</Text>
      </FormActions>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('form-actions').props.style).flexDirection).toBe(
      'row',
    );
    expect(StyleSheet.flatten(screen.getByTestId('form-action-slot-0').props.style).flexGrow).toBe(
      1,
    );
    expect(StyleSheet.flatten(screen.getByTestId('form-action-slot-1').props.style).flexGrow).toBe(
      1,
    );
  });

  it('stacks on compact when stackOnCompact is set', async () => {
    const screen = await render(
      <FormActions stackOnCompact>
        <Text>Save changes</Text>
        <Text>Delete</Text>
      </FormActions>,
    );

    expect(StyleSheet.flatten(screen.getByTestId('form-actions').props.style).flexDirection).toBe(
      'column',
    );
    expect(
      StyleSheet.flatten(screen.getByTestId('form-action-slot-0').props.style)?.flexGrow,
    ).toBeUndefined();
  });

  it('gives each button of an action group its own slot', async () => {
    const Group = markActionGroup(() => (
      <>
        <Text>Delete</Text>
        <Text>Save</Text>
      </>
    ));
    const Plain = () => (
      <>
        <Text>Delete</Text>
        <Text>Save</Text>
      </>
    );

    const grouped = await render(
      <FormActions stackOnCompact>
        <Group />
      </FormActions>,
    );
    expect(grouped.getByTestId('form-action-slot-0')).toBeTruthy();
    expect(grouped.getByTestId('form-action-slot-1')).toBeTruthy();
    await grouped.unmount();

    // An unmarked component is one child: its buttons share a slot, which is the bug the mark fixes.
    const plain = await render(
      <FormActions stackOnCompact>
        <Plain />
      </FormActions>,
    );
    expect(plain.queryByTestId('form-action-slot-1')).toBeNull();
  });
});
