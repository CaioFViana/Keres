import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import LanguageInstallRow, {
  LANGUAGE_INSTALL_CONTROL_SIZE,
} from '../../src/components/common/controls/LanguageInstallRow/LanguageInstallRow';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#00f',
      onPrimary: '#fff',
      surface: '#fff',
      border: '#ddd',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));

jest.mock('../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    SingleSelectPill: ({
      value,
      onValueChange,
      style,
    }: {
      value: string | null;
      onValueChange: (value: string | null) => void;
      style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
    }) =>
      react.createElement(
        native.TouchableOpacity,
        {
          testID: 'language-select',
          style,
          onPress: () => onValueChange(value === 'en' ? 'pt' : 'en'),
        },
        react.createElement(native.Text, null, value),
      ),
  };
});

describe('LanguageInstallRow', () => {
  it('sizes the install action to the select trigger height', async () => {
    const screen = await render(
      <LanguageInstallRow
        options={[
          { label: 'English', value: 'en' },
          { label: 'Português', value: 'pt' },
        ]}
        value="en"
        onValueChange={jest.fn()}
        onInstall={jest.fn()}
        accessibilityLabel="Install"
        testID="install-action"
      />,
    );

    const buttonStyle = StyleSheet.flatten(screen.getByTestId('install-action').props.style);
    expect(buttonStyle.height).toBe(LANGUAGE_INSTALL_CONTROL_SIZE);
    expect(buttonStyle.width).toBe(LANGUAGE_INSTALL_CONTROL_SIZE);
    expect(LANGUAGE_INSTALL_CONTROL_SIZE).toBe(50);
  });

  it('calls onInstall when the action is pressed', async () => {
    const onInstall = jest.fn();
    const screen = await render(
      <LanguageInstallRow
        options={[{ label: 'English', value: 'en' }]}
        value="en"
        onValueChange={jest.fn()}
        onInstall={onInstall}
        accessibilityLabel="Install"
        testID="install-action"
      />,
    );

    await fireEvent.press(screen.getByTestId('install-action'));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });
});
