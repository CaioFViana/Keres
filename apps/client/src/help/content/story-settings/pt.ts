import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-settings',
  title: 'Configurações da história',
  summary: 'Ajuste decisões que valem para a história inteira.',
  keywords: ['colaboradores', 'servidor', 'comentários', 'tempo', 'favoritos'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Configurações da história reúne opções que não pertencem a um único personagem, cena ou capítulo.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Quando a revisão começar, você pode adicionar uma colaboradora como leitora e permitir comentários dela, sem dar permissão para editar cenas.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Configurações da história'] },
    {
      type: 'steps',
      items: [
        'Abra a seção que deseja alterar.',
        'Use Tipo da história para converter entre Linear e Ramificada.',
        'Use Colaboradores para convidar, remover ou ajustar acesso.',
        'Use Enviar para servidor para ligar uma história local a um servidor.',
        'Ative comentários de leitores quando quiser receber observações de leitores.',
        'Use o cartão de preferências de leitura para escolher o comportamento dos favoritos, ligar menções automaticamente e normalizar o tempo das cenas ao exibi-lo.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Essas escolhas podem disponibilizar Escolhas, controlar o que colaboradores veem ou alteram, definir onde a história sincroniza, como favoritos aparecem para a equipe, transformar nomes reconhecidos no texto em links e como as durações das cenas são exibidas.',
    },
    { type: 'seeAlso', pages: ['story-type', 'collaborators', 'sync-basics', 'favorites', 'appearance'] },
  ],
};
export default page;
