import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-state',
  title: 'Inventário e marcadores',
  summary: 'Entenda o que o leitor carrega e quais acontecimentos a história registra.',
  keywords: ['inventário', 'marcador', 'estado do leitor', 'item', 'condição', 'efeito'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O estado do leitor é o conjunto de itens que ele carrega e de marcadores que a história registra, como “falou com Mara” ou “alarme desligado”. Ele é usado para planejar os caminhos de uma história ramificada.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A cena da biblioteca dá a Chave do observatório ao leitor. Depois, a escolha “Abrir o observatório” verifica se a chave está no inventário. Ao conversar com Mara, um marcador pode registrar esse encontro e liberar outra pergunta.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Crie primeiro os Itens que podem ser dados ou tirados durante a história.',
        'Abra uma cena ou escolha salva e, na seção Efeitos, adicione Dar item, Tirar item, Ligar marcador ou Desligar marcador.',
        'Para um marcador, escreva sempre o mesmo nome quando quiser se referir ao mesmo acontecimento, como “conheceu_mara”.',
        'Abra a escolha que depende desse estado e adicione uma Condição de Inventário ou Marcador.',
        'Confira no detalhe e na Análise da história se os caminhos têm os efeitos e condições esperados.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Você não preenche o inventário do leitor em uma lista separada. Ele é descrito pelos efeitos que você coloca nas cenas e escolhas.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Condições de escolha leem o inventário e os marcadores para bloquear ou habilitar opções. Efeitos posteriores podem mudar esse estado de novo, por isso nomes de marcadores consistentes deixam a análise e a revisão mais claras.',
    },
    { type: 'seeAlso', pages: ['items', 'effects', 'choice-conditions', 'choices'] },
  ],
};

export default page;
