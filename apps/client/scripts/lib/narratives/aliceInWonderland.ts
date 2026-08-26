import type { LocalizedNarrative, StoryNarrative } from './types';

const aliceEn: StoryNarrative = {
  chapters: [
    {
      name: 'Nothing Is What It Seems',
      summary:
        'Alice follows something impossible out of boredom and lands somewhere with rules of its own, none of which anybody will explain.',
    },
    {
      name: 'Rules Without Reason',
      summary:
        'Wonderland is not lawless. Its laws are perfectly consistent and completely arbitrary, and Alice is the only person present who finds that worth objecting to.',
    },
    {
      name: "The Queen's Court",
      summary:
        'The Queen sentences first and tries afterwards. Alice can leave the court quietly or say out loud that the whole thing is nonsense, and the two roads end differently.',
    },
  ],
  scenes: [
    {
      name: 'The rabbit hole',
      summary:
        'A white rabbit in a waistcoat takes a watch out of its pocket and says it is late. Alice follows it across a field and down a hole without once considering how she will get back up.',
      location: 0,
    },
    {
      name: 'The hall of little doors',
      summary:
        'She lands in a long hall of locked doors, and behind a curtain finds one fifteen inches high onto the loveliest garden she has ever seen. The key is on a glass table she cannot reach without being smaller, and the door is too small to pass through while she can reach the key.',
      location: 0,
    },
    {
      name: 'Drink me, eat me',
      summary:
        'A bottle marked DRINK ME shrinks her past the key; a cake marked EAT ME sends her to the ceiling. She cries a pool of tears at nine feet tall and nearly drowns in it at three inches.',
      location: 0,
    },
    {
      name: 'The grinning cat',
      summary:
        'The Cheshire Cat appears in a tree by the tail first, and answers every question Alice asks with something true and useless. It tells her that everyone here is mad, including her, and offers to prove it by directions.',
      location: 3,
    },
    {
      name: 'The mad tea party',
      summary:
        "The Hatter and the March Hare are stuck at six o'clock because the Hatter quarrelled with Time, and Time has refused to move for him since. They ask Alice a riddle with no answer and are offended when she asks for one.",
      location: 4,
    },
    {
      name: 'Painting the roses red',
      summary:
        'Three playing cards are painting a white rose bush red before the Queen sees it. They planted the wrong tree, and the punishment for the mistake is worse than the punishment for the fraud, so they are committing the fraud.',
      location: 2,
    },
    {
      name: 'The croquet game',
      summary:
        'The Queen plays croquet with live flamingos for mallets and hedgehogs for balls, on a ground that will not hold still. Nobody keeps score, because everyone is too busy being sentenced to bother finishing a turn.',
      location: 2,
    },
    {
      name: 'A quiet dismissal',
      summary:
        'Alice disagrees with the Queen carefully, in the mildest words she can find. The Queen is annoyed, has nothing specific to charge her with, and lets the matter drop in front of the whole court.',
      location: 1,
    },
    {
      name: 'Off with her head',
      summary:
        'Alice says plainly that the Queen is nothing but a playing card. The Queen screams for her execution, and the court is far more shocked by the observation than by the sentence.',
      location: 1,
    },
    {
      name: 'The trial of the Knave',
      summary:
        'The Knave of Hearts is tried for stealing tarts, with the verdict already written. Alice, growing larger by the minute, points out that the evidence proves nothing, and the King rules that she is out of order.',
      location: 1,
    },
    {
      name: 'Waking on the bank',
      summary:
        "Alice is on the riverbank with her head in her sister's lap and leaves falling on her face. She tells the whole thing as a dream, and cannot decide, in the telling, whether that makes it smaller.",
      location: 0,
    },
    {
      name: 'Staying for the sentence',
      summary:
        'Alice refuses to be dismissed and calls the court what it is: a pack of cards. They rise into the air and come down on her, and she meets them full height, awake, and unafraid.',
      location: 1,
    },
  ],
  startScene: 0,
  finishScenes: [10, 11],
  locations: [
    {
      name: 'Wonderland',
      description:
        'The world on the far side of the rabbit hole. Its rules are perfectly consistent with one another and with nothing else, which is what makes them so difficult to argue against.',
    },
    {
      name: "The Queen of Hearts' Castle",
      description:
        "A castle of painted roses and playing-card servants, where the Queen's word is law for exactly as long as she is in the room and the King quietly reverses it after she leaves.",
    },
    {
      name: 'The Croquet Ground',
      description:
        "The Queen's lawn, played with live flamingos and hedgehogs on ground that moves. Losing politely is as dangerous here as winning, and nobody has ever finished a game.",
    },
    {
      name: "The Duchess's Wood",
      description:
        'The wood between the castle and the tea table, where the Cheshire Cat appears in pieces and gives directions that are entirely accurate and no help whatsoever.',
    },
    {
      name: "The Mad Hatter's House",
      description:
        "Where a tea party goes on without end, always at six o'clock, because the Hatter quarrelled with Time and Time has not moved for him since.",
    },
  ],
  characters: [
    {
      name: 'Alice',
      description:
        'A curious girl who prefers a strange adventure to an ordinary afternoon. She is the only person in Wonderland who keeps expecting things to make sense, and the only one anything is ever explained to.',
    },
    {
      name: 'The White Rabbit',
      description:
        'Always late, always checking his pocket watch, and terrified of the Queen. He is the first impossible thing Alice sees and the reason she is here at all.',
    },
    {
      name: 'The Mad Hatter',
      description:
        'Host of a tea party that never ends, having once been sentenced by the Queen for murdering time. Since then Time has stopped moving for him, which he treats as a scheduling problem.',
    },
    {
      name: 'The Cheshire Cat',
      description:
        'A cat that appears and vanishes at will, in any order it likes, always grinning. It is the only creature in Wonderland that tells Alice the truth, and it is never once useful.',
    },
    {
      name: 'The Queen of Hearts',
      description:
        'A ruler with an explosive temper who orders an execution roughly once a scene. None of them are ever carried out, which nobody tells Alice.',
    },
    {
      name: 'The Knave of Hearts',
      description:
        "Accused of stealing the Queen's tarts and tried on evidence that says nothing at all. He never speaks in his own defence, having grasped earlier than Alice how the court works.",
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 1, 5, 7, 9, 11],
    [4, 9],
    [3, 6, 8],
    [5, 6, 7, 8, 9, 11],
    [9, 11],
  ],
  relations: [
    { pair: [0, 1], type: 'Followed him here' },
    { pair: [0, 2], type: 'Uninvited guest' },
    { pair: [0, 3], type: 'Unhelpful guide' },
    { pair: [0, 4], type: 'Defied her' },
    { pair: [0, 5], type: 'Witness at his trial' },
    { pair: [1, 4], type: 'Her herald' },
    { pair: [2, 4], type: 'Sentenced by her once' },
    { pair: [4, 5], type: 'Accuser' },
  ],
  items: [
    {
      name: 'Bottle labeled "DRINK ME"',
      description:
        'A small bottle on a glass table with a paper label, tasting of cherry tart, custard, pineapple, roast turkey, toffee and hot buttered toast at once. It makes whoever drinks it smaller.',
      category: 'Wonderland object',
      initialState: 'Full, on the glass table',
      owner: null,
      journey: [
        { scene: 1, state: 'Found on the glass table', owner: null },
        { scene: 2, state: 'Drunk down to nothing', owner: 0 },
        { scene: 3, state: 'Empty, and no use at all', owner: 0 },
      ],
    },
    {
      name: 'Cake labeled "EAT ME"',
      description:
        'A very small cake under the glass table with EAT ME marked out on it in currants. It does the opposite of the bottle, and just as suddenly.',
      category: 'Wonderland object',
      initialState: 'Whole, under the table',
      owner: null,
      journey: [
        { scene: 1, state: 'Found under the table', owner: null },
        { scene: 2, state: 'Eaten, to the opposite effect', owner: 0 },
        { scene: 3, state: 'Crumbs in a pocket', owner: 0 },
      ],
    },
    {
      name: "The White Rabbit's Pocket Watch",
      description:
        'The watch the White Rabbit keeps taking out of his waistcoat. It always tells him he is late, and it is the first impossible thing Alice decides is worth following.',
      category: 'Wonderland object',
      initialState: "In the Rabbit's waistcoat",
      owner: 1,
      journey: [
        { scene: 0, state: 'Taken out of a waistcoat', owner: 1 },
        { scene: 5, state: 'Carried into the castle', owner: 1 },
        { scene: 9, state: 'Entered as evidence', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'The Logic of Wonderland',
      description:
        'Wonderland is not lawless. Every rule in it is applied with complete consistency and rests on nothing at all, which is why arguing against one always sounds like the objection of somebody who has missed the point.',
    },
    {
      title: 'Eat Me, Drink Me',
      description:
        'Wonderland is full of food and drink bearing instructions, and the instructions are always honest about what they do and silent about how much. Size here is a thing that happens to Alice rather than a thing she has.',
    },
    {
      title: 'Nobody Is Ever Actually Executed',
      description:
        'The Queen orders a beheading roughly once a scene, and the King quietly pardons every one of them behind her back. The threat is real to Alice and to nobody else, which is what makes the court unbearable rather than dangerous.',
    },
  ],
  notes: [
    {
      title: 'Continuity: what size is she',
      body: 'Alice changes height eight times and it matters in every scene where it happens. Track it explicitly - the trial only works because she is growing while it runs.',
    },
    {
      title: 'Visual motif: instructions on things',
      body: 'Labels, signs, verdicts written before trials. Wonderland keeps telling Alice what to do in writing, and the writing is never wrong and never sufficient.',
    },
    {
      title: 'Revision goal: the branch is a temperament',
      body: 'The two endings turn on one thing: whether Alice says the quiet thing or the loud one. Every choice on the way there should be recognisably the same decision, made smaller.',
    },
  ],
  tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
  choiceLabel: 'Continue toward',
  triggers: { set: 'cat_gave_directions', unset: 'court_has_seen_her' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 1 },
    { type: 'itemTake', item: 1, scene: 2 },
    { type: 'triggerSet', item: null, scene: 3 },
    { type: 'triggerUnset', item: null, scene: 0 },
  ],
};

const alicePt: StoryNarrative = {
  chapters: [
    {
      name: 'Nada É o Que Parece',
      summary:
        'Alice segue algo impossível por tédio e vai parar num lugar com regras próprias, nenhuma das quais alguém se dispõe a explicar.',
    },
    {
      name: 'Regras Sem Razão',
      summary:
        'O País das Maravilhas não é sem lei. Suas leis são perfeitamente coerentes e completamente arbitrárias, e Alice é a única presente que acha isso digno de objeção.',
    },
    {
      name: 'A Corte da Rainha',
      summary:
        'A Rainha sentencia primeiro e julga depois. Alice pode sair da corte em silêncio ou dizer em voz alta que aquilo tudo é um absurdo, e os dois caminhos terminam de formas diferentes.',
    },
  ],
  scenes: [
    {
      name: 'A toca do coelho',
      summary:
        'Um coelho branco de colete tira um relógio do bolso e diz que está atrasado. Alice o segue por um campo e por uma toca abaixo sem cogitar uma única vez como voltará à superfície.',
      location: 0,
    },
    {
      name: 'O salão das portinhas',
      summary:
        'Ela cai num longo salão de portas trancadas e, atrás de uma cortina, encontra uma de quarenta centímetros que dá para o jardim mais bonito que já viu. A chave está numa mesa de vidro que ela não alcança sem ficar menor, e a porta é pequena demais para atravessar enquanto alcança a chave.',
      location: 0,
    },
    {
      name: 'Beba-me, coma-me',
      summary:
        'Uma garrafa marcada BEBA-ME a encolhe para além da chave; um bolo marcado COMA-ME a manda até o teto. Ela chora um lago de lágrimas com quase três metros de altura e quase se afoga nele com sete centímetros.',
      location: 0,
    },
    {
      name: 'O gato que sorri',
      summary:
        'O Gato de Cheshire aparece numa árvore, primeiro pelo rabo, e responde a toda pergunta de Alice com algo verdadeiro e inútil. Diz-lhe que ali todos são loucos, ela inclusive, e se oferece para prová-lo com indicações.',
      location: 3,
    },
    {
      name: 'O chá maluco',
      summary:
        'O Chapeleiro e a Lebre de Março estão presos nas seis horas porque o Chapeleiro brigou com o Tempo, e o Tempo se recusa a andar para ele desde então. Fazem a Alice um enigma sem resposta e se ofendem quando ela pede uma.',
      location: 4,
    },
    {
      name: 'Pintando as rosas de vermelho',
      summary:
        'Três cartas de baralho pintam de vermelho uma roseira branca antes que a Rainha a veja. Plantaram a árvore errada, e o castigo pelo erro é pior que o castigo pela fraude, então estão cometendo a fraude.',
      location: 2,
    },
    {
      name: 'O jogo de croqué',
      summary:
        'A Rainha joga croqué com flamingos vivos por tacos e ouriços por bolas, num gramado que não fica parado. Ninguém marca ponto, porque todos estão ocupados demais sendo sentenciados para terminar uma jogada.',
      location: 2,
    },
    {
      name: 'Uma dispensa discreta',
      summary:
        'Alice discorda da Rainha com cuidado, nas palavras mais brandas que consegue encontrar. A Rainha se irrita, não tem nada de específico de que acusá-la, e deixa o assunto morrer diante da corte inteira.',
      location: 1,
    },
    {
      name: 'Cortem-lhe a cabeça',
      summary:
        'Alice diz com todas as letras que a Rainha não passa de uma carta de baralho. A Rainha grita pela execução dela, e a corte se escandaliza muito mais com a observação do que com a sentença.',
      location: 1,
    },
    {
      name: 'O julgamento do Valete',
      summary:
        'O Valete de Copas é julgado por roubar tortas, com o veredicto já escrito. Alice, crescendo a cada minuto, aponta que a prova não prova nada, e o Rei decide que ela está fora de ordem.',
      location: 1,
    },
    {
      name: 'Acordando na margem',
      summary:
        'Alice está na margem do rio com a cabeça no colo da irmã e folhas caindo no rosto. Conta tudo como um sonho, e não consegue decidir, ao contar, se isso torna aquilo menor.',
      location: 0,
    },
    {
      name: 'Ficando para a sentença',
      summary:
        'Alice se recusa a ser dispensada e chama a corte pelo que ela é: um monte de cartas. Elas se levantam no ar e caem sobre ela, e ela as enfrenta em sua altura inteira, acordada, e sem medo.',
      location: 1,
    },
  ],
  startScene: 0,
  finishScenes: [10, 11],
  locations: [
    {
      name: 'O País das Maravilhas',
      description:
        'O mundo do outro lado da toca do coelho. Suas regras são perfeitamente coerentes entre si e com mais nada, e é isso que torna tão difícil argumentar contra elas.',
    },
    {
      name: 'O Castelo da Rainha de Copas',
      description:
        'Um castelo de rosas pintadas e criados de baralho, onde a palavra da Rainha é lei exatamente enquanto ela está na sala, e o Rei a revoga discretamente depois que ela sai.',
    },
    {
      name: 'O Campo de Croqué',
      description:
        'O gramado da Rainha, jogado com flamingos vivos e ouriços num terreno que se mexe. Perder com educação é tão perigoso quanto ganhar, e ninguém jamais terminou uma partida.',
    },
    {
      name: 'O Bosque da Duquesa',
      description:
        'O bosque entre o castelo e a mesa de chá, onde o Gato de Cheshire aparece em pedaços e dá indicações inteiramente exatas e de nenhuma utilidade.',
    },
    {
      name: 'A Casa do Chapeleiro Maluco',
      description:
        'Onde um chá acontece sem fim, sempre às seis horas, porque o Chapeleiro brigou com o Tempo e o Tempo não anda para ele desde então.',
    },
  ],
  characters: [
    {
      name: 'Alice',
      description:
        'Uma menina curiosa que prefere uma aventura estranha a uma tarde comum. É a única pessoa do País das Maravilhas que insiste em esperar que as coisas façam sentido, e a única a quem alguma coisa é explicada.',
    },
    {
      name: 'O Coelho Branco',
      description:
        'Sempre atrasado, sempre conferindo o relógio de bolso, e apavorado com a Rainha. É a primeira coisa impossível que Alice vê e a razão de ela estar ali.',
    },
    {
      name: 'O Chapeleiro Maluco',
      description:
        'Anfitrião de um chá que nunca termina, tendo sido certa vez sentenciado pela Rainha por assassinar o tempo. Desde então o Tempo parou de andar para ele, o que ele trata como um problema de agenda.',
    },
    {
      name: 'O Gato de Cheshire',
      description:
        'Um gato que aparece e some quando quer, na ordem que quiser, sempre sorrindo. É a única criatura do País das Maravilhas que diz a verdade a Alice, e não é útil uma única vez.',
    },
    {
      name: 'A Rainha de Copas',
      description:
        'Uma soberana de temperamento explosivo que manda executar alguém quase a cada cena. Nenhuma das ordens é jamais cumprida, o que ninguém conta a Alice.',
    },
    {
      name: 'O Valete de Copas',
      description:
        'Acusado de roubar as tortas da Rainha e julgado com uma prova que não diz absolutamente nada. Nunca fala em sua própria defesa, tendo entendido antes de Alice como aquela corte funciona.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 1, 5, 7, 9, 11],
    [4, 9],
    [3, 6, 8],
    [5, 6, 7, 8, 9, 11],
    [9, 11],
  ],
  relations: [
    { pair: [0, 1], type: 'Seguiu-o até aqui' },
    { pair: [0, 2], type: 'Convidada sem convite' },
    { pair: [0, 3], type: 'Guia inútil' },
    { pair: [0, 4], type: 'Desafiou-a' },
    { pair: [0, 5], type: 'Testemunha no julgamento dele' },
    { pair: [1, 4], type: 'Arauto dela' },
    { pair: [2, 4], type: 'Sentenciado por ela certa vez' },
    { pair: [4, 5], type: 'Acusadora' },
  ],
  items: [
    {
      name: 'Garrafa marcada "BEBA-ME"',
      description:
        'Uma garrafinha sobre uma mesa de vidro, com rótulo de papel, com gosto de torta de cereja, creme, abacaxi, peru assado, caramelo e torrada com manteiga ao mesmo tempo. Deixa menor quem a bebe.',
      category: 'Objeto do País das Maravilhas',
      initialState: 'Cheia, sobre a mesa de vidro',
      owner: null,
      journey: [
        { scene: 1, state: 'Encontrada sobre a mesa de vidro', owner: null },
        { scene: 2, state: 'Bebida até o fim', owner: 0 },
        { scene: 3, state: 'Vazia, e de nenhuma serventia', owner: 0 },
      ],
    },
    {
      name: 'Bolo marcado "COMA-ME"',
      description:
        'Um bolinho debaixo da mesa de vidro com COMA-ME escrito em passas de groselha. Faz o oposto da garrafa, e com a mesma brusquidão.',
      category: 'Objeto do País das Maravilhas',
      initialState: 'Inteiro, sob a mesa',
      owner: null,
      journey: [
        { scene: 1, state: 'Encontrado sob a mesa', owner: null },
        { scene: 2, state: 'Comido, com o efeito oposto', owner: 0 },
        { scene: 3, state: 'Farelos num bolso', owner: 0 },
      ],
    },
    {
      name: 'O Relógio de Bolso do Coelho Branco',
      description:
        'O relógio que o Coelho Branco não para de tirar do colete. Sempre lhe diz que está atrasado, e é a primeira coisa impossível que Alice decide valer a pena seguir.',
      category: 'Objeto do País das Maravilhas',
      initialState: 'No colete do Coelho',
      owner: 1,
      journey: [
        { scene: 0, state: 'Tirado de um colete', owner: 1 },
        { scene: 5, state: 'Levado para dentro do castelo', owner: 1 },
        { scene: 9, state: 'Juntado aos autos como prova', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'A Lógica do País das Maravilhas',
      description:
        'O País das Maravilhas não é sem lei. Toda regra dali é aplicada com coerência completa e não se apoia em absolutamente nada, e é por isso que argumentar contra uma delas sempre soa como a objeção de quem não entendeu.',
    },
    {
      title: 'Coma-me, Beba-me',
      description:
        'O País das Maravilhas é cheio de comida e bebida com instruções, e as instruções são sempre honestas sobre o que fazem e caladas sobre o quanto. Tamanho, ali, é algo que acontece com Alice e não algo que ela tem.',
    },
    {
      title: 'Ninguém É de Fato Executado',
      description:
        'A Rainha manda decapitar alguém quase a cada cena, e o Rei perdoa cada uma delas às escondidas. A ameaça é real para Alice e para mais ninguém, e é isso que torna a corte insuportável em vez de perigosa.',
    },
  ],
  notes: [
    {
      title: 'Continuidade: de que tamanho ela está',
      body: 'Alice muda de altura oito vezes e isso importa em toda cena em que acontece. Acompanhar explicitamente - o julgamento só funciona porque ela está crescendo enquanto ele corre.',
    },
    {
      title: 'Motivo visual: instruções nas coisas',
      body: 'Rótulos, placas, veredictos escritos antes dos julgamentos. O País das Maravilhas vive dizendo a Alice o que fazer por escrito, e o escrito nunca está errado e nunca é suficiente.',
    },
    {
      title: 'Meta de revisão: a bifurcação é um temperamento',
      body: 'Os dois finais dependem de uma coisa só: se Alice diz a coisa discreta ou a coisa em voz alta. Toda escolha no caminho até lá deve ser reconhecidamente a mesma decisão, em escala menor.',
    },
  ],
  tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
  choiceLabel: 'Continuar em direção a',
  triggers: { set: 'gato_deu_as_indicacoes', unset: 'a_corte_ja_a_viu' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 1 },
    { type: 'itemTake', item: 1, scene: 2 },
    { type: 'triggerSet', item: null, scene: 3 },
    { type: 'triggerUnset', item: null, scene: 0 },
  ],
};

export const aliceInWonderland: LocalizedNarrative = { en: aliceEn, pt: alicePt };
