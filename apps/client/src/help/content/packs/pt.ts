import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'packs',
  title: 'Pacotes',
  summary:
    'Reaproveite a estrutura de uma história — campos, catálogos, status e etiquetas — numa história nova.',
  keywords: ['pacote', 'modelo', 'template', 'reaproveitar', 'estrutura'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Um pacote é a parte reaproveitável de uma história: os atributos customizados que você definiu, os catálogos de sugestão que salvou, os status e suas escadas, e as etiquetas. Não leva personagens, cenas, locais nem qualquer outro elemento — um pacote é a forma de uma história, nunca o conteúdo dela.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você passou uma noite montando seis status com uma escada de 3 a 18, e um conjunto de campos para cada personagem. A próxima campanha deveria começar com tudo isso pronto, sem copiar nada na mão.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    { type: 'heading', level: 3, text: 'Criando um' },
    { type: 'path', segments: ['Menu principal', 'Pacotes', 'Criar um pacote'] },
    {
      type: 'steps',
      items: [
        'Escolha a história de onde tirar a estrutura.',
        'Ligue o que deve ir junto: atributos customizados, etiquetas, status, catálogos de sugestão.',
        'Dê um nome. O idioma e o autor vêm preenchidos daquela história e podem ser trocados.',
        'Salve. O pacote fica neste aparelho e pode ser usado por qualquer história nova.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Não existe editor de pacote, de propósito: um pacote é feito de uma história, então tudo nele é editado onde já mora. Para mudar um pacote, mude a história e use Extrair de novo — o que sobe a versão do pacote.',
    },
    { type: 'heading', level: 3, text: 'Usando um' },
    { type: 'path', segments: ['Menu principal', 'Histórias', 'Nova história'] },
    {
      type: 'steps',
      items: [
        'Comece a criar uma história normalmente.',
        'Em Pacotes, escolha um ou mais.',
        'Crie a história. Tudo que os pacotes levam já está lá.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Pacotes só são oferecidos enquanto a história está sendo criada. Uma história existente não recebe pacote — a estrutura dela é editada direto, em Atributos Customizados, Status e Etiquetas.',
    },
    { type: 'heading', level: 2, text: 'Quando dois pacotes se contradizem' },
    {
      type: 'paragraph',
      text: 'Algumas coisas não podem existir duas vezes numa história: dois atributos customizados com a mesma identificação no mesmo elemento, duas etiquetas com o mesmo nome, duas escadas de status padrão, ou mais status primários do que o radar aceita. Se os pacotes escolhidos se chocarem, o Keres diz qual antes de criar a história, e nada é criado até você mudar a seleção.',
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O que um pacote traz vira parte comum da história nova desde o primeiro segundo: os campos aparecem nos formulários, as etiquetas nas listas, os status nas telas deles, e todos podem ser editados ou apagados como qualquer outra coisa. Nada registra que um pacote foi usado, e apagar um pacote depois não mexe nas histórias feitas a partir dele.',
    },
    { type: 'seeAlso', pages: ['custom-attributes', 'suggestions', 'tags', 'create-story'] },
  ],
};
export default page;
