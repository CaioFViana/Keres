import { render } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import ResponsiveModal from '../../../src/components/layout/ResponsiveModal/ResponsiveModal';

// The avoiding view's own behavior is what is under test: its props are lifted onto a host node.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- mock factories cannot use imports.
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { behavior?: string; enabled?: boolean; children?: React.ReactNode }) =>
      React.createElement(
        View,
        { testID: 'keyboard-avoiding', behaviorProp: props.behavior, enabledProp: props.enabled },
        props.children,
      ),
  };
});
jest.mock('../../../src/theme', () => ({
  useTheme: () => ({ colors: { background: '#fff' } }),
}));
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: true, isWide: false }),
}));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 0,
}));

describe('ResponsiveModal keyboard avoidance', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it.each([
    ['android', 'height'],
    ['ios', 'padding'],
  ] as const)(
    'keeps its usual behavior on %s (%s) unless a modal asks otherwise',
    async (os, expected) => {
      Platform.OS = os;
      const screen = await render(
        <ResponsiveModal visible onClose={() => {}}>
          <Text>search</Text>
        </ResponsiveModal>,
      );

      const avoiding = screen.getByTestId('keyboard-avoiding');
      expect(avoiding.props.behaviorProp).toBe(expected);
      expect(avoiding.props.enabledProp).toBe(true);
    },
  );

  it('pads on Android when a modal asks for it', async () => {
    Platform.OS = 'android';
    const asked = await render(
      <ResponsiveModal visible onClose={() => {}} keyboardBehavior="padding">
        <Text>search</Text>
      </ResponsiveModal>,
    );

    expect(asked.getByTestId('keyboard-avoiding').props.behaviorProp).toBe('padding');
  });

  it('does nothing on the web, and can be switched off by content that avoids the keyboard itself', async () => {
    Platform.OS = 'web';
    const web = await render(
      <ResponsiveModal visible onClose={() => {}}>
        <Text>search</Text>
      </ResponsiveModal>,
    );
    expect(web.getByTestId('keyboard-avoiding').props.behaviorProp).toBeUndefined();

    Platform.OS = 'android';
    const off = await render(
      <ResponsiveModal visible onClose={() => {}} keyboardAvoiding={false}>
        <Text>search</Text>
      </ResponsiveModal>,
    );
    expect(off.getAllByTestId('keyboard-avoiding').at(-1)!.props.enabledProp).toBe(false);
  });
});
