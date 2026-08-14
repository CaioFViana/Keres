import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-analysis',
  title: 'Análise da história',
  summary: 'Encontre ligações narrativas que podem precisar de revisão.',
  keywords: ['análise', 'cena isolada', 'escolha quebrada', 'aviso'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A análise verifica a estrutura da história e mostra avisos sobre relações que parecem incompletas ou contraditórias.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Se uma escolha leva a uma cena removida, a análise aponta a escolha para que você escolha outro destino ou a exclua.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'path', segments: ['Menu da história', 'Análise da história'] },
    {
      type: 'steps',
      items: [
        'Abra a análise.',
        'Leia cada aviso e abra o elemento indicado.',
        'Corrija a ligação, a cena, a escolha ou o campo quando a observação fizer sentido.',
        'Volte à análise para conferir o resultado.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Um aviso não muda nada por conta própria. Corrigir o elemento atualiza cenas, escolhas, mapas e buscas que usam essa informação.',
    },
    { type: 'seeAlso', pages: ['scenes', 'choices', 'story-map', 'story-type'] },
  ],
};
export default page;
