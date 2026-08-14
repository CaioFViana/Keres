import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'branching-basics',
  title: 'Como funcionam as histórias ramificadas',
  summary: 'Conecte cenas por escolhas para planejar caminhos alternativos da narrativa.',
  keywords: ['ramificada', 'caminho', 'escolha', 'mapa', 'leitor', 'final'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma história ramificada organiza cenas como caminhos que se separam e podem se encontrar de novo. Cada escolha parte de uma cena, mostra um texto para o leitor e leva a outra cena.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Depois de “A porta da estação abre”, o leitor pode seguir Mara para o trem ou investigar o corredor. Você cria duas escolhas nessa cena; cada uma leva a uma cena diferente. Mais adiante, os dois caminhos podem voltar a se encontrar na mesma revelação.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Ao criar a história, escolha o Tipo Ramificada. Para uma história existente, abra Menu da história › Configurações da história e altere o tipo, quando a conversão for permitida.',
        'Crie as cenas que representam os momentos da narrativa. Marque uma Cena inicial para indicar por onde um caminho começa.',
        'No Menu da história, abra Escolhas e crie uma escolha: selecione a Cena de origem, escreva o texto que será apresentado e escolha a Cena de destino.',
        'Abra o Mapa da história para conferir os caminhos. Use a Análise da história para encontrar cenas sem ligação ou caminhos que não podem ser alcançados.',
        'Quando o caminho depender do que aconteceu antes, adicione condições e efeitos na escolha ou na cena.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Converter uma história ramificada em linear pode exigir ajustes. Antes de confirmar, leia a lista de capítulos incompatíveis mostrada pelo aplicativo.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O tipo ramificado libera o menu Escolhas e o Mapa da história. As escolhas mudam os caminhos vistos no mapa e os avisos da Análise. Condições e efeitos usam o estado do leitor para decidir quais caminhos ficam disponíveis.',
    },
    {
      type: 'seeAlso',
      pages: ['story-type', 'choices', 'story-map', 'choice-conditions', 'effects', 'story-state'],
    },
  ],
};
export default page;
