import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'cliffhanger',
  title: 'Gancho de suspense',
  summary: 'Cortar no pico da tensão para que o público não consiga parar.',
  keywords: [
    'gancho de suspense',
    'cliffhanger',
    'fim de capitulo',
    'suspense',
    'serializado',
    'em aberto',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Terminar um capítulo, episódio ou cena num momento não resolvido: uma pergunta feita, uma porta abrindo, uma decisão suspensa. Funciona pelo vão entre promessa e resposta, e não custa nada na hora — a conta chega quando a próxima parte precisa justificar a espera.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Publicação seriada, em que o público precisa escolher voltar.',
        'Ao alternar entre tramas paralelas, de modo que a própria interrupção trabalhe.',
        'Um capítulo cumpriu seu percurso, mas a tensão não.',
        'Você quer terminar numa pergunta em vez de num resumo.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'O capítulo acaba quando ela reconhece a letra. O capítulo seguinte abre em outro lugar, e o reconhecimento fica ali, esperando.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Resolver o gancho de forma barata no início da parte seguinte, o que treina desconfiança.',
        'Usar um a cada fim de capítulo até virarem cacoete, e não acontecimento.',
        'Fabricar suspense sonegando o que o personagem de ponto de vista já sabe.',
      ],
    },
    { type: 'seeAlso', pages: ['chapter-hook', 'in-late-out-early', 'ticking-clock', 'pacing'] },
  ],
};
export default page;
