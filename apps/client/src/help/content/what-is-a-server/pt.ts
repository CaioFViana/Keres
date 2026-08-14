import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'what-is-a-server',
  title: 'O que é um servidor Keres',
  summary: 'Entenda quando usar um servidor para sincronizar e colaborar.',
  keywords: ['servidor', 'offline', 'sincronizar', 'colaborar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um servidor Keres é um lugar opcional onde uma conta guarda uma cópia sincronizada das histórias. Ele permite trabalhar em mais de um aparelho e compartilhar uma história com colaboradores.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você planeja no notebook sem internet e, mais tarde, o aplicativo sincroniza a história com seu servidor. No celular, entra na mesma conta e continua a revisão. Sem servidor, a história ainda funciona no aparelho onde foi criada.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'No menu principal, abra Servidores.',
        'Cadastre um servidor ou entre em uma conta existente.',
        'Abra uma história e use Configurações da história para enviá-la ao servidor quando quiser sincronizá-la.',
        'Para trabalhar junto, adicione colaboradores à história enviada ao servidor.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Histórias sem servidor continuam locais. Histórias ligadas a um servidor podem sincronizar mídias, mostrar atividade, usar colaboração e exigir resolução de conflitos quando a mesma informação é alterada em lugares diferentes.',
    },
    { type: 'seeAlso', pages: ['add-server', 'sync-basics', 'collaborators', 'data-and-backup'] },
  ],
};
export default page;
