import { fireEvent, render } from '@testing-library/react-native';
import { FlatList, Text } from 'react-native';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';

/** The Jest setup makes a list's own batched state updates inside `act`, wherever the test is awaiting. */
describe('list state updates', () => {
  it('batches cells on its own timer without an act warning', async () => {
    const data = Array.from({ length: 60 }, (_, index) => ({ id: String(index) }));
    const view = await render(
      <FlatList
        testID="list"
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text>{item.id}</Text>}
      />,
    );

    await withSilencedConsole(['error'], async (spies) => {
      await fireEvent(view.getByTestId('list'), 'contentSizeChange', 300, 3000);
      await fireEvent(view.getByTestId('list'), 'layout', {
        nativeEvent: { layout: { width: 300, height: 400 } },
      });
      // The list's 50 ms batching timer fires while nothing but this wait is going on.
      await new Promise((resolve) => setTimeout(resolve, 120));

      expect(spies.error?.mock.calls.map((call) => String(call[0]).slice(0, 160))).toEqual([]);
    });
    expect(view.getByText('0')).toBeTruthy();
  });
});
