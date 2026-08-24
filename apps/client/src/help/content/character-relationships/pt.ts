import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'character-relationships',
  title: 'Relações entre personagens',
  summary: 'Registre vínculos entre pessoas e veja como o elenco se conecta.',
  keywords: ['relação', 'grafo', 'família', 'rivalidade'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Relações ligam dois personagens e descrevem o vínculo entre eles, como parentesco, amizade, rivalidade ou mentoria.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Ao registrar Lia como rival de Omar e mentora de Noa, você pode abrir o mapa e perceber que Noa ainda não se conecta ao restante do elenco.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'Abra Menu da história › Relações de personagens para ver o mapa.',
        'Para criar ou alterar uma relação, abra a ficha de um personagem salvo.',
        'Escolha o outro personagem e informe o tipo de relação.',
        'Salve a ficha e volte ao mapa para conferir a ligação.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'relatedCharacter',
          label: 'Personagem relacionado',
          whatToWrite:
            'Escolha o outro personagem envolvido no vínculo. Não é possível escolher o próprio personagem.',
          note: 'Ao editar, este personagem permanece o mesmo para preservar o vínculo já criado.',
        },
        {
          key: 'relationType',
          label: 'Tipo de relação',
          whatToWrite:
            'Escreva ou escolha o nome do vínculo, como amizade, rivalidade, parentesco ou mentoria.',
          note: 'O valor pode ser sugerido quando já foi usado nesta história.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'A relação aparece nas fichas dos dois personagens e no mapa. Remover uma relação não exclui nenhum personagem nem suas participações em cenas.',
    },
    { type: 'seeAlso', pages: ['characters', 'scenes', 'story-analysis'] },
  ],
};
export default page;
