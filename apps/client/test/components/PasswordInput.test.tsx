/**
 * @jest-environment jsdom
 */
const mockColors = {
  primary: '#0000ff',
  primaryVariant: '#0000aa',
  primaryContainer: '#e0e0ff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  secondaryVariant: '#008800',
  onPrimary: '#ffffff',
  onSecondary: '#ffffff',
  onBackground: '#111111',
  onSurface: '#111111',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  surface: '#f5f5f5',
  card: '#fafafa',
  border: '#cccccc',
  error: '#ff0000',
  onError: '#ffffff',
  accent: '#ff8800',
  onAccent: '#000000',
  notification: '#00aaff',
  onNotification: '#000000',
  star: '#ffcc00',
  shadow: '#000000',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text> };
});
jest.mock('../../src/theme', () => {
  const actual = jest.requireActual('../../src/theme');
  return { ...actual, useTheme: () => ({ isDarkMode: false, colors: mockColors }) };
});

import { fireEvent, render } from '@testing-library/react-native';
import PasswordInput from '../../src/components/common/inputs/PasswordInput/PasswordInput';

describe('PasswordInput', () => {
  it('hides what is typed, and shows it only while the eye is on', async () => {
    const view = await render(
      <PasswordInput value="secret" onChangeText={jest.fn()} placeholder="Password" />,
    );
    const field = () => view.getByPlaceholderText('Password');

    expect(field().props.secureTextEntry).toBe(true);
    expect(view.getByTestId('icon-eye-outline')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('show_password'));
    expect(field().props.secureTextEntry).toBe(false);
    expect(view.getByTestId('icon-eye-off-outline')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('hide_password'));
    expect(field().props.secureTextEntry).toBe(true);
  });

  it('passes what is typed on, and never capitalises or corrects a password', async () => {
    const onChangeText = jest.fn();
    const view = await render(
      <PasswordInput value="" onChangeText={onChangeText} placeholder="Password" />,
    );
    const field = view.getByPlaceholderText('Password');

    await fireEvent.changeText(field, 'hunter2');

    expect(onChangeText).toHaveBeenCalledWith('hunter2');
    expect(field.props.autoCapitalize).toBe('none');
    expect(field.props.autoCorrect).toBe(false);
  });

  it('keeps the accessibility props a form field hands it', async () => {
    const view = await render(
      <PasswordInput value="" onChangeText={jest.fn()} accessibilityLabel="Your password" />,
    );

    expect(view.getByLabelText('Your password')).toBeTruthy();
  });
});
