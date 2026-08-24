import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'mary-sue',
  title: 'Mary Sue',
  summary: 'O personagem sem defeitos, sem nada a aprender, e portanto sem nada a assistir.',
  keywords: [
    'mary sue',
    'gary stu',
    'personagem perfeito',
    'sem defeitos',
    'realizacao de desejo',
    'competencia',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um apelido para o personagem uniformemente competente, admirado por todos, nunca gravemente errado e nunca obrigado a pagar. Elimina a tensão dramática porque os desfechos deixam de estar em dúvida e as escolhas deixam de custar algo.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Como diagnóstico na revisão: pergunte onde esse personagem errou e o que isso custou.',
        'Quando você percebe que os outros personagens existem principalmente para admirar alguém.',
        'Quando o crescimento de poder passou na frente da consequência numa série longa.',
        'De propósito, em formatos de fantasia de poder cujo público quer exatamente isso.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A correção raramente é enfraquecer o personagem. Dê preço à mesma competência: ela acerta o diagnóstico e erra com a família, e é o segundo erro que fica.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Adicionar um defeito cosmético, como desajeitamento, que não custa nada.',
        'Usar o rótulo para descartar personagens competentes, sobretudo mulheres, em vez de diagnosticar um problema estrutural.',
        'Resolver humilhando o personagem em vez de lhe dar algo em jogo.',
      ],
    },
    { type: 'seeAlso', pages: ['character-arc', 'the-wound', 'want-vs-need', 'the-foil'] },
  ],
};
export default page;
