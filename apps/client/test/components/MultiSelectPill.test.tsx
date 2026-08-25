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

/**
 * O campo tinha altura variável: cada pílula trazia `marginBottom`, então escolher a primeira
 * opção esticava o campo em 8px e deixava a pílula acima do centro, com a sobra embaixo. Em
 * telas com o campo estreito - a matriz de presença, a de tramas - isso era o suficiente para
 * a barra inteira pular. O espaço agora é `gap` do contêiner.
 */
describe('MultiSelectPill, espaçamento das pílulas', () => {
  const options = [
    { label: 'Atena', value: 'atena' },
    { label: 'Keres', value: 'keres' },
  ];

  /** Estilo do campo, já achatado - é onde moram altura mínima e espaçamento. */
  const triggerStyleOf = (screen: { getByTestId: (id: string) => { props: { style?: unknown } } }) =>
    StyleSheet.flatten(screen.getByTestId('multiselect-trigger').props.style as never) as {
      gap?: number;
      minHeight?: number;
    };

  it('separa as pílulas pelo contêiner, sem margem em cada uma', async () => {
    const screen = await render(
      <MultiSelectPill options={options} selectedValues={['atena']} onSelectionChange={jest.fn()} />,
    );

    expect(triggerStyleOf(screen).gap).toBe(8);

    const pill = StyleSheet.flatten(screen.getByTestId('multiselect-pill-atena').props.style);
    expect(pill.marginBottom).toBeUndefined();
    expect(pill.marginRight).toBeUndefined();
  });

  it('mantém a mesma altura mínima com e sem seleção', async () => {
    const empty = await render(
      <MultiSelectPill options={options} selectedValues={[]} onSelectionChange={jest.fn()} />,
    );
    const filled = await render(
      <MultiSelectPill options={options} selectedValues={['atena']} onSelectionChange={jest.fn()} />,
    );

    expect(triggerStyleOf(filled).minHeight).toBe(triggerStyleOf(empty).minHeight);
    // A altura do conteúdo não pode passar do mínimo: pílula (14px de texto + 10 de padding
    // vertical) somada ao padding do contêiner cabe nos 50px.
    expect(triggerStyleOf(filled).minHeight).toBe(50);
  });
});

/**
 * A lista de opções também mudava de altura: o visto só existia na opção marcada, e como ele
 * é mais alto que o texto, marcar uma opção empurrava as de baixo alguns pixels. O espaço do
 * visto agora existe sempre, marcado ou não.
 */
describe('MultiSelectPill, altura das opções no modal', () => {
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

  it('reserva o espaço do visto na opção marcada e na não marcada', async () => {
    const screen = await render(
      <MultiSelectPill options={options} selectedValues={['atena']} onSelectionChange={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('multiselect-trigger'));
    await waitFor(() => screen.getByTestId('multiselect-option-atena'));

    expect(checkSlotOf(screen, 'atena')).toMatchObject({ width: 24, height: 24 });
    expect(checkSlotOf(screen, 'keres')).toEqual(checkSlotOf(screen, 'atena'));
  });
});
