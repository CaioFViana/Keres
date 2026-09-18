import { act, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import ServerRecoveryCodesPanel from '../../src/components/features/servers/ServerRecoveryCodesPanel';
import ServerRegistrationFields from '../../src/components/features/servers/ServerRegistrationFields';

jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../src/components/common/forms/FormField/FormField', () => {
  const ReactActual = require('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ label, help, children }: { label: string; help?: string; children: any }) =>
      ReactActual.createElement(
        View,
        null,
        ReactActual.createElement(Text, null, label),
        typeof children === 'function' ? children({}) : children,
        help ? ReactActual.createElement(Text, null, help) : null,
      ),
  };
});

jest.mock('../../src/components/common/inputs/TextInput/TextInput', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, any>) =>
      ReactActual.createElement(View, {
        testID: `input-${String(props.placeholder ?? 'plain')}`,
        ...props,
      }),
  };
});

jest.mock('../../src/components/common/controls/Button/Button', () => {
  const ReactActual = require('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) =>
      ReactActual.createElement(Text, { testID: `button-${String(children)}`, onPress }, children),
  };
});

jest.mock('../../src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
  const ReactActual = require('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      description,
      actions,
      children,
    }: {
      title?: string;
      description?: string;
      actions?: React.ReactNode;
      children: React.ReactNode;
    }) =>
      ReactActual.createElement(
        View,
        { testID: 'form-container' },
        title ? ReactActual.createElement(Text, null, title) : null,
        description ? ReactActual.createElement(Text, null, description) : null,
        actions,
        children,
      ),
  };
});

describe('ServerRecoveryCodesPanel', () => {
  it('shows every code with a way to continue', async () => {
    const onContinue = jest.fn();
    const screen = await render(
      <ServerRecoveryCodesPanel codes={['alpha-1', 'bravo-2']} onContinue={onContinue} />,
    );

    expect(screen.getByText('recovery_codes_title')).toBeTruthy();
    expect(screen.getByText('recovery_codes_warning')).toBeTruthy();
    expect(screen.getByText('alpha-1')).toBeTruthy();
    expect(screen.getByText('bravo-2')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('button-recovery_codes_continue_button'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe('ServerRegistrationFields', () => {
  const fieldsProps = () => ({
    mode: 'login' as const,
    onModeChange: jest.fn(),
    hostedSameOrigin: false,
    serverAddress: '',
    onServerAddressChange: jest.fn(),
    serverName: '',
    onServerNameChange: jest.fn(),
    username: '',
    onUsernameChange: jest.fn(),
    password: '',
    onPasswordChange: jest.fn(),
    confirmPassword: '',
    onConfirmPasswordChange: jest.fn(),
    recoveryCode: '',
    onRecoveryCodeChange: jest.fn(),
    inputStyle: {},
  });

  it('always asks for the address, the name and the username', async () => {
    const screen = await render(<ServerRegistrationFields {...fieldsProps()} />);

    expect(screen.getByText('server_address')).toBeTruthy();
    expect(screen.getByText('server_name_optional')).toBeTruthy();
    expect(screen.getByText('username')).toBeTruthy();
  });

  it('forwards every keystroke to its owner', async () => {
    const props = fieldsProps();
    const screen = await render(<ServerRegistrationFields {...props} />);

    await act(async () => {
      screen
        .getByTestId('input-server_address_placeholder')
        .props.onChangeText('https://a.example');
      screen.getByTestId('input-server_name_placeholder').props.onChangeText('Home');
      screen.getByTestId('input-username_placeholder').props.onChangeText('ada');
      screen.getByTestId('input-password_placeholder').props.onChangeText('s3cret');
    });

    expect(props.onServerAddressChange).toHaveBeenCalledWith('https://a.example');
    expect(props.onServerNameChange).toHaveBeenCalledWith('Home');
    expect(props.onUsernameChange).toHaveBeenCalledWith('ada');
    expect(props.onPasswordChange).toHaveBeenCalledWith('s3cret');
  });

  it('toggles between logging in and registering', async () => {
    const props = fieldsProps();
    const screen = await render(<ServerRegistrationFields {...props} />);

    expect(screen.getByText('log_in')).toBeTruthy();
    expect(screen.getByText('create_account')).toBeTruthy();
    expect(screen.getByText('password')).toBeTruthy();
    expect(screen.queryByText('confirm_new_password')).toBeNull();

    await fireEvent.press(screen.getByText('create_account').parent!);
    expect(props.onModeChange).toHaveBeenCalledWith('register');
  });

  it('asks to confirm the password when registering', async () => {
    const props = fieldsProps();
    const screen = await render(<ServerRegistrationFields {...props} mode="register" />);

    expect(screen.getByText('confirm_new_password')).toBeTruthy();
    expect(screen.queryByText('forgot_password_link')).toBeNull();

    await act(async () => {
      screen.getByTestId('input-confirm_new_password_placeholder').props.onChangeText('s3cret');
    });
    expect(props.onConfirmPasswordChange).toHaveBeenCalledWith('s3cret');
  });

  it('offers the way out to a forgotten password', async () => {
    const props = fieldsProps();
    const screen = await render(<ServerRegistrationFields {...props} />);

    await fireEvent.press(screen.getByText('forgot_password_link').parent!);

    expect(props.onModeChange).toHaveBeenCalledWith('recover');
  });

  it('recovers with a code and a new password, and returns to login', async () => {
    const props = fieldsProps();
    const screen = await render(<ServerRegistrationFields {...props} mode="recover" />);

    expect(screen.getByText('recover_account_description')).toBeTruthy();
    expect(screen.queryByText('log_in')).toBeNull();
    expect(screen.getByText('recovery_code_label')).toBeTruthy();
    expect(screen.getByText('new_password')).toBeTruthy();

    await act(async () => {
      screen.getByTestId('input-recovery_code_placeholder').props.onChangeText('CODE-1');
    });
    expect(props.onRecoveryCodeChange).toHaveBeenCalledWith('CODE-1');

    await fireEvent.press(screen.getByText('back_to_login').parent!);
    expect(props.onModeChange).toHaveBeenCalledWith('login');
  });

  it('locks the address on a same-origin hosted web app', async () => {
    const screen = await render(<ServerRegistrationFields {...fieldsProps()} hostedSameOrigin />);

    expect(screen.getByText('hosted_web_same_origin_notice')).toBeTruthy();
    expect(screen.getByTestId('input-server_address_placeholder').props.editable).toBe(false);
  });

  it('edits an existing server with an optional password rotation', async () => {
    const props = { ...fieldsProps(), serverId: 'server-1' };
    const screen = await render(<ServerRegistrationFields {...props} />);

    expect(screen.queryByText('log_in')).toBeNull();
    expect(screen.queryByText('password')).toBeNull();
    expect(screen.getByText('new_password_optional')).toBeTruthy();
    expect(screen.getByText('change_password_warning')).toBeTruthy();

    await act(async () => {
      screen.getByTestId('input-new_password_placeholder').props.onChangeText('n3w');
    });
    expect(props.onPasswordChange).toHaveBeenCalledWith('n3w');
  });
});
