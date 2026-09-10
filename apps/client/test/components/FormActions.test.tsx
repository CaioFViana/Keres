import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import FormActions from '../../src/components/common/controls/FormActions/FormActions';

jest.mock('../../src/hooks/useResponsiveLayout', () => ({
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

import { useResponsiveLayout } from '../../src/hooks/useResponsiveLayout';

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
});
