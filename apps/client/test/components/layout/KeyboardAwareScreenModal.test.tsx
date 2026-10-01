import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import KeyboardAwareScreen from '../../../src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { KeyboardHandledContext } from '../../../src/hooks/useKeyboardOverlap';

// The avoiding view's `enabled` is what is under test: it is lifted onto a host node.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { enabled?: boolean; children?: React.ReactNode }) =>
      React.createElement(
        View,
        { testID: 'keyboard-avoiding', enabledProp: props.enabled },
        props.children,
      ),
  };
});
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 0,
}));

describe('KeyboardAwareScreen inside a modal that lifts itself', () => {
  it('avoids the keyboard on its own on a screen', async () => {
    const screen = await render(
      <KeyboardAwareScreen>
        <Text>body</Text>
      </KeyboardAwareScreen>,
    );

    expect(screen.getByTestId('keyboard-avoiding').props.enabledProp).toBe(true);
  });

  it('leaves the lifting to the modal, so the keyboard is made room for once', async () => {
    const screen = await render(
      <KeyboardHandledContext.Provider value>
        <KeyboardAwareScreen>
          <Text>body</Text>
        </KeyboardAwareScreen>
      </KeyboardHandledContext.Provider>,
    );

    expect(screen.getByTestId('keyboard-avoiding').props.enabledProp).toBe(false);
  });
});
