import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'effects',
  title: 'Efeitos de uma cena ou escolha',
  summary: 'Registre as mudanças em itens e marcadores causadas por uma cena ou decisão.',
  keywords: ['efeito', 'dar item', 'tirar item', 'marcador', 'inventário'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Efeitos registram uma mudança causada por uma cena ou escolha: dar um item ao leitor, tirar um item, ligar um marcador ou desligá-lo. Eles formam o estado que as condições podem consultar depois.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ao escolher “Pegar a chave”, você adiciona o efeito Dar item e seleciona a chave. A escolha “Abrir o cofre” pode então ser habilitada pela condição de inventário que procura esse item.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra uma cena ou escolha em uma história ramificada e salve-a caso seja nova.',
        'Na seção Efeitos, toque em Adicionar efeito.',
        'Escolha Dar item ou Tirar item e selecione o Item correspondente; ou escolha Ligar marcador ou Desligar marcador e escreva o nome do marcador.',
        'Salve a cena ou escolha. Você pode revisar os efeitos no detalhe dela.',
        'Use a Análise da história para conferir os caminhos que dependem desses efeitos.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Efeitos alimentam o inventário e os marcadores do leitor. As condições de escolha leem essas informações para bloquear ou habilitar caminhos, e o detalhe da cena ou escolha lista os efeitos configurados.',
    },
    { type: 'seeAlso', pages: ['choices', 'scenes', 'choice-conditions', 'story-state'] },
  ],
};

export default page;
