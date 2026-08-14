import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import GroupedMultiSelectPill from '../../src/components/common/inputs/GroupedMultiSelectPill/GroupedMultiSelectPill';

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ddf',
      surface: '#fff',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const groups = [
  {
    key: 'Character',
    label: 'Characters',
    options: [
      { label: 'Atena', value: 'atena' },
      { label: 'Keres', value: 'keres' },
    ],
  },
];

describe('GroupedMultiSelectPill singleSelect', () => {
  it('opens a single group directly, replaces the selection, and closes after choosing', async () => {
    const onSelectionChange = jest.fn();
    const screen = await render(
      <GroupedMultiSelectPill
        groups={groups}
        selectedValues={['atena']}
        onSelectionChange={onSelectionChange}
        placeholder="Choose a character"
        singleSelect
      />,
    );

    await fireEvent.press(screen.getByTestId('grouped-select-trigger'));
    expect(screen.getByPlaceholderText('search')).toBeTruthy();
    expect(screen.getByText('Keres')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('grouped-select-option-keres'));
    expect(onSelectionChange).toHaveBeenCalledWith(['keres']);
    await waitFor(() => expect(screen.queryByPlaceholderText('search')).toBeNull());
  });

  it('clears the selection when the already selected option is tapped', async () => {
    const onSelectionChange = jest.fn();
    const screen = await render(
      <GroupedMultiSelectPill
        groups={groups}
        selectedValues={['atena']}
        onSelectionChange={onSelectionChange}
        placeholder="Choose a character"
        singleSelect
      />,
    );

    await fireEvent.press(screen.getByTestId('grouped-select-trigger'));
    await fireEvent.press(screen.getByTestId('grouped-select-option-atena'));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});
