import { HelpPage, HelpPageId } from './types';
import { fieldSources } from './fieldSources';

const pt: Record<HelpPageId, [string, string, string[]]> = {
  'what-is-keres': [
    'O que é o Keres',
    'Organize o universo da sua história sem precisar escrever o texto nela.',
    ['começar', 'organizar', 'offline'],
  ],
  'first-story': [
    'Criando sua primeira história',
    'Crie uma história e comece pelo que já conhece.',
    ['nova história', 'primeiros passos'],
  ],
  'how-keres-organizes': [
    'Como o Keres organiza uma história',
    'Entenda capítulos, cenas e os elementos que atravessam a narrativa.',
    ['capítulos', 'cenas', 'organização'],
  ],
  'getting-around': [
    'Navegando pelo app',
    'Conheça os menus e como voltar entre as telas.',
    ['menu', 'navegação'],
  ],
  'lists-and-search': [
    'Listas, busca e filtros',
    'Encontre rapidamente o que você cadastrou.',
    ['buscar', 'filtros', 'favoritos'],
  ],
  'using-this-help': [
    'Como usar esta ajuda',
    'Pesquise ou navegue por assunto para tirar dúvidas.',
    ['ajuda', 'pesquisa'],
  ],
  'story-list': [
    'A lista de histórias',
    'Abra, favorite ou remova suas histórias.',
    ['histórias', 'lista'],
  ],
  'create-story': [
    'Criando e editando uma história',
    'Dê identidade à sua história antes de preenchê-la.',
    ['título', 'autor', 'gênero'],
  ],
  'story-type': [
    'Linear ou ramificada?',
    'Escolha se a leitura segue uma ordem ou oferece caminhos.',
    ['linear', 'ramificada', 'escolhas'],
  ],
  'story-settings': [
    'Configurações da história',
    'Ajuste colaboração, tipo e sincronização da história.',
    ['configurações', 'colaboradores'],
  ],
  'story-dashboard': [
    'O painel da história',
    'Veja um resumo e atalhos para o seu trabalho.',
    ['painel', 'resumo'],
  ],
  'story-analysis': [
    'Análise da história',
    'Use os avisos para encontrar ligações que precisam de atenção.',
    ['análise', 'avisos'],
  ],
  'import-export': [
    'Importar e exportar',
    'Faça backup ou traga uma cópia de outra história.',
    ['backup', 'importar', 'exportar'],
  ],
  'example-stories': [
    'Histórias de exemplo',
    'Instale uma cópia para explorar e adaptar.',
    ['exemplos', 'instalar'],
  ],
  characters: [
    'Personagens',
    'Registre quem move a sua história.',
    ['personagem', 'biografia', 'elenco'],
  ],
  'character-relationships': [
    'Relações entre personagens',
    'Desenhe como os personagens se conectam.',
    ['relações', 'grafo'],
  ],
  chapters: ['Capítulos', 'Agrupe cenas na ordem em que serão lidas.', ['capítulo', 'ordem']],
  scenes: [
    'Cenas',
    'Planeje cada acontecimento, onde ele ocorre e quem participa.',
    ['cena', 'local', 'participantes'],
  ],
  'scene-timing': [
    'Tempo e ritmo das cenas',
    'Registre a passagem e a duração do tempo em cada cena.',
    ['intervalo', 'duração', 'tempo'],
  ],
  locations: ['Locais', 'Descreva os espaços importantes do seu mundo.', ['local', 'lugar']],
  'location-map': [
    'Mapa de locais',
    'Veja lugares dentro de lugares e caminhos entre eles.',
    ['mapa', 'conexões'],
  ],
  items: ['Itens', 'Acompanhe objetos que importam para a narrativa.', ['item', 'objeto']],
  'item-journeys': [
    'Trajetória de itens',
    'Registre por onde um item passou e como mudou.',
    ['trajetória', 'dono', 'estado'],
  ],
  'world-rules': [
    'Regras do mundo',
    'Guarde as regras que mantêm seu universo coerente.',
    ['regras', 'mundo'],
  ],
  notes: ['Notas', 'Anote ideias soltas ou ligadas a um elemento.', ['notas', 'anotações']],
  tags: [
    'Etiquetas',
    'Use etiquetas para reunir elementos por um tema.',
    ['etiquetas', 'tags', 'filtros'],
  ],
  gallery: [
    'Galeria',
    'Importe mídia e use-a em mais de um elemento.',
    ['imagem', 'áudio', 'vídeo'],
  ],
  favorites: [
    'Favoritos',
    'Destaque o que você quer reencontrar rapidamente.',
    ['favoritos', 'marcar'],
  ],
  'branching-basics': [
    'Como funcionam as histórias ramificadas',
    'Permita que escolhas levem a caminhos diferentes.',
    ['ramificada', 'leitor'],
  ],
  choices: [
    'Escolhas',
    'Ligue uma cena a outra por uma decisão do leitor.',
    ['escolha', 'destino'],
  ],
  'story-map': [
    'O mapa da história',
    'Veja os caminhos entre cenas de uma história ramificada.',
    ['mapa', 'grafo'],
  ],
  'choice-conditions': [
    'Condições para uma escolha aparecer',
    'Defina o que precisa acontecer antes de mostrar uma escolha.',
    ['condições', 'inventário', 'marcadores'],
  ],
  effects: [
    'Efeitos de uma cena ou escolha',
    'Registre mudanças que acontecem após uma cena ou escolha.',
    ['efeitos', 'item', 'marcador'],
  ],
  'story-state': [
    'Inventário e marcadores',
    'Acompanhe o que o leitor carrega e o que já aconteceu.',
    ['estado', 'inventário', 'marcadores'],
  ],
  comments: [
    'Comentários',
    'Converse sobre um campo específico com sua equipe.',
    ['comentários', 'revisão'],
  ],
  'see-also': [
    'Veja também',
    'Crie uma ligação livre entre dois elementos relacionados.',
    ['relacionar', 'ligação'],
  ],
  'custom-attributes': [
    'Atributos customizados',
    'Crie campos que fazem sentido para a sua história.',
    ['campos', 'atributos'],
  ],
  suggestions: [
    'Listas de sugestões',
    'Reaproveite valores já usados ao preencher campos.',
    ['sugestões', 'valores'],
  ],
  'app-settings': [
    'Configurações do aplicativo',
    'Ajuste idioma, tema e seu nome local.',
    ['tema', 'idioma'],
  ],
  'what-is-a-server': [
    'O que é um servidor Keres',
    'Sincronize entre aparelhos e escreva junto, se quiser.',
    ['servidor', 'sincronizar'],
  ],
  'add-server': [
    'Cadastrando um servidor',
    'Adicione o servidor ao qual deseja se conectar.',
    ['endereço', 'conta'],
  ],
  'your-profile': [
    'Seu perfil',
    'Escolha como outras pessoas veem você.',
    ['perfil', '@tag', 'avatar'],
  ],
  'change-password': [
    'Trocando a senha',
    'Atualize a senha da sua conta no servidor.',
    ['senha', 'conta'],
  ],
  friends: [
    'Amigos',
    'Conecte-se antes de convidar alguém para colaborar.',
    ['amizades', 'convite'],
  ],
  collaborators: [
    'Escrevendo junto',
    'Convide pessoas e escolha o que cada uma pode fazer.',
    ['colaboradores', 'leitor', 'escritor'],
  ],
  'account-limits': [
    'Limites da conta',
    'Entenda os limites definidos pelo servidor.',
    ['limites', 'espaço'],
  ],
  'sync-basics': [
    'Como a sincronização funciona',
    'Trabalhe offline e envie suas mudanças quando puder.',
    ['sincronização', 'offline'],
  ],
  'sync-conflicts': [
    'Quando aparece um conflito',
    'Escolha qual versão manter ao editar o mesmo campo.',
    ['conflito', 'servidor'],
  ],
  'activity-log': [
    'Histórico de atividade',
    'Veja mudanças registradas em uma história sincronizada.',
    ['histórico', 'criado', 'atualizado'],
  ],
  troubleshooting: [
    'Resolvendo problemas',
    'Encontre caminhos para os problemas mais comuns.',
    ['problemas', 'conexão'],
  ],
  'data-and-backup': [
    'Seus dados e backup',
    'Proteja suas histórias usando exportações.',
    ['dados', 'backup'],
  ],
  glossary: ['Glossário', 'Consulte palavras usadas no aplicativo.', ['termos', 'glossário']],
  faq: ['Perguntas frequentes', 'Respostas rápidas para dúvidas comuns.', ['dúvidas', 'perguntas']],
};
const englishText: Record<string, [string, string]> = {
  'what-is-keres': [
    'What is Keres',
    'Organize your story world without having to write the manuscript in it.',
  ],
  'first-story': [
    'Creating your first story',
    'Create a story and begin with what you already know.',
  ],
  'how-keres-organizes': [
    'How Keres organizes a story',
    'Understand chapters, scenes, and the elements that cross the narrative.',
  ],
  'getting-around': ['Navigating the app', 'Learn the menus and how to return between screens.'],
  'lists-and-search': ['Lists, search and filters', 'Find what you created quickly.'],
  'using-this-help': ['Using this help', 'Search or browse by subject to answer questions.'],
  'story-list': ['The story list', 'Open, favorite, or remove your stories.'],
  'create-story': [
    'Creating and editing a story',
    'Give your story an identity before filling it in.',
  ],
  'story-type': [
    'Linear or branching?',
    'Choose whether reading follows an order or offers paths.',
  ],
  'story-settings': ['Story settings', 'Adjust collaboration, type, and synchronization.'],
  'story-dashboard': ['The story dashboard', 'See a summary and shortcuts for your work.'],
  'story-analysis': ['Story analysis', 'Use warnings to find links that need attention.'],
  'import-export': ['Import and export', 'Make a backup or bring in a copy of another story.'],
  'example-stories': ['Example stories', 'Install a copy to explore and adapt.'],
  characters: ['Characters', 'Record who moves your story forward.'],
  'character-relationships': ['Character relationships', 'Draw how characters connect.'],
  chapters: ['Chapters', 'Group scenes in the order they will be read.'],
  scenes: ['Scenes', 'Plan each event, its location, and its participants.'],
  'scene-timing': ['Scene time and rhythm', 'Record elapsed time and duration for each scene.'],
  locations: ['Locations', 'Describe important places in your world.'],
  'location-map': ['Location map', 'See places inside places and paths between them.'],
  items: ['Items', 'Track objects that matter to the narrative.'],
  'item-journeys': ['Item journeys', 'Record where an item went and how it changed.'],
  'world-rules': ['World rules', 'Keep rules that make your world coherent.'],
  notes: ['Notes', 'Write down loose ideas or ones linked to an element.'],
  tags: ['Tags', 'Use tags to gather elements by theme.'],
  gallery: ['Gallery', 'Import media and use it in more than one element.'],
  favorites: ['Favorites', 'Highlight what you want to find again quickly.'],
  'branching-basics': ['How branching stories work', 'Let choices lead to different paths.'],
  choices: ['Choices', 'Connect one scene to another through a reader decision.'],
  'story-map': ['Story map', 'See paths between scenes in a branching story.'],
  'choice-conditions': [
    'Conditions for a choice',
    'Set what must happen before a choice is shown.',
  ],
  effects: ['Scene or choice effects', 'Record changes that follow a scene or choice.'],
  'story-state': ['Inventory and markers', 'Track what the reader carries and what has happened.'],
  comments: ['Comments', 'Discuss a specific field with your team.'],
  'see-also': ['See also', 'Create a free link between related elements.'],
  'custom-attributes': ['Custom attributes', 'Create fields that make sense for your story.'],
  suggestions: ['Suggestion lists', 'Reuse values already used when filling fields.'],
  'app-settings': ['App settings', 'Adjust language, theme, and your local name.'],
  'what-is-a-server': [
    'What is a Keres server?',
    'Synchronize across devices and write together, if you want to.',
  ],
  'add-server': ['Adding a server', 'Add the server you want to connect to.'],
  'your-profile': ['Your profile', 'Choose how other people see you.'],
  'change-password': ['Changing your password', 'Update your server account password.'],
  friends: ['Friends', 'Connect before inviting someone to collaborate.'],
  collaborators: ['Writing together', 'Invite people and choose what each one can do.'],
  'account-limits': ['Account limits', 'Understand limits set by a server.'],
  'sync-basics': ['How synchronization works', 'Work offline and send changes when you can.'],
  'sync-conflicts': [
    'When a conflict appears',
    'Choose which version to keep after editing the same field.',
  ],
  'activity-log': ['Activity history', 'See changes recorded in a synchronized story.'],
  troubleshooting: ['Solving problems', 'Find paths for common problems.'],
  'data-and-backup': ['Your data and backups', 'Protect stories using exports.'],
  glossary: ['Glossary', 'Look up words used in the app.'],
  faq: ['Frequently asked questions', 'Quick answers to common questions.'],
};
const en = Object.fromEntries(
  Object.entries(pt).map(([id, [, , keywords]]) => [
    id,
    [...(englishText[id] ?? ['Help', 'Help page']), keywords],
  ]),
) as Record<HelpPageId, [string, string, string[]]>;
const labels: Record<string, [string, string]> = {
  title: ['Título', 'Title'],
  type: ['Tipo', 'Type'],
  description: ['Descrição', 'Description'],
  genre: ['Gênero', 'Genre'],
  author: ['Autor', 'Author'],
  language: ['Idioma', 'Language'],
  isFavorite: ['Favorita', 'Favorite'],
  extraNotes: ['Anotações extras', 'Extra notes'],
  theme: ['Tema', 'Theme'],
  name: ['Nome', 'Name'],
  summary: ['Resumo', 'Summary'],
  order: ['Ordem', 'Order'],
  chapter: ['Capítulo', 'Chapter'],
  location: ['Local', 'Location'],
  isStart: ['Cena inicial', 'Start scene'],
  isEnd: ['Cena final', 'End scene'],
  interval: ['Intervalo', 'Interval'],
  duration: ['Duração', 'Duration'],
  category: ['Categoria', 'Category'],
  initialState: ['Estado inicial', 'Initial state'],
  item: ['Item', 'Item'],
  scene: ['Cena', 'Scene'],
  newCharacterOwner: ['Novo dono', 'New owner'],
  newState: ['Novo estado', 'New state'],
  body: ['Corpo', 'Body'],
  color: ['Cor', 'Color'],
  text: ['Texto', 'Text'],
  sourceScene: ['Cena de origem', 'Source scene'],
  destinationScene: ['Cena de destino', 'Destination scene'],
  displayName: ['Nome de exibição', 'Display name'],
  required: ['Obrigatório', 'Required'],
  defaultValue: ['Valor padrão', 'Default value'],
  personality: ['Personalidade', 'Personality'],
  motivation: ['Motivação', 'Motivation'],
  qualities: ['Qualidades', 'Qualities'],
  weaknesses: ['Fraquezas', 'Weaknesses'],
  biography: ['Biografia', 'Biography'],
  plannedTimeline: ['Linha do tempo planejada', 'Planned timeline'],
  gender: ['Gênero', 'Gender'],
  race: ['Raça', 'Race'],
  subrace: ['Sub-raça', 'Subrace'],
  climate: ['Clima', 'Climate'],
  culture: ['Cultura', 'Culture'],
  politics: ['Política', 'Politics'],
};
const startAndStories: Record<string, string[]> = {
  'what-is-keres': [
    'O Keres é um espaço para planejar e conectar o universo da sua narrativa. Ele não substitui o editor onde você escreve capítulos: guarda os fatos, pessoas, lugares e caminhos para que você os encontre depois.',
    'Exemplo: enquanto escreve um romance em outro editor, você pode registrar aqui que Lia perdeu uma chave na cena 3 e descobrir mais tarde onde ela reaparece.',
  ],
  'first-story': [
    'Comece escolhendo um nome que reconheça facilmente. Depois de abrir a história, cadastre apenas o que já sabe: um personagem, um local ou a primeira cena. Você pode completar o restante a qualquer momento.',
    'Caminho: Menu principal › Criar história. Histórias de exemplo são uma forma segura de conhecer o app: ao instalar uma, você recebe uma cópia independente para modificar.',
  ],
  'how-keres-organizes': [
    'Uma história reúne capítulos e cenas. Personagens, locais, itens e regras podem aparecer em várias cenas; etiquetas, notas, comentários e “Veja também” acrescentam camadas de organização sem mudar a narrativa.',
    'Pense em uma cena como “a reunião na estação”; o capítulo decide onde ela entra na leitura, e o local, os participantes e os itens ligam essa cena ao resto do universo.',
  ],
  'getting-around': [
    'Antes de abrir uma história, o menu mostra suas histórias, servidores, amigos, importação, exemplos, configurações e ajuda. Dentro de uma história, o menu muda para mostrar os elementos narrativos e ferramentas daquela história.',
    'Em tela larga o menu fica visível e pode ser redimensionado. No celular, toque no ícone de menu para abri-lo; use Voltar para retornar à tela anterior.',
  ],
  'lists-and-search': [
    'Listas de personagens, cenas e outros elementos usam o mesmo padrão: pesquise pelo texto, filtre por etiqueta, ordene e mostre apenas favoritos quando isso ajudar. A Busca Avançada permite combinar campos; a Busca Global procura na história aberta.',
    'Exemplo: marque os personagens do núcleo principal com a etiqueta “protagonistas”, filtre por ela e favorite os que revisará hoje.',
  ],
  'using-this-help': [
    'Use a busca no topo para procurar palavras do seu jeito — por exemplo, “backup”, “inventário” ou “biografia”. A busca entende letras com ou sem acento e considera títulos, exemplos, campos e perguntas.',
    'Abra uma página para ler o contexto e use “Veja também” quando um assunto levar a outro. Se não encontrar a resposta, tente um sinônimo ou consulte Perguntas frequentes.',
  ],
  'story-list': [
    'Cada cartão representa uma história que existe neste aparelho. Abra-o para trabalhar; a marca de favorito facilita reencontrá-la. Uma história pode estar apenas no aparelho ou ligada a um servidor.',
    'Excluir remove a história da sua lista. Antes de remover algo importante, exporte uma cópia para guardar como backup.',
  ],
  'create-story': [
    'O título é o único campo que você precisa preencher para criar a história. Os demais campos dão contexto para sua organização e para a lista de histórias.',
    'Escolha o tipo antes de começar: uma história linear segue uma sequência; uma ramificada permite escolhas. O tema desta tela é a aparência do aplicativo para esta história, não o assunto narrativo.',
  ],
  'story-type': [
    'Em uma história linear, cenas seguem a organização normal dos capítulos. Em uma história ramificada, o menu Escolhas aparece e uma cena pode levar a mais de um destino.',
    'Você pode converter depois. Ao tentar transformar uma história ramificada em linear, o app mostra antes os capítulos que não podem ser convertidos; nada é alterado antes da sua confirmação.',
  ],
  'story-settings': [
    'As configurações reúnem decisões que valem para a história inteira: tipo, colaboradores, conexão com servidor, comentários de leitores e a normalização do tempo das cenas.',
    'Use esta tela quando a história já existe e você quer mudar sua forma de trabalho sem editar os elementos um a um.',
  ],
  'story-dashboard': [
    'O painel é o ponto de partida dentro de uma história. Os cartões resumem o que já foi cadastrado e oferecem atalhos para telas usadas com frequência.',
    'Os números são contagens: ajudam a perceber, por exemplo, que você criou cenas sem ainda registrar locais ou personagens.',
  ],
  'story-analysis': [
    'A análise procura situações que merecem revisão, como uma cena isolada, uma escolha apontando para uma cena removida ou uma cena final que ainda possui escolhas de saída.',
    'Um aviso não altera a história. Abra o elemento indicado, revise a ligação e salve a correção quando ela fizer sentido para sua narrativa.',
  ],
  'import-export': [
    'Exportar cria uma cópia da história para você guardar ou transferir. Importar sempre cria uma nova história: não substitui a que já está aberta.',
    'Use exportações como backup antes de grandes revisões ou antes de desinstalar o aplicativo. Arquivos muito antigos podem ser recusados se não forem mais compatíveis.',
  ],
  'example-stories': [
    'Histórias de exemplo são material para explorar recursos sem risco para sua obra. Escolha o idioma e instale; a história criada passa a ser sua cópia.',
    'Alterar ou excluir essa cópia não muda o catálogo de exemplos nem afeta histórias de outras pessoas.',
  ],
  characters: [
    'Personagens reúnem o que define cada pessoa da narrativa. Biografia registra o que já aconteceu; Linha do tempo planejada registra o que você pretende que aconteça. Qualidades, fraquezas e personalidade cumprem papéis diferentes e podem coexistir.',
    'Exemplo: descreva “leal” em Qualidades, “impulsiva” em Fraquezas e explique em Personalidade como Lia reage quando é contrariada.',
  ],
  'character-relationships': [
    'Relações ligam dois personagens e descrevem o vínculo entre eles. O mapa de relações ajuda a enxergar grupos isolados e conexões que ainda faltam.',
    'Exemplo: registre “irmãs”, “rival” ou “mentora” entre duas pessoas; abra o mapa para ver como essa ligação aproxima núcleos da história.',
  ],
  chapters: [
    'Capítulos agrupam cenas para a leitura. Ordem é a posição de leitura, não necessariamente a cronologia do mundo: uma história com flashbacks pode usar uma ordem diferente do tempo dos acontecimentos.',
    'Exemplo: coloque o prólogo como ordem 1, mesmo que a cena aconteça anos antes do restante da narrativa.',
  ],
  scenes: [
    'Uma cena registra um acontecimento: onde ocorre, em que capítulo fica e quem participa. O local é obrigatório porque ele conecta o evento ao mapa do seu mundo. Cena inicial e cena final ajudam a analisar caminhos ramificados.',
    'Exemplo: “A chegada à estação” pode ocorrer no capítulo 2, no local Estação Central, com Lia e Omar como participantes.',
  ],
  'scene-timing': [
    'Intervalo é o tempo desde a cena anterior; duração é quanto tempo a própria cena leva. As duas medidas usam unidades de segundos a eras e servem para manter o ritmo coerente.',
    'Exemplo: se a viagem começa dois dias após a reunião e dura três horas, use intervalo de 2 dias e duração de 3 horas. Normalizar tempo reorganiza esses valores em sequência.',
  ],
  locations: [
    'Locais descrevem os espaços do mundo: de uma cidade a uma sala. Clima, cultura e política são pistas para manter descrições e conflitos consistentes.',
    'Exemplo: registre uma cidade portuária com clima úmido, cultura mercante e política dividida entre duas famílias.',
  ],
  'location-map': [
    'O mapa diferencia “contém”, para lugares dentro de outros lugares, de “conectado a”, para caminhos entre dois locais. Uma relação não substitui a outra.',
    'Exemplo: uma sala pode estar contida em um palácio, e o palácio pode estar conectado à praça por uma estrada.',
  ],
  items: [
    'Itens são objetos importantes para a história. Estado inicial descreve como o objeto começa; a trajetória registra mudanças posteriores de estado ou de dono.',
    'Exemplo: uma espada pode começar “quebrada” e passar a “reparada” em uma cena posterior.',
  ],
  'item-journeys': [
    'A trajetória acompanha um item cena a cena. Em cada parada, você pode registrar novo estado, novo dono e anotações que explicam a mudança.',
    'Exemplo: na cena do mercado, a chave muda de Omar para Lia e ganha a anotação “entregue como pagamento”.',
  ],
  'world-rules': [
    'Regras do mundo guardam limites que não podem mudar por conveniência: como funciona uma magia, quem governa um lugar ou o preço de uma viagem.',
    'Exemplo: “teleporte só funciona entre espelhos marcados” evita contradições quando personagens tentam fugir.',
  ],
  notes: [
    'Notas podem ser soltas, para ideias ainda sem lugar, ou vinculadas a um elemento para explicar ou lembrar algo sobre ele.',
    'Exemplo: crie uma nota solta sobre um possível antagonista e conecte-a ao personagem quando ele entrar na história.',
  ],
  tags: [
    'Etiquetas agrupam elementos por uma característica compartilhada e permitem filtrar listas. Elas não substituem uma nota: uma etiqueta é curta e repetível; uma nota explica contexto.',
    'Exemplo: aplique “revisar” a cenas e personagens que precisam de uma segunda leitura.',
  ],
  gallery: [
    'A Galeria guarda imagens, áudios e vídeos usados no universo. Uma mídia importada uma vez pode ilustrar vários elementos; remover uma ligação não apaga a mídia da galeria.',
    'Exemplo: use o mesmo retrato para o personagem e para uma nota sobre sua família, sem importar o arquivo duas vezes.',
  ],
  favorites: [
    'Favoritos destacam itens importantes. Em histórias compartilhadas, o comportamento pode ser global, individual ou individual público, definindo quem vê a marca.',
    'Exemplo: marque uma cena como favorita só para sua revisão pessoal, sem mudar a lista de outra pessoa.',
  ],
  'branching-basics': [
    'Em uma história ramificada, o leitor pode escolher caminhos e chegar a cenas diferentes. O menu Escolhas, o mapa e a análise passam a mostrar essas ligações.',
    'Exemplo: depois da cena “A porta fechada”, o leitor pode entrar no túnel ou voltar à praça; cada decisão aponta para uma cena de destino.',
  ],
  choices: [
    'Uma escolha tem uma cena de origem, um texto que o leitor vê e uma cena de destino. Ela é criada no menu Escolhas e pode receber notas para explicar decisões de roteiro.',
    'Exemplo: origem “A porta fechada”, texto “Entrar no túnel” e destino “Sob a estação”.',
  ],
  'story-map': [
    'O mapa desenha as cenas e as escolhas entre elas. Ele ajuda a encontrar becos sem saída, cenas sem ligação e trechos que não podem ser alcançados a partir da cena inicial.',
    'Exemplo: uma cena sem seta chegando até ela pode precisar de uma escolha de entrada, ou pode ser um trecho deliberadamente separado.',
  ],
  'choice-conditions': [
    'Condições definem quando uma escolha aparece. Um grupo pode exigir todas as condições (E) ou qualquer uma delas (OU). Cada condição pode exigir ou bloquear uma situação.',
    'Exemplo: mostre “Abrir o cofre” somente se o leitor tiver a chave e o marcador “alarme desligado”; ou permita a fuga se ele tiver o mapa ou já visitou a garagem.',
  ],
  effects: [
    'Efeitos registram o que uma cena ou escolha muda: dar ou tirar um item, ligar ou desligar um marcador. Eles são editados dentro da própria cena ou escolha e servem de apoio para analisar a história.',
    'Exemplo: escolher “Pegar a chave” pode adicionar a chave ao inventário e ligar o marcador “cofre descoberto”.',
  ],
  'story-state': [
    'Inventário e marcadores formam o estado do leitor. Efeitos escrevem esse estado; condições o leem para decidir o que pode acontecer em seguida.',
    'Exemplo: uma escolha adiciona o item lanterna; uma escolha posterior só aparece quando a lanterna está no inventário.',
  ],
  comments: [
    'Comentários permitem conversar sobre um campo específico de um elemento, inclusive guardando um trecho citado. Escolha a criticidade para indicar se é uma observação leve ou algo que exige revisão.',
    'Exemplo: comente a Biografia de um personagem para perguntar se uma data combina com a cena em que ele aparece. A lista de comentários reúne as conversas da história.',
  ],
  'see-also': [
    '“Veja também” cria uma ligação livre e mútua entre dois elementos. Use-o para relações que não são uma etiqueta compartilhada nem uma anotação extensa.',
    'Exemplo: conecte uma regra do mundo à cena em que ela se torna importante; abrir qualquer lado mostra o outro.',
  ],
  'custom-attributes': [
    'Atributos customizados permitem criar campos próprios para um tipo de elemento. Você escolhe texto, texto longo, número, sim/não, data ou sugestão; pode definir obrigatoriedade, valor padrão e ordem.',
    'Exemplo: crie “Nível de suspeita” para personagens. O campo aparece no formulário, nos detalhes e nas buscas; o nome pode mudar depois, mas sua identificação permanece a mesma.',
  ],
  suggestions: [
    'Listas de sugestões oferecem valores já usados na história para evitar variações como “Feiticeiro” e “feiticeiro”. Você pode aceitar uma sugestão, digitar outra e administrar a lista.',
    'Exemplo: ao preencher Raça, escolha um valor existente ou escreva um novo; o novo valor fica disponível como sugestão para os próximos personagens.',
  ],
  'app-settings': [
    'As configurações do aplicativo controlam o tema claro ou escuro, o idioma e o nome de usuário local. O tema do aplicativo é visual; o campo Tema de uma história descreve um assunto narrativo.',
    'Exemplo: use o modo escuro para escrever à noite e mantenha “perda e reconciliação” como tema de uma história sem alterar as cores do aplicativo.',
  ],
  'what-is-a-server': [
    'Um servidor Keres é opcional. Ele permite sincronizar histórias entre aparelhos e escrever junto com outras pessoas. Uma história pode ficar somente no aparelho, sem ligação a servidor.',
    'Exemplo: planeje uma história offline no celular; quando quiser usar o computador, envie-a para um servidor que você controla ou utiliza.',
  ],
  'add-server': [
    'Cadastre o endereço fornecido pelo administrador do servidor. Depois, crie uma conta ou entre com uma conta existente; você pode manter mais de um servidor cadastrado.',
    'Exemplo: use o endereço da API informado pelo seu grupo, sem acrescentar caminhos extras ao final, e escolha um nome para reconhecê-lo na lista.',
  ],
  'your-profile': [
    'Seu perfil define como você aparece no servidor. O nome de exibição é legível, a @tag é o identificador que amigos usam para encontrar você, e avatar e bio dão contexto.',
    'Exemplo: escolha “Caio” como nome, @caio-escreve como tag e uma cor de avatar que sua equipe reconheça.',
  ],
  'change-password': [
    'Troque a senha na tela da conta do servidor. Use uma senha nova que você possa guardar com segurança; aparelhos conectados podem precisar entrar novamente.',
    'Exemplo: após suspeitar que uma senha foi exposta, troque-a no servidor e atualize o acesso nos seus outros aparelhos.',
  ],
  friends: [
    'Amizade é o vínculo que permite convidar outra pessoa para colaborar. Você pode enviar, aceitar, recusar ou desfazer um pedido; a outra pessoa vê somente as informações necessárias para o pedido.',
    'Exemplo: procure a @tag de uma revisora, envie um pedido e, após ela aceitar, adicione-a como colaboradora da história.',
  ],
  collaborators: [
    'Colaboradores têm papéis: dono administra a história, escritor altera o conteúdo e leitor consulta. O dono pode adicionar ou remover pessoas e liberar comentários para leitores.',
    'Exemplo: convide uma revisora como leitora e ative comentários de leitores para receber observações sem permitir edição dos elementos.',
  ],
  'account-limits': [
    'O administrador do servidor pode limitar histórias, elementos e espaço de mídia, além de fechar novos cadastros. O app informa quando uma ação ultrapassa um limite.',
    'Exemplo: se não houver espaço para uma imagem, remova mídia que não usa ou peça ao administrador para ampliar o limite.',
  ],
  'sync-basics': [
    'Você pode trabalhar offline e sincronizar depois. Ao ligar uma história local a um servidor, mudanças e mídias são enviadas; mídias também contam no espaço da conta.',
    'Exemplo: registre cenas durante uma viagem sem internet e sincronize quando voltar a conectar-se ao servidor.',
  ],
  'sync-conflicts': [
    'Um conflito aparece quando versões diferentes do mesmo campo precisam de uma decisão. Compare o seu valor com o valor do servidor e escolha qual manter, aceite uma exclusão ou adie.',
    'Exemplo: você muda o nome de um personagem no celular enquanto outra pessoa o muda no computador; a janela mostra ambos os nomes antes de salvar sua escolha.',
  ],
  'activity-log': [
    'O histórico de atividade mostra mudanças registradas em histórias sincronizadas. “Criado em” indica quando algo surgiu; “Atualizado em” indica a última alteração registrada.',
    'Exemplo: abra o detalhe de uma atividade para entender quem alterou uma cena e quando. Uma história somente offline não guarda o mesmo histórico compartilhado.',
  ],
  troubleshooting: [
    'Para problemas de conexão, confira o endereço do servidor e a rede; se a sessão expirou, entre novamente. Para importações recusadas, confira se o arquivo veio de uma exportação compatível.',
    'Se uma mídia não abre, tente importar novamente o arquivo original. Se uma história sumiu da lista, use a busca, confira o servidor correto e procure uma exportação de backup antes de concluir que ela foi removida.',
  ],
  'data-and-backup': [
    'Suas histórias locais ficam neste aparelho. O conteúdo só sai dele quando você liga uma história a um servidor, compartilha uma exportação ou envia mídia para sincronização.',
    'Exporte backups regularmente e guarde-os em um lugar seguro. Desinstalar o aplicativo pode apagar dados locais que não foram exportados ou sincronizados.',
  ],
  glossary: [
    'Cena é um acontecimento; capítulo agrupa cenas; escolha leva o leitor a outro caminho; marcador registra um fato; etiqueta agrupa elementos; colaborador trabalha na mesma história; sincronizar atualiza entre aparelho e servidor.',
    'Abra as páginas de cada assunto para ver exemplos e instruções completas; este glossário é somente um ponto de partida.',
  ],
  faq: [
    'Perguntas frequentes reúnem respostas curtas para dúvidas recorrentes. Para instruções completas, use os links “Veja também” e a busca da ajuda.',
    'Exemplo: “Posso usar o Keres sem servidor?” Sim. “Como protejo uma história?” Exporte uma cópia regularmente e, se quiser, sincronize-a em um servidor.',
  ],
};
function detailedBlocks(id: string, isPt: boolean) {
  const paragraphs = startAndStories[id];
  if (!paragraphs) return [];
  const text = isPt
    ? paragraphs
    : [
        `This page explains how ${id.replace(/-/g, ' ')} fits into planning a story and what changes when you use it.`,
        `Open the matching menu, review the available information, and save your decision. You can return to this page whenever your story changes.`,
      ];
  return [
    {
      type: 'heading' as const,
      text: isPt ? 'O que é e para que serve' : 'What it is and what it is for',
      level: 2 as const,
    },
    { type: 'paragraph' as const, text: text[0] },
    {
      type: 'example' as const,
      title: isPt ? 'Exemplo prático' : 'Practical example',
      text: text[1],
    },
  ];
}
function page(id: HelpPageId, language: string): HelpPage {
  const source = language.startsWith('pt') ? pt : en;
  const [title, summary, keywords] = source[id] ?? pt['what-is-keres'];
  const isPt = language.startsWith('pt');
  const fields = (fieldSources[id] ?? []).map((key) => ({
    key,
    label: labels[key]?.[isPt ? 0 : 1] ?? key,
    whatToWrite: isPt
      ? 'Preencha com a informação que você quer consultar ao planejar.'
      : 'Enter the information you want to consult while planning.',
    note: isPt
      ? 'Pode ser usado na busca e nos detalhes.'
      : 'It can be used in search and details.',
  }));
  return {
    id,
    title,
    summary,
    keywords,
    blocks: [
      { type: 'paragraph', text: summary },
      ...detailedBlocks(id, isPt),
      {
        type: 'heading',
        text: language.startsWith('pt') ? 'Para que serve' : 'What it is for',
        level: 2,
      },
      {
        type: 'example',
        title: language.startsWith('pt') ? 'Exemplo' : 'Example',
        text: language.startsWith('pt')
          ? `Use ${title.toLowerCase()} para manter as decisões da sua narrativa fáceis de encontrar.`
          : `Use ${title} to keep your narrative decisions easy to find.`,
      },
      {
        type: 'heading',
        text: language.startsWith('pt') ? 'Como fazer' : 'How to do it',
        level: 2,
      },
      {
        type: 'steps',
        items: language.startsWith('pt')
          ? [
              'Abra o menu correspondente.',
              'Escolha esta tela.',
              'Preencha ou revise as informações e salve.',
            ]
          : [
              'Open the matching menu.',
              'Choose this screen.',
              'Fill in or review the information and save.',
            ],
      },
      ...(fields.length
        ? [
            {
              type: 'heading' as const,
              text: isPt ? 'Campos da tela' : 'Screen fields',
              level: 2 as const,
            },
            { type: 'fields' as const, rows: fields },
          ]
        : []),
      {
        type: 'callout',
        tone: 'info',
        text: language.startsWith('pt')
          ? 'As mudanças aparecem nos lugares da história que usam esta informação.'
          : 'Changes appear wherever this information is used in the story.',
      },
    ],
  };
}
export const getHelpPage = (id: string, language: string) =>
  pt[id as HelpPageId] ? page(id as HelpPageId, language) : undefined;
export const getHelpPages = (language: string) =>
  Object.keys(pt).map((id) => page(id as HelpPageId, language));
