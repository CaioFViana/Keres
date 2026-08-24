import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'first-story',
  title: 'Criando sua primeira história',
  summary: 'Saia do primeiro acesso para uma história aberta em poucos passos.',
  keywords: ['nova história', 'primeiros passos', 'exemplo'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'Sua primeira história é o espaço que reúne todas as informações de uma narrativa. Ela começa vazia e pode crescer no seu ritmo.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Para planejar “A Cidade de Vidro”, você pode criar a história, anotar a protagonista e o local da primeira cena hoje; capítulos, regras e itens podem esperar até fazerem sentido.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'path',
      segments: ['Primeiro acesso', 'Nome de usuário local', 'Idioma', 'Prosseguir'],
    },
    {
      type: 'steps',
      items: [
        'Digite um nome de usuário local com pelo menos três caracteres e escolha o idioma.',
        'Na lista de histórias, toque no botão +.',
        'Preencha Título; este é o único campo necessário para criar a história.',
        'Escolha Linear se a leitura tiver uma sequência única ou Ramificada se o leitor puder escolher caminhos.',
        'Toque em Criar história e abra o cartão da história criada.',
        'Se preferir explorar antes, abra Menu › Histórias de exemplo e instale uma cópia no idioma desejado.',
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'O título aparece na lista e nas buscas. O tipo determina se o menu Escolhas estará disponível. A história criada passa a conter seus próprios personagens, locais, capítulos, cenas e demais elementos.',
    },
    { type: 'seeAlso', pages: ['create-story', 'story-type', 'example-stories'] },
  ],
};
export default page;
