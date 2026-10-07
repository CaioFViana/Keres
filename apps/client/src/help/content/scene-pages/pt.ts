import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'scene-pages',
  title: 'Páginas e quadros',
  summary:
    'Para quadrinhos e storyboards: uma cena guarda páginas (ou quadros), cada uma uma imagem de um Esboço ou da Galeria com seu texto embaixo. O Keres serve para esboçar e planejar, não para arte final.',
  keywords: [
    'página',
    'pagina',
    'páginas',
    'paginas',
    'quadro',
    'quadros',
    'painel',
    'quadrinhos',
    'storyboard',
    'imagem',
    'esboço',
    'esboco',
    'galeria',
    'texto',
    'legenda',
    'ajuste',
    'cortar',
    'preencher',
    'inteira',
    'ordem',
    'mídia removida',
    'midia removida',
    'manuscrito',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Uma cena pode ter quantas páginas quiser, ou quadros num storyboard. Uma página é uma imagem e o texto que vai com ela. A imagem é um Esboço que você desenhou aqui ou uma imagem da Galeria. O texto é o que seria impresso embaixo (ou ao lado) da página, então o desenho não precisa ter os balões preenchidos: pode levar números, e o texto diz o que cada um contém.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'A cena “Impasse na sala do trono” tem três páginas. Cada uma é um esboço do layout, e embaixo de cada uma você escreve quem fala o quê e o que os quadros mostram. Ao compilar o manuscrito, as páginas saem em ordem, cada uma com seu texto.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Defina o meio da obra como Quadrinhos ou Storyboard (configurações do arco). A cena passa a oferecer suas páginas.',
        'Abra a cena, depois as páginas, e adicione uma com +. Escolha um Esboço da história ou uma imagem da Galeria.',
        'Escreva o texto da página embaixo dela e escolha como a imagem fica no quadro.',
        'Use as setas para subir ou descer uma página. Só aquela página muda, então duas pessoas podem reordenar páginas diferentes ao mesmo tempo.',
        'Compile o manuscrito para obter as páginas, em ordem, com seus textos.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'text',
          label: 'Texto',
          whatToWrite:
            'O que acompanha a página: legendas, falas, uma nota sobre o que cada quadro mostra. Texto livre.',
          note: 'Opcional. Impresso embaixo da página no manuscrito.',
        },
        {
          key: 'fit',
          label: 'Ajuste',
          whatToWrite:
            'Inteira (a imagem aparece por completo) ou Preencher (a imagem é cortada, centralizada, para preencher o quadro).',
          note: 'Inteira é o padrão. Preencher nunca altera a imagem em si, só quanto dela aparece.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'Esboços sempre em dia' },
    {
      type: 'paragraph',
      text: 'Uma página que usa um Esboço mostra uma imagem do desenho. Se você editar o Esboço depois, o Keres percebe que a imagem ficou velha e gera outra antes de usá-la numa exportação ou publicação, então a página nunca mostra um desenho antigo.',
    },
    { type: 'heading', level: 2, text: 'Quando a imagem some' },
    {
      type: 'paragraph',
      text: 'Se o Esboço ou a imagem da Galeria for apagado, a página não se perde. Ela fica com o texto e mostra “mídia removida”. Escolha uma imagem para substituir e a página volta a ficar inteira. Até lá, ela fica de fora de qualquer manuscrito que você gerar, e você é avisado de quantas páginas foram.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'O Keres serve para esboçar e planejar. Um Esboço ou uma imagem da Galeria é um rascunho para planejar, não arte final para impressão.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'As páginas pertencem à cena: vão com ela quando você exporta a história ou clona um exemplo, e somem do manuscrito se a cena for apagada. Cada página conta para o limite de itens do seu plano. O texto da própria cena não muda; as páginas ficam ao lado dele.',
    },
  ],
};
export default page;
