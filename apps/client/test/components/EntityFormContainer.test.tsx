/** @jest-environment node */
import React, { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import EntityFormContainer from '../../src/components/common/forms/EntityFormContainer/EntityFormContainer';
import DetailContainer from '../../src/components/layout/DetailContainer/DetailContainer';
import Button from '../../src/components/common/controls/Button/Button';
import { useAsyncOperation } from '../../src/hooks/useAsyncOperation';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: { text: '#111', background: '#fff', primary: '#00f', onPrimary: '#fff' },
  }),
}));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: false }),
}));
jest.mock('../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 58,
}));

it('keeps the same input and scroll view mounted while saving and lays out fragment actions individually', async () => {
  let finish!: () => void;
  const save = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  function Form() {
    const [name, setName] = useState('draft');
    const { run, pending } = useAsyncOperation();
    return (
      <EntityFormContainer
        title="Edit"
        actions={
          <>
            <Button
              onPress={() => {
                void run(save);
              }}
              disabled={pending}
            >
              Save
            </Button>
            <Button onPress={() => {}}>Cancel</Button>
          </>
        }
      >
        <TextInput testID="name" value={name} onChangeText={setName} />
      </EntityFormContainer>
    );
  }
  const screen = await render(<Form />);
  const input = screen.getByTestId('name');
  const scroll = screen.container.queryAll((node) => /ScrollView$/.test(node.type))[0];
  await fireEvent.changeText(input, 'updated draft');
  await fireEvent.press(screen.getByText('Save'));
  expect(screen.getByTestId('name')).toBe(input);
  expect(screen.getByTestId('name').props.value).toBe('updated draft');
  expect(screen.container.queryAll((node) => /ScrollView$/.test(node.type))[0]).toBe(scroll);
  expect(screen.container.queryAll((node) => /ScrollView$/.test(node.type))).toHaveLength(1);
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(58);
  const actionWrappers = screen.container
    .queryAll((node) => /View$/.test(node.type))
    .filter((view) => StyleSheet.flatten(view.props.style)?.flexBasis === 0);
  expect(actionWrappers).toHaveLength(2);
  await act(async () => {
    finish();
  });
  expect(screen.getByTestId('name').props.value).toBe('updated draft');
});

it('owns detail bottom clearance and keeps the title and footer inside the single scroll view', async () => {
  const screen = await render(
    <DetailContainer title="Item" footer={<Text>Back</Text>}>
      <Text>Details</Text>
    </DetailContainer>,
  );
  const scroll = screen.container.queryAll((node) => /ScrollView$/.test(node.type))[0];
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(58);
  expect(screen.getByRole('header').props.children).toBe('Item');
  expect(screen.getByText('Back')).toBeTruthy();
});
