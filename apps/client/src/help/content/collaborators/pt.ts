import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'collaborators',
  title: 'Escrevendo junto',
  summary: 'Convide amigos para ler ou editar uma história sincronizada.',
  keywords: ['colaborador', 'dono', 'escritor', 'leitor'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Colaboradores são amigos que aceitaram um convite para uma história enviada a um servidor. O dono controla o acesso; escritores editam; leitores consultam. Nada chega aos dispositivos do amigo antes que ele aceite.',
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
        'Na área de colaboradores, escolha um amigo e o papel desejado e toque em Convidar.',
        'O amigo aceita ou recusa em Amigos; até lá o convite aparece como pendente, e você pode trocar o papel oferecido ou cancelá-lo.',
        'Para leitores, ative Permitir comentários de leitores se quiser que eles comentem campos.',
        'Altere o papel ou remova o colaborador a qualquer momento.',
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
