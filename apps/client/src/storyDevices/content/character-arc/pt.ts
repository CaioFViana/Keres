import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'character-arc',
  title: 'Arco de personagem',
  summary: 'Uma mudança mensurável no que o personagem acredita, mostrada por escolhas.',
  keywords: [
    'arco de personagem',
    'character arc',
    'arco de mudanca',
    'arco positivo',
    'arco negativo',
    'transformacao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A linha entre quem o personagem é no começo e quem é no fim, traçada por decisões e não por declarações. Um arco positivo substitui uma crença falsa por outra mais verdadeira; um arco negativo deixa a crença falsa vencer. O arco só é legível se a mesma situação aparecer duas vezes e for tratada de modo diferente.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Você quer que o final pareça uma conclusão em vez de uma parada.',
        'Uma obra longa precisa de uma medida de progresso que não seja a trama.',
        'Você está montando um elenco coral e cada fio precisa justificar seu tamanho.',
        'Você desconfia que um personagem está sendo empurrado pelos fatos em vez de mudar.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Capítulo um: pedem que ele encubra um colega, e ele aceita para evitar atrito. Capítulo trinta: mesmo pedido, risco maior, e ele diz não na mesma sala, quase com as mesmas palavras.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Anunciar a mudança no diálogo em vez de encená-la numa decisão.',
        'Mudar as circunstâncias em vez do personagem e chamar isso de crescimento.',
        'Impor um arco a um personagem cuja função é permanecer fixo.',
      ],
    },
    { type: 'seeAlso', pages: ['flat-arc', 'want-vs-need', 'the-wound', 'story-circle'] },
  ],
};
export default page;
