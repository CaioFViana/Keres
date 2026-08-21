import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'kick-the-dog',
  title: 'Chutar o cão',
  summary: 'Uma crueldade gratuita que define quem é o antagonista.',
  keywords: ['chutar o cao', 'kick the dog', 'vilao', 'crueldade', 'antagonista', 'apresentacao'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um ato cruel sem benefício estratégico, encenado para que o público pare de conceder o benefício da dúvida. Como evitá-lo não custaria nada ao antagonista, o gesto é lido como caráter, e não como necessidade.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um antagonista vinha sendo abstrato e precisa se tornar pessoal.',
        'Você precisa que o público aceite depois uma resposta dura do protagonista.',
        'O vilão é um sistema, não uma pessoa, e você precisa de um rosto humano para ele.',
        'Um personagem simpático precisa se revelar perigoso.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O locador já ganhou a causa. Na saída, diz à inquilina que o pai dela teria vergonha dela. Não se ganha nada com isso.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Usar tão cedo que o antagonista nunca poderá ser mais que um monstro.',
        'Escalar crueldade em vez de escalar ameaça.',
        'Dirigir a crueldade a um personagem em que a história nunca investiu, e ela não atinge ninguém.',
      ],
    },
    { type: 'seeAlso', pages: ['pet-the-dog', 'save-the-cat', 'the-foil', 'role-reversal'] },
  ],
};
export default page;
