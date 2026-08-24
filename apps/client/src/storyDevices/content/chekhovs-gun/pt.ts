import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'chekhovs-gun',
  title: 'Arma de Tchekhov',
  summary: 'O que você mostra de propósito precisa importar depois, ou não deve ser mostrado.',
  keywords: ['arma de tchekhov', 'economia', 'chekhovs gun', 'plantio', 'promessa', 'detalhe'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um princípio de economia narrativa: um elemento em que a obra para para apontar é lido como promessa. É o destaque, não a mera presença, que cria a dívida. Um rifle descrito na primeira cena deve ser disparado; se não for, descreva outra coisa.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Ao revisar um rascunho cheio de detalhes vívidos que não fazem trabalho nenhum.',
        'Ao plantar a ferramenta, a ferida ou o fato de que uma cena futura vai precisar.',
        'Você quer que o final pareça inevitável em vez de conveniente.',
        'O público está chutando errado porque você destacou as coisas erradas.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Se um capítulo se demora na fechadura quebrada, a fechadura quebrada precisa importar. Se ninguém for usá-la, mencione a porta e siga.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Ler o princípio como proibição de textura; mundos precisam de detalhes que são só textura.',
        'Disparar a arma tão rápido que o público sente a engrenagem.',
        'Plantar de forma tão evidente que a preparação anuncia o pagamento.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['setup-and-payoff', 'foreshadowing', 'red-herring', 'deus-ex-machina'],
    },
  ],
};
export default page;
