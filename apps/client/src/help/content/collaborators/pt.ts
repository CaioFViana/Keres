import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'collaborators',
  title: 'Escrevendo junto',
  summary: 'Convide amigos para ler ou editar uma história sincronizada.',
  keywords: ['colaborador', 'dono', 'escritor', 'leitor'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Colaboradores são amigos que recebem acesso a uma história enviada a um servidor. O dono controla o acesso; escritores editam; leitores consultam.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você mantém o papel de dono, convida Joana como escritora para preencher cenas e Leo como leitor para acompanhar a revisão.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Envie a história a um servidor e torne-se amigo da pessoa nesse mesmo servidor.',
        'Abra Menu da história › Configurações da história.',
        'Na área de colaboradores, escolha um amigo e o papel desejado.',
        'Para leitores, ative Permitir comentários de leitores se quiser que eles comentem campos.',
        'Remova ou altere o papel quando a colaboração terminar.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Escritores podem alterar o conteúdo conforme o acesso da história; leitores não editam. Comentários, favoritos públicos e sincronização mostram dados dos colaboradores quando os recursos correspondentes estão ativos.',
    },
    { type: 'seeAlso', pages: ['friends', 'comments', 'sync-basics', 'story-settings'] },
  ],
};
export default page;
