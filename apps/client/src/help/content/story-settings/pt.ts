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
        'A tela é uma lista de seções. Abra a que deseja alterar; cada seção salva só os próprios campos, então sair de uma sem salvar nunca mexe nas outras.',
        'Geral reúne título, tipo, descrição e Só para adultos (+18). Use Tipo da história para converter entre Linear e Ramificada, e as escolhas de leitura para definir o comportamento dos favoritos, ligar menções automaticamente e normalizar o tempo das cenas ao exibi-lo.',
        'Aparência reúne a capa e o tema da história - veja Aparência.',
        'Vocabulário, Atributos Customizados e Sugestões Padrões abrem as telas que renomeiam os termos da história, acrescentam campos aos elementos e escolhem as sugestões oferecidas.',
        'Servidor e colaboradores liga uma história local a um servidor (Enviar para o Servidor), convida, remove ou ajusta o acesso das pessoas e deixa leitores comentarem. Numa história de outra pessoa, esta seção oferece Sair desta história no lugar disso - veja Escrevendo junto. Uma versão sem servidor não a tem.',
        'Excluir história fica no fim da lista e só é oferecida ao dono da história.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Essas escolhas podem disponibilizar Escolhas, controlar o que colaboradores veem ou alteram, definir onde a história sincroniza, como favoritos aparecem para a equipe, transformar nomes reconhecidos no texto em links e como as durações das cenas são exibidas.',
    },
    {
      type: 'seeAlso',
      pages: ['story-type', 'collaborators', 'sync-basics', 'favorites', 'appearance'],
    },
  ],
};
export default page;
