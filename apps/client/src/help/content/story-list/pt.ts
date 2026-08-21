import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'story-list',
  title: 'A lista de histórias',
  summary: 'Abra, organize e identifique as histórias que existem neste aparelho.',
  keywords: ['histórias', 'favorita', 'servidor', 'excluir'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A lista de histórias é a primeira tela depois da configuração inicial. Cada cartão representa uma história que você pode abrir, editar, favoritar ou excluir.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você mantém “Romance atual” como favorita e deixa “Experimentos” sem marca. Quando voltar ao aplicativo, reconhece a primeira pelo cartão e a abre para continuar o planejamento.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Toque em um cartão para abrir a história.',
        'Toque na estrela para marcar ou desmarcar Favorita.',
        'Toque no lápis para editar os dados da história.',
        'Use o botão + para criar uma nova história.',
        'Abra Menu › Importar e exportar para trazer uma cópia exportada ou guardar um backup.',
        'Ao editar uma história, use Excluir somente quando tiver certeza; exporte antes se quiser conservar uma cópia.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O cartão mostra título, gênero, descrição e, quando houver, o servidor ligado à história. Abrir uma história muda o menu para as ferramentas dela; favoritar muda a marca exibida no cartão.',
    },
    { type: 'seeAlso', pages: ['create-story', 'favorites', 'import-export', 'what-is-a-server'] },
  ],
};
export default page;
