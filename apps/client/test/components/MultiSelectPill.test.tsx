jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import MultiSelectPill from '../../src/components/common/inputs/MultiSelectPill/MultiSelectPill';

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

describe('MultiSelectPill grouped mode, singleSelect', () => {
  it('opens a single group directly, replaces the selection, and closes after choosing', async () => {
    const onSelectionChange = jest.fn();
    const screen = await render(
      <MultiSelectPill
        groups={groups}
        selectedValues={['atena']}
        onSelectionChange={onSelectionChange}
        placeholder="Choose a character"
        singleSelect
      />,
    );

    await fireEvent.press(screen.getByTestId('multiselect-trigger'));
    expect(screen.getByPlaceholderText('search')).toBeTruthy();
    expect(screen.getByText('Keres')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('multiselect-option-keres'));
    expect(onSelectionChange).toHaveBeenCalledWith(['keres']);
    await waitFor(() => expect(screen.queryByPlaceholderText('search')).toBeNull());
  });

  it('clears the selection when the already selected option is tapped', async () => {
    const onSelectionChange = jest.fn();
    const screen = await render(
      <MultiSelectPill
        groups={groups}
        selectedValues={['atena']}
        onSelectionChange={onSelectionChange}
        placeholder="Choose a character"
        singleSelect
      />,
    );

    await fireEvent.press(screen.getByTestId('multiselect-trigger'));
    await fireEvent.press(screen.getByTestId('multiselect-option-atena'));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});

describe('MultiSelectPill flat mode (options)', () => {
  const options = [
    { label: 'Aventura', value: 'adventure', color: '#f00' },
    { label: 'Mistério', value: 'mystery' },
  ];

  it('skips the group picker (a single synthetic group) and lists options directly', async () => {
    const onSelectionChange = jest.fn();
    const screen = await render(
      <MultiSelectPill
        options={options}
        selectedValues={[]}
        onSelectionChange={onSelectionChange}
        placeholder="Choose tags"
      />,
    );

    await fireEvent.press(screen.getByTestId('multiselect-trigger'));
    expect(screen.getByText('Aventura')).toBeTruthy();
    expect(screen.getByText('Mistério')).toBeTruthy();
  });

  it('toggles multiple selections without closing the modal', async () => {
    const onSelectionChange = jest.fn();
    const screen = await render(
      <MultiSelectPill
        options={options}
        selectedValues={['adventure']}
        onSelectionChange={onSelectionChange}
      />,
    );

    await fireEvent.press(screen.getByTestId('multiselect-trigger'));
    await fireEvent.press(screen.getByTestId('multiselect-option-mystery'));

    expect(onSelectionChange).toHaveBeenCalledWith(['adventure', 'mystery']);
  });

  it('keeps unselected options unavailable after reaching a selection limit', async () => {
    const onSelectionChange = jest.fn();
    const screen = await render(
      <MultiSelectPill
        options={options}
        selectedValues={['adventure']}
        onSelectionChange={onSelectionChange}
        maxSelections={1}
      />,
    );

    await fireEvent.press(screen.getByTestId('multiselect-trigger'));
    await fireEvent.press(screen.getByTestId('multiselect-option-mystery'));

    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
