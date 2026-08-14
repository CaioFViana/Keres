import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'activity-log',
  title: 'Histórico de atividade',
  summary: 'Veja mudanças sincronizadas de uma história e quem as realizou.',
  keywords: ['histórico', 'atividade', 'criado em', 'atualizado em'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'O Histórico de atividade reúne alterações registradas para uma história ligada a servidor.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ao revisar uma cena, você vê que uma colaboradora a atualizou ontem e abre o registro para entender a mudança.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Histórico de atividade.',
        'Use a lista para localizar uma criação, edição ou vínculo.',
        'Toque no registro para ver o detalhe e o elemento relacionado.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'Criado em indica quando o elemento surgiu; Atualizado em indica sua última alteração. Uma história apenas local não possui o mesmo histórico compartilhado do servidor.',
    },
    { type: 'seeAlso', pages: ['sync-basics', 'comments', 'collaborators'] },
  ],
};
export default page;
