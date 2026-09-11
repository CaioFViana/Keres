/** @jest-environment node */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import HeaderActions from '../../src/components/common/navigation/HeaderActions/HeaderActions';
jest.mock('../../src/theme', () => ({ useTheme: () => ({ colors: { text: '#123' } }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

it('hides unavailable actions and prevents disabled or busy actions from firing', async () => {
  const onPress = jest.fn();
  const screen = await render(
    <HeaderActions
      actions={[
        { id: 'hidden', icon: 'add', label: 'Hidden', visible: false, onPress },
        { id: 'disabled', icon: 'add', label: 'Disabled', disabled: true, onPress },
        { id: 'busy', icon: 'add', label: 'Busy', busy: true, onPress },
        { id: 'edit', icon: 'pencil-outline', label: 'Edit', onPress },
      ]}
    />,
  );
  expect(screen.queryByLabelText('Hidden')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Disabled'));
  await fireEvent.press(screen.getByLabelText('Busy'));
  expect(onPress).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Edit'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
