import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'unreliable-narrator',
  title: 'Narrador não confiável',
  summary: 'Um narrador que o público aprende a ler na contramão.',
  keywords: [
    'narrador nao confiavel',
    'unreliable narrator',
    'vies',
    'autoengano',
    'reviravolta',
    'depoimento',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma voz narrativa cujo relato não pode ser tomado ao pé da letra, por autoengano, compreensão limitada ou mentira deliberada. A obra precisa dar ao público evidência suficiente para enxergar além da narração sem nunca sair dela.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'O assunto é negação, memória, culpa ou justificativa.',
        'Você quer o público investigando o próprio ato de contar.',
        'Um personagem se explicando revela mais do que os acontecimentos.',
        'Formatos de depoimento, diário, confissão ou entrevista.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ele insiste que a discussão foi pequena e menciona, duas vezes, que os vizinhos não chamaram ninguém. É na segunda menção que o público vira.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Revelar a falta de confiabilidade só no fim, sem evidência para reler.',
        'Mentir ao público sobre fatos que a narração não tinha motivo para distorcer.',
        'Tanta falta de confiabilidade que nada se estabelece e nada fica em jogo.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['point-of-view', 'frame-story', 'dramatic-irony', 'narrative-voice'],
    },
  ],
};
export default page;
