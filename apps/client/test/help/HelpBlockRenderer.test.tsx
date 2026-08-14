import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';
import { HelpBlockRenderer } from '../../src/components/features/help/HelpBlockRenderer/HelpBlockRenderer';

const mockOpenPage = jest.fn();

jest.mock('../../src/theme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      error: '#c00',
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

describe('HelpBlockRenderer', () => {
  beforeEach(() => mockOpenPage.mockClear());

  it('renders every supported block and opens an internal link', async () => {
    const { getByText } = await render(
      <View>
        <HelpBlockRenderer
          block={{ type: 'paragraph', text: 'Parágrafo' }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'heading', level: 2, text: 'Título' }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{
            type: 'fields',
            rows: [{ key: 'name', label: 'Nome', whatToWrite: 'Escreva um nome.' }],
          }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'list', items: ['Item da lista'] }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'steps', items: ['Passo'] }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'path', segments: ['Menu', 'Detalhe'] }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'callout', tone: 'warning', text: 'Atenção' }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'example', title: 'Exemplo', text: 'Uma situação concreta.' }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'table', headers: ['Campo'], rows: [['Valor']] }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'faq', items: [{ question: 'Pergunta?', answer: 'Resposta.' }] }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
        <HelpBlockRenderer
          block={{ type: 'seeAlso', pages: ['characters'] }}
          onOpenPage={mockOpenPage}
          pageTitle={() => 'Destino'}
        />
      </View>,
    );

    for (const text of [
      'Parágrafo',
      'Título',
      'Nome',
      'Atenção',
      'Exemplo',
      'Valor',
      'Pergunta?',
      'Resposta.',
    ]) {
      expect(getByText(text)).toBeTruthy();
    }
    expect(getByText(/Item da lista/)).toBeTruthy();
    expect(getByText(/Passo/)).toBeTruthy();
    expect(getByText(/Destino/)).toBeTruthy();

    await fireEvent.press(getByText(/Destino/));
    expect(mockOpenPage).toHaveBeenCalledWith('characters');
  });
});
