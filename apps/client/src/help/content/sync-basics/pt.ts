import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-basics',
  title: 'Como a sincronização funciona',
  summary: 'Trabalhe offline e envie mudanças quando a história estiver ligada a um servidor.',
  keywords: ['sincronizar', 'offline', 'servidor', 'mídia'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Sincronização mantém a cópia local e a cópia de uma história no servidor atualizadas quando há conexão.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você escreve no trem sem internet; ao voltar à rede, as alterações e mídias da história ligada ao servidor são enviadas.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Cadastre um servidor e envie a história em Configurações da história.',
        'Continue trabalhando mesmo offline.',
        'Quando houver conexão, aguarde a sincronização; a lista de servidores mostra a última sincronização.',
        'Resolva um conflito se o aplicativo apresentar a janela correspondente.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Histórias locais não são enviadas por conta própria. Histórias sincronizadas podem aparecer em outros aparelhos, para colaboradores, no histórico e nos limites de mídia da conta.',
    },
    { type: 'seeAlso', pages: ['what-is-a-server', 'sync-conflicts', 'activity-log'] },
  ],
};
export default page;
