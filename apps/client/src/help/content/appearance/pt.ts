import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'appearance',
  title: 'Aparência da história',
  summary: 'Escolha as cores usadas enquanto esta história está aberta.',
  keywords: ['aparência', 'tema', 'cores', 'paleta', 'prévia'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Aparência da história escolhe o tema de cores da história atual. Ele muda as superfícies, controles, gráficos e canvases do app enquanto você trabalha nela; não é o tema narrativo da obra.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Use uma paleta mais fria para uma história ambientada no inverno ou uma de alto contraste quando preferir sua legibilidade. O conteúdo da história permanece exatamente o mesmo.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Personalização', 'Aparência'] },
    {
      type: 'steps',
      items: [
        'Selecione Tema.',
        'Toque em um tema para vê-lo no seletor e nos exemplos de componentes abaixo do ajuste.',
        'Escolha Salvar para torná-lo o tema padrão da história ou feche o seletor para voltar ao tema salvo.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O tema selecionado é salvo com a história e aplicado sempre que ela estiver aberta. Ele não renomeia nem altera elementos da história, não muda o modo escuro do dispositivo e não afeta outra história.',
    },
    { type: 'seeAlso', pages: ['story-settings', 'create-story', 'vocabulary'] },
  ],
};

export default page;
