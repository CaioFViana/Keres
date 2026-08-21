import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'pet-the-dog',
  title: 'Acariciar o cão',
  summary: 'Um momento de humanidade real no vilão ou no anti-herói.',
  keywords: ['acariciar o cao', 'pet the dog', 'vilao', 'humanidade', 'anti heroi', 'complexidade'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma ternura breve e sem esforço vinda de um personagem que o público aprendeu a condenar. Não desculpa nada; encarece a condenação, porque o público precisa segurar os dois fatos ao mesmo tempo.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Um antagonista é eficiente, mas raso.',
        'Você quer o público desconfortável no final, e não satisfeito.',
        'O tema sustenta que o dano vem de pessoas comuns.',
        'Um protagonista anti-herói precisa de um piso sob a crueldade.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O cobrador espera, sem reclamar, enquanto uma senhora procura as chaves. Depois entra no prédio e faz o que veio fazer.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Posicionar de modo que funcione como desculpa para o personagem.',
        'Usar um momento terno para justificar uma redenção não merecida depois.',
        'Fazer o gesto charmoso em vez de humano, o que é bajulação, não complexidade.',
      ],
    },
    { type: 'seeAlso', pages: ['kick-the-dog', 'save-the-cat', 'the-foil', 'mary-sue'] },
  ],
};
export default page;
