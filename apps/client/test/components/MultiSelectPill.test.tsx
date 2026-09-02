jest.mock('react-native-safe-area-context', () => ({
  __esModule: true,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
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

it('shows the entity icon beside options that inherit their group appearance', async () => {
  const screen = await render(
    <MultiSelectPill
      groups={[
        {
          key: 'Character',
          label: 'Characters',
          entityType: 'Character',
          options: [{ label: 'Atena', value: 'atena' }],
        },
      ]}
      selectedValues={[]}
      onSelectionChange={jest.fn()}
    />,
  );

  await fireEvent.press(screen.getByTestId('multiselect-trigger'));

  expect(screen.getByTestId('multiselect-option-icon-atena')).toBeTruthy();
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

  it('uses the placeholder as the modal title instead of the generic "Select Tags"', async () => {
    const screen = await render(
      <MultiSelectPill
        options={options}
        selectedValues={[]}
        onSelectionChange={jest.fn()}
        placeholder="Choose tags"
      />,
    );

    await fireEvent.press(screen.getByTestId('multiselect-trigger'));

    expect(screen.queryByText('Select Tags')).toBeNull();
    // The placeholder appears twice: inside the pill and as the modal title (a flat list would
    // otherwise show an empty header).
    expect(screen.getAllByText('Choose tags').length).toBe(2);
  });

  it('renders the label above the pill and as the modal title', async () => {
    const screen = await render(
      <MultiSelectPill
        options={options}
        selectedValues={[]}
        onSelectionChange={jest.fn()}
        placeholder="Choose tags"
        label="World Rule Tags"
      />,
    );

    // The label is a persistent title above the field, before the modal is opened.
    expect(screen.getAllByText('World Rule Tags').length).toBe(1);

    await fireEvent.press(screen.getByTestId('multiselect-trigger'));

    // With the modal open, the label is both above the pill and the modal title.
    expect(screen.getAllByText('World Rule Tags').length).toBe(2);
  });
});

/**
 * The field had a variable height: each pill carried a `marginBottom`, so choosing the first option
 * stretched the field by 8px and left the pill above the centre, with the slack underneath. On screens
 * with a narrow field - the presence matrix, the plot one - that was enough to make the whole bar jump.
 * The spacing is now the container's `gap`.
 */
describe('MultiSelectPill, pill spacing', () => {
  const options = [
    { label: 'Atena', value: 'atena' },
    { label: 'Keres', value: 'keres' },
  ];

  /** The field's style, already flattened - it is where the minimum height and the spacing live. */
  const triggerStyleOf = (screen: {
    getByTestId: (id: string) => { props: { style?: unknown } };
  }) =>
    StyleSheet.flatten(screen.getByTestId('multiselect-trigger').props.style as never) as {
      gap?: number;
      minHeight?: number;
    };

  it('separates the pills through the container, with no margin on each one', async () => {
    const screen = await render(
      <MultiSelectPill
        options={options}
        selectedValues={['atena']}
        onSelectionChange={jest.fn()}
      />,
    );

    expect(triggerStyleOf(screen).gap).toBe(8);

    const pill = StyleSheet.flatten(screen.getByTestId('multiselect-pill-atena').props.style);
    expect(pill.marginBottom).toBeUndefined();
    expect(pill.marginRight).toBeUndefined();
  });

  it('keeps the same minimum height with and without a selection', async () => {
    const empty = await render(
      <MultiSelectPill options={options} selectedValues={[]} onSelectionChange={jest.fn()} />,
    );
    const filled = await render(
      <MultiSelectPill
        options={options}
        selectedValues={['atena']}
        onSelectionChange={jest.fn()}
      />,
    );

    expect(triggerStyleOf(filled).minHeight).toBe(triggerStyleOf(empty).minHeight);
    // The content's height must not exceed the minimum: a pill (14px of text + 10 of vertical padding)
    // plus the container's padding fits within the 50px.
    expect(triggerStyleOf(filled).minHeight).toBe(50);
  });
});

/**
 * The options list also changed height: the check only existed on the ticked option, and since it is
 * taller than the text, ticking an option pushed the ones below it a few pixels down. The check's space
 * now always exists, ticked or not.
 */
describe('MultiSelectPill, option height in the modal', () => {
  const options = [
    { label: 'Atena', value: 'atena' },
    { label: 'Keres', value: 'keres' },
  ];

  const checkSlotOf = (
    screen: { getByTestId: (id: string) => { props: { style?: unknown } } },
    value: string,
  ) =>
    StyleSheet.flatten(screen.getByTestId(`multiselect-check-${value}`).props.style as never) as {
      width?: number;
      height?: number;
    };

  it('reserves the checkmark space on both the selected and the unselected option', async () => {
    const screen = await render(
      <MultiSelectPill
        options={options}
        selectedValues={['atena']}
        onSelectionChange={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByTestId('multiselect-trigger'));
    await waitFor(() => screen.getByTestId('multiselect-option-atena'));

    expect(checkSlotOf(screen, 'atena')).toMatchObject({ width: 24, height: 24 });
    expect(checkSlotOf(screen, 'keres')).toEqual(checkSlotOf(screen, 'atena'));
  });
});
