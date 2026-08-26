import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-map',
  title: 'O mapa da história',
  summary: 'Veja as cenas e escolhas de uma história ramificada como um diagrama navegável.',
  keywords: ['mapa', 'diagrama', 'caminho', 'cena inicial', 'cena final', 'escolha'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O Mapa da história desenha cada cena de uma história ramificada e as escolhas que as conectam. Ele ajuda a enxergar bifurcações, retornos de caminho e cenas isoladas sem precisar abrir cada ficha.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você planejou dois caminhos depois da estação. No mapa, as duas setas saem da mesma cena, atravessam cenas diferentes e voltam ao mesmo final. Uma terceira cena sem seta aparece como isolada, mostrando que falta criar uma escolha para alcançá-la.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Escolhas e toque no ícone de mapa no cabeçalho.',
        'Arraste e aproxime ou afaste o diagrama. Use o botão de enquadrar para trazer o mapa inteiro de volta à tela.',
        'Use a legenda: a borda de Cena inicial marca onde o caminho começa; a de Cena final marca seu encerramento; linhas tracejadas indicam retornos de caminho.',
        'Toque em uma cena para ver resumo, tempo, efeitos e escolhas de entrada ou saída. Toque em uma ligação apresentada ali para ir à cena correspondente.',
        'Use o botão de rótulos para mostrar ou ocultar os textos das escolhas e o botão de exportar para gerar uma imagem do mapa.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'O aviso acima do diagrama informa escolhas que apontam para uma cena que não está disponível. Corrija a escolha ou a cena antes de depender desse caminho.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O mapa apenas mostra a estrutura que você criou: editar uma cena ou escolha atualiza o diagrama. Cenas isoladas, finais e caminhos sem ligação também aparecem nos avisos da Análise da história.',
    },
    { type: 'seeAlso', pages: ['branching-basics', 'choices', 'scenes', 'story-analysis'] },
  ],
};

export default page;
