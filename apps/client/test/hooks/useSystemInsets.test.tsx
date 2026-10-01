import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useSystemInsets } from '../../src/hooks/useSystemInsets';

function Probe() {
  const insets = useSystemInsets();
  return <Text testID="insets">{JSON.stringify(insets)}</Text>;
}

describe('useSystemInsets', () => {
  it('is all zero where there is no provider (web, tests), instead of throwing', async () => {
    const screen = await render(<Probe />);
    expect(JSON.parse(screen.getByTestId('insets').props.children)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it('reads the system bars from the provider', async () => {
    const screen = await render(
      <SafeAreaInsetsContext.Provider value={{ top: 30, right: 0, bottom: 48, left: 0 }}>
        <Probe />
      </SafeAreaInsetsContext.Provider>,
    );
    expect(JSON.parse(screen.getByTestId('insets').props.children)).toMatchObject({
      top: 30,
      bottom: 48,
    });
  });
});
