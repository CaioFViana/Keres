import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'comments',
  title: 'Comentários',
  summary: 'Converse sobre um campo específico de uma ficha durante a revisão.',
  keywords: ['comentário', 'revisão', 'crítica', 'trecho', 'equipe'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Comentários são conversas ligadas a um campo visível de uma ficha, como a Biografia de um personagem ou o Texto de uma escolha. Eles guardam a mensagem, o trecho citado e um nível de criticidade.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Na Biografia de Mara, seu colaborador cita a frase “ela abandonou a frota” e escreve que esse fato contradiz uma cena. O comentário continua preso à Biografia, então a revisão chega ao lugar certo.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra o detalhe de um elemento e toque no balão ao lado de um campo que aceita comentários.',
        'Escreva o comentário. Se for útil, informe o trecho a que ele se refere e escolha o nível de criticidade mostrado pelos ícones.',
        'Publique para adicionar a mensagem à conversa daquele campo.',
        'Abra Menu da história › Comentários para ver os comentários da história inteira. Tocar em um deles abre o detalhe do elemento comentado.',
        'O autor do comentário e o dono da história podem gerenciá-lo conforme as permissões disponíveis.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Notas servem para guardar material da história. Comentários servem para conversar sobre uma ficha ou trecho durante a revisão.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O contador no balão mostra quantos comentários existem no campo, e a lista Comentários reúne todas as conversas da história. Em histórias compartilhadas, a possibilidade de comentar depende das permissões e da opção de permitir comentários de leitores.',
    },
    { type: 'seeAlso', pages: ['notes', 'collaborators', 'story-settings', 'activity-log'] },
  ],
};

export default page;
