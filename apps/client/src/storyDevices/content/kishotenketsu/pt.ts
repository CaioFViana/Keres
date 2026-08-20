import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'kishotenketsu',
  title: 'Kishōtenketsu',
  summary: 'Quatro movimentos que constroem sentido por justaposição, não por conflito.',
  keywords: [
    'kishotenketsu',
    'quatro atos',
    'reviravolta',
    'leste asiatico',
    'sem conflito',
    'ki sho ten ketsu',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma forma tradicional do leste asiático em quatro partes: introdução (ki), desenvolvimento (shō), uma virada que não é causada pelo que veio antes (ten), e uma conclusão que reconcilia as duas coisas (ketsu). A virada é uma mudança de ponto de vista, não uma escalada, e a obra não precisa de antagonista.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Uma peça silenciosa, contemplativa ou de cotidiano, em que o conflito soaria imposto.',
        'Formatos curtos: uma tirinha, uma vinheta, um capítulo isolado.',
        'Você quer que o público faça a síntese em vez de recebê-la pronta.',
        'Você quer sair do hábito de começar pelo conflito e ver o que sobra.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Um homem rega plantas na varanda (ki). Uma vizinha passa a deixar mudas para ele (shō). Em outro ponto da cidade, uma estufa é demolida (ten). O último quadro mostra a varanda lotada de plantas que não tinham para onde ir (ketsu).',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Transformar a virada em reviravolta de trama, o que a converte de volta em conflito.',
        'Explicar a conexão no quarto movimento e matar a síntese.',
        'Achar que sem conflito não há tensão; a tensão está no vão entre as partes.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['three-act-structure', 'thematic-mirror', 'subtext', 'motif-and-leitmotif'],
    },
  ],
};
export default page;
