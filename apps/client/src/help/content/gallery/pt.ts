import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'gallery',
  title: 'Galeria',
  summary: 'Importe imagens, áudios e vídeos e vincule-os aos elementos da história.',
  keywords: ['imagem', 'áudio', 'vídeo', 'mídia', 'anexo', 'galeria'],
  blocks: [
    { type: 'heading', level: 2, text: 'O que é' },
    {
      type: 'paragraph',
      text: 'A Galeria é a biblioteca de imagens, áudios e vídeos da história. Cada arquivo fica guardado uma vez e pode ser ligado a personagens, cenas, locais, itens e notas.',
    },
    { type: 'heading', level: 2, text: 'Para que serve' },
    {
      type: 'example',
      title: 'Exemplo',
      text: 'Você importou o retrato da capitã Mara. Em vez de importar a mesma imagem outra vez, ligue-a à ficha da Mara e à cena em que ela aparece: as duas mostram a mesma mídia, mas a galeria continua organizada.',
    },
    { type: 'heading', level: 2, text: 'Como fazer' },
    {
      type: 'steps',
      items: [
        'No Menu da história, abra Galeria.',
        'Toque em + e escolha um ou mais arquivos. A galeria aceita imagens, áudios e vídeos compatíveis.',
        'Abra uma mídia para ver ou reproduzir o arquivo, dar um Título e escrever Anotações extras.',
        'Em Entidades vinculadas, escolha onde ela deve aparecer e salve. Também é possível adicionar mídia pela área de galeria de um elemento.',
        'Para tirar uma mídia de um elemento, remova apenas o vínculo na ficha desse elemento. Para apagar o arquivo da história, abra a mídia na Galeria e use Excluir.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'fileName',
          label: 'Arquivo',
          whatToWrite:
            'É o nome do arquivo escolhido. Ele serve para reconhecer a mídia e não é editado nesta tela.',
          note: 'Aparece no detalhe da mídia e ajuda nas buscas e na ordenação da Galeria.',
        },
        {
          key: 'mediaType',
          label: 'Tipo de mídia',
          whatToWrite: 'É informado pelo arquivo importado: imagem, áudio ou vídeo.',
          note: 'Define a miniatura e o visualizador ou reprodutor usado no detalhe.',
        },
        {
          key: 'mimeType',
          label: 'Formato',
          whatToWrite:
            'É o formato técnico detectado no arquivo, como PNG, MP3 ou MP4; você apenas o consulta.',
          note: 'Ajuda a entender por que um arquivo pode não ter prévia disponível.',
        },
        {
          key: 'sizeBytes',
          label: 'Tamanho',
          whatToWrite: 'Mostra quanto espaço o arquivo ocupa; não precisa ser preenchido.',
          note: 'Arquivos maiores ocupam mais espaço quando a história é sincronizada.',
        },
        {
          key: 'title',
          label: 'Título',
          whatToWrite:
            'Dê um nome descritivo, como “Retrato de Mara” ou “Som da estação”. Pode ficar em branco.',
          note: 'Facilita encontrar a mídia na Galeria.',
        },
        {
          key: 'extraNotes',
          label: 'Anotações extras',
          whatToWrite: 'Guarde contexto, crédito ou uma lembrança de onde usar a mídia.',
          note: 'Fica no detalhe da mídia.',
        },
        {
          key: 'linkedEntities',
          label: 'Entidades vinculadas',
          whatToWrite:
            'Escolha os personagens, cenas, locais, itens ou notas que devem mostrar esta mídia.',
          note: 'Remover um vínculo não apaga a mídia da Galeria nem dos outros elementos.',
        },
        {
          key: 'isFavorite',
          label: 'Favorita',
          whatToWrite: 'Marque a estrela para destacar uma mídia importante.',
          note: 'Ela pode ser encontrada pelo filtro de favoritos da Galeria.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'O que isso afeta em outros lugares' },
    {
      type: 'paragraph',
      text: 'As mídias vinculadas aparecem nas fichas dos elementos escolhidos. Remover o vínculo só deixa de exibi-las naquela ficha; excluir pela Galeria remove o arquivo da história. A mídia também entra no espaço usado quando você sincroniza a história com um servidor.',
    },
    { type: 'seeAlso', pages: ['favorites', 'lists-and-search', 'sync-basics', 'data-and-backup'] },
  ],
};
export default page;
