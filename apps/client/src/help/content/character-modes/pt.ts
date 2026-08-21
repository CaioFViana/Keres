import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'character-modes',
  title: 'Modos de personagem',
  summary: 'Registre as diferentes formas que um personagem assume ao longo da história.',
  keywords: ['modo', 'forma', 'transformação', 'estado', 'personagem'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um modo é uma versão do personagem em algum ponto da história: depois de um treinamento, sob uma maldição, com a armadura. Todo personagem sempre tem o modo normal, e os modos são versões extras ao lado dele.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ilda tem o modo “Na tempestade”, cujas mudanças dizem “perde o medo do mar, esquece o mapa”. Quando a história usa status, esse modo também pode ter valores próprios.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Personagens', 'um personagem', 'Editar'] },
    {
      type: 'steps',
      items: [
        'Abra o personagem e escolha Editar. Modos são criados e editados no formulário, nunca na tela de detalhe.',
        'Em Modos, acrescente um modo com nome e a descrição do que muda.',
        'Salve. O modo aparece no detalhe do personagem e na busca global pelo nome.',
        'Com o sistema de status ligado, o painel do personagem permite alternar entre o modo normal e cada modo.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Nome',
          whatToWrite: 'Como esta forma é reconhecida. Preencha para salvar.',
          note: 'Aparece no seletor de modo e na busca.',
        },
        {
          key: 'modeChanges',
          label: 'O que muda',
          whatToWrite: 'O que é diferente no personagem nesta forma.',
          note: 'Texto livre; nada aqui é interpretado pelo aplicativo.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Modos não dependem do sistema de status e existem em qualquer história. Com status ligado, apagar um modo também remove os valores registrados só para ele; o personagem mantém os valores do modo normal.',
    },
    { type: 'seeAlso', pages: ['characters', 'stats'] },
  ],
};
export default page;
