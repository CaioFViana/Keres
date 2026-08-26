import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'theme-statement',
  title: 'Declaração temática',
  summary: 'O argumento que a obra defende, escrito como uma afirmação discutível.',
  keywords: ['tema', 'declaracao tematica', 'theme statement', 'premissa', 'argumento', 'sentido'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Não um assunto — lealdade, luto — mas uma proposição: lealdade a uma pessoa pode ser deslealdade com todas as outras. Escrita como afirmação, ela pode ser testada pela trama, contrariada por um personagem e respondida pelo final. É ferramenta do autor, e normalmente invisível ao público.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'As subtramas parecem desconexas e você precisa de um critério para mantê-las.',
        'O final está tecnicamente correto e emocionalmente vazio.',
        'Você precisa decidir qual das duas versões de uma cena fica.',
        'Um colaborador pergunta do que é a obra e você responde com a trama.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Assunto: perdão. Afirmação: o perdão oferecido cedo demais protege quem causou o dano. Agora dá para perguntar a cada cena se ela defende, complica ou ignora isso.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Pôr a declaração na boca de um personagem como moral da história.',
        'Escolher uma afirmação indiscutível, o que deixa a obra sem oposição.',
        'Decidir o tema primeiro e obrigar os personagens a servi-lo.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['thematic-mirror', 'want-vs-need', 'motif-and-leitmotif', 'save-the-cat-beat-sheet'],
    },
  ],
};
export default page;
