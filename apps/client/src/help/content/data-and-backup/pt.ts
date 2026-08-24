import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'data-and-backup',
  title: 'Seus dados e backup',
  summary: 'Proteja suas histórias com exportações e entenda o que fica no aparelho ou servidor.',
  keywords: ['backup', 'dados', 'exportar', 'desinstalar'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'As histórias ficam guardadas no aparelho. Quando você envia uma história a um servidor, uma cópia dela e de suas mídias pode ser sincronizada para permitir acesso em outros aparelhos e colaboração.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Antes de trocar de aparelho, você exporta uma cópia da história “A Estação” e guarda o arquivo em lugar seguro. Depois pode importá-la como uma história nova.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'No menu principal, abra Importar e exportar.',
        'Escolha a história e exporte uma cópia para um local que você controla.',
        'Para recuperar uma cópia, importe o arquivo; a importação cria uma nova história local.',
        'Antes de redefinir ou desinstalar o aplicativo, exporte as histórias locais que deseja preservar.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Exportar não altera a história original. Desinstalar ou redefinir o aplicativo pode remover os dados locais; uma história sincronizada pode continuar no servidor, mas uma exportação é a forma mais direta de manter uma cópia independente.',
    },
    { type: 'seeAlso', pages: ['import-export', 'sync-basics', 'troubleshooting'] },
  ],
};
export default page;
