import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'flat-arc',
  title: 'Arco plano',
  summary: 'O personagem não muda; o mundo ao redor dele muda.',
  keywords: [
    'arco plano',
    'flat arc',
    'personagem estatico',
    'arco de prova',
    'catalisador',
    'conviccao',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um protagonista que já possui a verdade da história e cuja convicção é testada, não corrigida. A pressão vem de um mundo que pune essa convicção, e a mudança acontece nas pessoas ao redor.',
    },
    { type: 'heading', level: 2, text: 'Quando usar' },
    {
      type: 'list',
      items: [
        'Séries e obras episódicas, em que o protagonista precisa continuar reconhecível.',
        'O tema é integridade sob pressão, e não crescimento.',
        'Você quer que o elenco de apoio carregue a transformação.',
        'Formatos de mistério e procedimento, em que a competência faz parte do prazer.',
      ],
    },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A professora nunca deixa de acreditar que os alunos passam. É desgastada, desfinanciada e duvidada, e no fim quem se moveu foi a escola, não ela.',
    },
    { type: 'heading', level: 2, text: 'Armadilhas' },
    {
      type: 'list',
      items: [
        'Confundir arco plano com personagem sem vida interior.',
        'Nunca testar a convicção, o que a transforma em slogan.',
        'Deixar o mundo também intacto, e então nada aconteceu.',
      ],
    },
    { type: 'seeAlso', pages: ['character-arc', 'the-foil', 'thematic-mirror', 'want-vs-need'] },
  ],
};
export default page;
