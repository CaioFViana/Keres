import type { LocalizedNarrative, StoryNarrative } from './types';

const cinderellaEn: StoryNarrative = {
  chapters: [
    {
      name: 'A Servant in Her Own House',
      summary:
        "Cinderella's place in her father's house once her stepmother takes charge, and the royal invitation that finally gives her something to lose.",
    },
    {
      name: 'One Night at the Palace',
      summary:
        'The Fairy Godmother lends rather than gives. Everything Cinderella gains that night is borrowed against a deadline she agrees to in advance.',
    },
    {
      name: "The Slipper's Search",
      summary:
        'The one thing the spell fails to take back travels the kingdom house by house, until the household that hid her has to answer the door.',
    },
  ],
  scenes: [
    {
      name: "A servant's life",
      summary:
        'Cinderella sleeps by the kitchen fire and answers to her stepmother and both stepsisters. The ashes that give her her name are the first thing anyone notices about her, and by now the only thing.',
      body: 'Cinderella wakes before the rest of the house because the fire will not light itself, and the fire is the closest thing she has to a room of her own. She sleeps beside it on a pallet she rolls away each morning, and by the time the stepmother comes down for breakfast there is no sign that anyone slept in the kitchen at all.\n\nThe ashes get into everything - her hair, her cuffs, the hem of the only dress that is truly hers. The stepsisters named her for them years ago, and the name stuck the way ash sticks: lightly at first, and then for good.',
      location: 2,
    },
    {
      name: 'The invitation to the ball',
      summary:
        'A royal invitation arrives for a ball where the prince will choose a bride. It is addressed to every young woman in the kingdom, which is precisely the problem: Cinderella is one of them, and everyone in the house knows it.',
      body: "The invitation arrives on a morning like any other, carried by a rider in the prince's livery who looks faintly embarrassed to be leaving royal paper at a house with soot on the doorstep. It is read aloud at the table, twice, because the stepsisters insist on hearing the part about the bride again.\n\nEvery young woman in the kingdom is invited; the wording could not be plainer. The stepmother folds the letter with great care and does not look at Cinderella, which everyone at the table understands to be a kind of looking.",
      location: 1,
    },
    {
      name: 'The torn dress',
      summary:
        'The stepsisters pull apart the dress Cinderella made from what she was allowed to keep, and the stepmother calls the matter settled. Nobody forbids her to go. They simply arrange for it to be impossible.',
      body: "What Cinderella was allowed to keep was not much: a sash too worn to sell, a length of ribbon, her mother's old brooch. She sews through three nights to make them into a dress, and it is, against every odd the house can offer, a lovely one.\n\nThe stepsisters take it apart in under a minute - a ribbon here, a sash there, each piece reclaimed as something they had only lent. The stepmother surveys the remains and calls the matter settled, in the tone of a judge who has read the verdict and finds it fair.",
      location: 1,
    },
    {
      name: 'The Fairy Godmother',
      summary:
        'Left crying in the garden, Cinderella is answered. The Fairy Godmother asks for a pumpkin, six mice and a pair of lizards, and names a condition instead of a price.',
      body: "The garden is the one place in the house where nobody needs anything from her, so that is where she goes to cry. She has finished crying, mostly, when the voice asks her what is wrong, in the manner of someone who already knows and is only being polite.\n\n'A pumpkin, six mice, and a pair of lizards,' the Fairy Godmother says, 'and be back before midnight.' It is not a price. It is a condition, stated the way conditions should be: plainly, in advance, with no small print at all.",
      location: 3,
    },
    {
      name: 'The pumpkin and the mice',
      summary:
        "The garden empties itself into a carriage, a team of horses and a coachman, and Cinderella's rags become a gown. Only the glass slippers are made from nothing that was there before.",
      body: 'The pumpkin goes first, swelling off the vine into a carriage with lamps already lit, and the mice follow in a skittering line, each one standing a little taller than a mouse has any business standing. The lizards climb up behind in green livery, looking pleased with themselves.\n\nLast come the slippers, spun out of nothing Cinderella can name - the only part of the evening that is made, not borrowed. She turns them in the lamplight, and they throw small cold stars across the garden wall.',
      location: 3,
    },
    {
      name: 'The stranger at the ball',
      summary:
        'Nobody at the palace recognises her, her own family least of all. The prince dances with her the whole evening and never once asks her name - an omission he will spend the rest of the story paying for.',
      body: 'The palace does not know her, which is exactly the plan, but it stings all the same when her own stepsisters look straight through her and return to their gossip. Anonymity, she discovers, is a costume that fits a little too well.\n\nThe prince dances every dance with her and talks through all of them, about the kingdom and the hunting and the terrible wine, and never asks her name. She tells herself he will ask before the evening ends. He does not.',
      location: 4,
    },
    {
      name: 'The stroke of midnight',
      summary:
        'The first stroke of the clock reaches Cinderella mid-sentence. She runs before the twelfth, because the Fairy Godmother stated the condition plainly and Cinderella agreed to it.',
      body: 'She is laughing at something he has said - she will never remember what - when the clock clears its throat for the first stroke. The sound goes through the ballroom like a crack through ice, and she is already moving.\n\nEleven strokes carry her down the stairs and across the courtyard, each one a little louder than manners allow. She does not look back. The condition was stated plainly and she agreed to it, and there is nothing in the agreement about looking back.',
      location: 4,
    },
    {
      name: 'The lost slipper',
      summary:
        'On the palace stairs one glass slipper comes away and stays behind. It is the only thing the spell does not reclaim, and the only evidence the prince is left holding.',
      body: 'The slipper comes off on the palace stairs, cleanly, the way a leaf lets go of a branch. She hears it ring against the stone behind her and keeps running, because the twelfth stroke is already on its way and arithmetic does not negotiate.\n\nWhen the spell unwinds itself in the courtyard, it takes everything: the gown, the carriage, the horses, the coachman with his green coat. Everything except the one small glass shoe on the stairs, which was never borrowed at all.',
      location: 4,
    },
    {
      name: 'Back among the ashes',
      summary:
        'Cinderella is at the hearth before dawn, in her own rags, the second slipper hidden. Her stepsisters come home full of the mysterious princess and describe her at length, to her face.',
      body: "She is home before dawn, in her own rags, with the second slipper wrapped in a cloth and buried at the bottom of the woodbox. The hearth is cold. She lights it with hands that still remember holding a prince's hand, and finds the memory embarrassing.\n\nThe stepsisters return full of the mysterious princess - her gown, her manners, the way the prince looked at her - and describe her at length, to her face, while she serves their breakfast. Cinderella listens gravely and asks intelligent questions, and does not smile until they leave the room.",
      location: 2,
    },
    {
      name: "The prince's search",
      summary:
        'The prince has the slipper carried from house to house across the kingdom. The method is absurd and everyone involved knows it, and it works anyway, because there is only one foot it can belong to.',
      body: "The prince's plan is announced with trumpets, which does not make it any less absurd: the slipper will be carried to every house in the kingdom, and whichever foot it fits will marry him. The court receives this in respectful silence, and the kingdom receives it as the best entertainment in years.\n\nHouse by house it goes, and house by house it fails, and the procession grows longer and merrier with every failure. Nobody admits to enjoying the spectacle. Everybody attends it.",
      location: 0,
    },
    {
      name: "The stepsisters' turn",
      summary:
        'Both stepsisters force their feet at the slipper while the stepmother keeps Cinderella out of the room. Neither of them fits, and neither of them concedes it.',
      body: 'When the procession reaches their door, the stepsisters are ready - powdered, perfumed, and quietly desperate. The elder goes first and pushes until her eyes water; the younger follows and pushes until the slipper creaks. Neither foot fits, and neither sister will say the word for it.\n\nCinderella watches from the kitchen doorway, where the stepmother has stationed her with a look that means *stay*. She stays. She has learned, over the years, exactly how much a look can hold.',
      location: 1,
    },
    {
      name: 'The slipper fits',
      summary:
        'Cinderella asks to try, and it fits. Then she takes the matching slipper out of her pocket, which ends the argument before her stepmother can begin it.',
      body: "'May I try?' Cinderella asks, and the room goes still in the particular way of rooms where something long expected is finally happening. The stepmother opens her mouth. Nothing useful comes out.\n\nThe slipper slides on as if the foot and the glass had been introduced years ago and were only now meeting properly. And then, before the objections can assemble themselves, Cinderella takes the matching slipper from her pocket - and there is nothing left to argue about.",
      location: 1,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'The Kingdom',
      description:
        "The small kingdom Cinderella has never left, where the prince's family reigns and where a royal invitation reaches every house that has a door.",
    },
    {
      name: "Cinderella's House",
      description:
        "The house Cinderella's father left her, run since his death by her stepmother, who has never had to justify a single decision made inside it.",
    },
    {
      name: 'The Kitchen Hearth',
      description:
        'The corner beside the kitchen fire where Cinderella sleeps. The ashes that settle on her there are where her name comes from, and the household uses it without thinking.',
    },
    {
      name: 'The Garden',
      description:
        'The kitchen garden behind the house, with its pumpkin patch and its mice. Ordinary in every way until the night someone needs it to be otherwise.',
    },
    {
      name: 'The Royal Palace',
      description:
        'Where the great ball is held, and where the prince is expected to choose a bride in one evening from a crowd of women he has never met.',
    },
  ],
  characters: [
    {
      name: 'Cinderella',
      description:
        "A kind and hard-working young woman, treated as a servant in the house that was her father's. She obeys because refusing has never once worked, not because she agrees.",
    },
    {
      name: 'Stepmother',
      description:
        'A cold, calculating widow who openly favours her own daughters. She never forbids Cinderella anything outright; she arranges circumstances so the refusal is never hers to defend.',
    },
    {
      name: 'The Elder Stepsister',
      description:
        "Cinderella's stepsister, vain and clumsy, and the first to reach for anything her sister wants.",
    },
    {
      name: 'The Younger Stepsister',
      description:
        'The other stepsister, just as vain as the elder and quicker to say aloud what their mother only implies.',
    },
    {
      name: 'The Fairy Godmother',
      description:
        'A godmother who appears once, at the worst hour, and helps on terms stated in advance. She lends; she does not give.',
    },
    {
      name: 'The Prince',
      description:
        "The kingdom's heir, required to choose a bride at a single ball. He dances all night with a woman whose name he never thinks to ask for.",
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11],
    [0, 1, 2, 8, 10, 11],
    [0, 1, 2, 8, 10],
    [0, 1, 2, 8, 10],
    [3, 4],
    [5, 6, 7, 9, 11],
  ],
  relations: [
    { pair: [0, 1], type: 'Stepmother' },
    { pair: [0, 2], type: 'Stepsister' },
    { pair: [0, 3], type: 'Stepsister' },
    { pair: [1, 2], type: 'Mother and daughter' },
    { pair: [1, 3], type: 'Mother and daughter' },
    { pair: [2, 3], type: 'Sisters' },
    { pair: [0, 4], type: 'Godmother' },
    { pair: [0, 5], type: 'In love' },
  ],
  items: [
    {
      name: 'The Glass Slippers',
      description:
        'A pair of slippers made of glass, conjured out of nothing rather than transformed from something. That is why they survive midnight when the rest of the spell does not.',
      category: 'Conjured object',
      initialState: 'Conjured',
      owner: 0,
      journey: [
        { scene: 4, state: 'Worn to the ball', owner: 0 },
        { scene: 7, state: 'One left on the stairs', owner: null },
        { scene: 11, state: 'Matched to its pair', owner: 0 },
      ],
    },
    {
      name: 'The Pumpkin Carriage',
      description:
        'A carriage made from a garden pumpkin, drawn by horses that were mice an hour ago and driven by a coachman who was a rat. Borrowed, in every sense.',
      category: 'Conjured object',
      initialState: 'A pumpkin in the garden',
      owner: null,
      journey: [
        { scene: 3, state: 'Chosen from the patch', owner: null },
        { scene: 4, state: 'Turned into a carriage', owner: 0 },
        { scene: 6, state: 'A pumpkin again, on the road', owner: null },
      ],
    },
    {
      name: 'The Ball Gown',
      description:
        "A gown conjured from Cinderella's own rags, which is why it goes back to being rags: the spell only lends what it borrowed.",
      category: 'Conjured object',
      initialState: 'Rags',
      owner: 0,
      journey: [
        { scene: 4, state: 'Conjured from her rags', owner: 0 },
        { scene: 5, state: 'Worn, and unrecognised in', owner: 0 },
        { scene: 6, state: 'Rags again', owner: 0 },
      ],
    },
  ],
  worldRules: [
    {
      title: 'The Midnight Spell',
      description:
        "The Fairy Godmother's spell ends at the twelfth stroke of midnight, and everything it transformed returns to what it was. The hour is not a punishment or a test - it is stated up front, and Cinderella accepts it before anything is conjured.",
    },
    {
      title: "The Fairy Godmother's Transformations",
      description:
        'A wave of the wand turns a pumpkin into a carriage, mice into horses, a rat into a coachman and rags into a gown. Each transformation needs something real to work on: the magic changes what is there and never creates from nothing.',
    },
    {
      title: 'What the Spell Cannot Undo',
      description:
        'The one exception to the rule above. The glass slippers were conjured rather than transformed, so midnight has no earlier state to return them to. A slipper lost on the stairs is still glass at dawn - and still the only proof that Cinderella was ever there.',
    },
  ],
  notes: [
    {
      title: 'Continuity: the second slipper',
      body: 'Cinderella has the matching slipper from the moment she gets home. Every scene after the ball has to be written as if she knows she can end the story whenever she chooses - and does not, until someone finally asks her.',
    },
    {
      title: 'Visual motif: ashes and glass',
      body: 'The two materials of the story. She is named for one and identified by the other. The hearth scenes and the palace scenes should keep trading them back and forth.',
    },
    {
      title: 'Revision goal: nobody forbids her',
      body: 'The stepmother never says no. She arranges circumstances instead, so that the obstacle is always a fact rather than a decision. Keep every obstacle in the first chapter deniable.',
    },
  ],
  tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
  choiceLabel: 'Continue toward',
  triggers: { set: 'invited_to_the_ball', unset: 'recognised_at_home' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 4 },
    { type: 'itemTake', item: 1, scene: 6 },
    { type: 'triggerSet', item: null, scene: 1 },
    { type: 'triggerUnset', item: null, scene: 0 },
  ],
};

const cinderellaPt: StoryNarrative = {
  chapters: [
    {
      name: 'Criada na Própria Casa',
      summary:
        'O lugar de Cinderela na casa do pai depois que a madrasta assume o comando, e o convite real que enfim lhe dá algo a perder.',
    },
    {
      name: 'Uma Noite no Palácio',
      summary:
        'A Fada Madrinha empresta, não dá. Tudo o que Cinderela ganha naquela noite está tomado por empréstimo contra um prazo que ela aceita de antemão.',
    },
    {
      name: 'A Busca do Sapatinho',
      summary:
        'A única coisa que o encanto não consegue retomar percorre o reino de casa em casa, até que a casa que a escondeu precise atender à porta.',
    },
  ],
  scenes: [
    {
      name: 'Vida de criada',
      summary:
        'Cinderela dorme junto ao fogo da cozinha e obedece à madrasta e às duas meias-irmãs. As cinzas que lhe dão o nome são a primeira coisa que qualquer um nota nela, e a esta altura a única.',
      body: 'Cinderela acorda antes do resto da casa porque o fogo não se acende sozinho, e o fogo é a coisa mais próxima de um quarto só seu. Dorme ao lado dele num colchão que enrola a cada manhã, e quando a madrasta desce para o café não há sinal de que alguém dormiu na cozinha.\n\nAs cinzas entram em tudo - no cabelo, nos punhos, na barra do único vestido que é de verdade dela. As meias-irmãs a batizaram por causa delas anos atrás, e o nome pegou como cinza pega: de leve no começo, e depois para sempre.',
      location: 2,
    },
    {
      name: 'O convite para o baile',
      summary:
        'Chega um convite real para um baile em que o príncipe escolherá sua noiva. É endereçado a todas as jovens do reino, e é justamente esse o problema: Cinderela é uma delas, e todos na casa sabem disso.',
      body: 'O convite chega numa manhã como qualquer outra, trazido por um mensageiro com a libré do príncipe, visivelmente sem jeito de deixar papel real numa casa com fuligem na soleira. É lido em voz alta à mesa, duas vezes, porque as meias-irmãs exigem ouvir de novo a parte sobre a noiva.\n\nTodas as jovens do reino estão convidadas; a redação não poderia ser mais clara. A madrasta dobra a carta com grande cuidado e não olha para Cinderela, o que todos à mesa entendem como um jeito de olhar.',
      location: 1,
    },
    {
      name: 'O vestido rasgado',
      summary:
        'As meias-irmãs desfazem o vestido que Cinderela costurou com o pouco que lhe permitiram guardar, e a madrasta dá o assunto por encerrado. Ninguém a proíbe de ir. Apenas providenciam para que seja impossível.',
      body: 'O que permitiram a Cinderela guardar não era muito: uma faixa gasta demais para vender, um pedaço de fita, o velho broche da mãe. Ela costura por três noites para transformar tudo num vestido, e o resultado é, contra todas as probabilidades que a casa oferece, um vestido bonito.\n\nAs meias-irmãs o desfazem em menos de um minuto - uma fita aqui, uma faixa ali, cada peça retomada como algo que só tinham emprestado. A madrasta examina os restos e dá o assunto por encerrado, no tom de um juiz que leu a sentença e a achou justa.',
      location: 1,
    },
    {
      name: 'A Fada Madrinha',
      summary:
        'Deixada chorando no jardim, Cinderela é atendida. A Fada Madrinha pede uma abóbora, seis ratos e um par de lagartixas, e enuncia uma condição em vez de cobrar um preço.',
      body: 'O jardim é o único lugar da casa onde ninguém precisa de nada dela, então é para lá que ela vai chorar. Já tinha quase terminado de chorar quando a voz pergunta o que houve, no jeito de quem já sabe e está sendo apenas educada.\n\n- Uma abóbora, seis ratos e um par de lagartixas - diz a Fada Madrinha - e esteja de volta antes da meia-noite. Não é um preço. É uma condição, enunciada como condições devem ser: com todas as letras, de antemão, sem letra miúda.',
      location: 3,
    },
    {
      name: 'A abóbora e os ratos',
      summary:
        'O jardim se esvazia numa carruagem, numa parelha de cavalos e num cocheiro, e os trapos de Cinderela viram um vestido. Só os sapatinhos de cristal não foram feitos de nada que já estivesse ali.',
      body: 'A abóbora vai primeiro, inchando na rama até virar uma carruagem de lampiões já acesos, e os ratos a seguem em fila ligeira, cada um se aprumando mais do que rato algum tem o direito de se aprumar. As lagartixas trepam para trás em libré verde, visivelmente satisfeitas consigo.\n\nPor último vêm os sapatinhos, fiados de nada que Cinderela saiba nomear - a única parte da noite que é feita, não emprestada. Ela os gira à luz do lampião, e eles lançam pequenas estrelas frias pelo muro do jardim.',
      location: 3,
    },
    {
      name: 'A desconhecida no baile',
      summary:
        'Ninguém no palácio a reconhece, e sua própria família menos que todos. O príncipe dança com ela a noite inteira e não lhe pergunta o nome nenhuma vez - omissão que ele passará o resto da história pagando.',
      body: 'O palácio não a conhece, que é exatamente o plano, mas dói ainda assim quando as próprias meias-irmãs olham através dela e voltam à fofoca. O anonimato, ela descobre, é uma fantasia que serve um pouco bem demais.\n\nO príncipe dança todas as danças com ela e fala durante todas elas, do reino e da caça e do vinho terrível, e não lhe pergunta o nome nenhuma vez. Ela diz a si mesma que ele perguntará antes do fim da noite. Ele não pergunta.',
      location: 4,
    },
    {
      name: 'A badalada da meia-noite',
      summary:
        'A primeira badalada do relógio alcança Cinderela no meio de uma frase. Ela corre antes da décima segunda, porque a Fada Madrinha enunciou a condição com todas as letras e Cinderela concordou com ela.',
      body: 'Ela está rindo de algo que ele disse - jamais lembrará o quê - quando o relógio pigarreia para a primeira badalada. O som atravessa o salão como uma rachadura no gelo, e ela já está correndo.\n\nOnze badaladas a levam escada abaixo e pátio afora, cada uma um pouco mais alta do que as boas maneiras permitem. Ela não olha para trás. A condição foi enunciada com todas as letras e ela concordou, e não há nada no acordo sobre olhar para trás.',
      location: 4,
    },
    {
      name: 'O sapatinho perdido',
      summary:
        'Na escadaria do palácio um sapatinho de cristal se solta e fica para trás. É a única coisa que o encanto não retoma, e a única prova que resta nas mãos do príncipe.',
      body: 'O sapatinho se solta na escadaria do palácio, com limpeza, como a folha se solta do galho. Ela o ouve tilintar na pedra atrás de si e continua correndo, porque a décima segunda badalada já vem vindo e a aritmética não negocia.\n\nQuando o encanto se desfaz no pátio, leva tudo: o vestido, a carruagem, os cavalos, o cocheiro de casaco verde. Tudo, menos o pequeno sapato de cristal na escada, que nunca foi emprestado.',
      location: 4,
    },
    {
      name: 'De volta às cinzas',
      summary:
        'Cinderela está junto ao fogo antes do amanhecer, em seus próprios trapos, com o segundo sapatinho escondido. As meias-irmãs voltam falando sem parar da princesa misteriosa e a descrevem longamente, na sua cara.',
      body: 'Ela chega em casa antes do amanhecer, em seus próprios trapos, com o segundo sapatinho embrulhado num pano e enterrado no fundo da caixa de lenha. A lareira está fria. Ela a acende com mãos que ainda se lembram de segurar a mão de um príncipe, e acha a lembrança constrangedora.\n\nAs meias-irmãs voltam cheias da princesa misteriosa - o vestido, as maneiras, o jeito como o príncipe olhava para ela - e a descrevem longamente, na sua cara, enquanto ela serve o café. Cinderela escuta com gravidade, faz perguntas inteligentes, e só sorri quando elas saem da sala.',
      location: 2,
    },
    {
      name: 'A busca do príncipe',
      summary:
        'O príncipe manda levar o sapatinho de casa em casa por todo o reino. O método é absurdo e todos os envolvidos sabem disso, e ainda assim funciona, porque existe um único pé a que ele pode pertencer.',
      body: 'O plano do príncipe é anunciado com trombetas, o que não o torna menos absurdo: o sapatinho será levado a cada casa do reino, e o pé em que servir se casará com ele. A corte recebe isso em silêncio respeitoso, e o reino recebe como o melhor entretenimento em anos.\n\nDe casa em casa ele vai, e de casa em casa falha, e o cortejo cresce mais longo e mais alegre a cada fracasso. Ninguém admite estar gostando do espetáculo. Todos comparecem.',
      location: 0,
    },
    {
      name: 'A vez das meias-irmãs',
      summary:
        'As duas meias-irmãs forçam o pé no sapatinho enquanto a madrasta mantém Cinderela fora da sala. Nenhuma das duas serve, e nenhuma das duas admite.',
      body: 'Quando o cortejo chega à porta delas, as meias-irmãs estão prontas - empoadas, perfumadas e discretamente desesperadas. A mais velha vai primeiro e força até os olhos lacrimejarem; a mais nova segue e força até o sapatinho ranger. Nenhum pé serve, e nenhuma irmã dirá a palavra para isso.\n\nCinderela observa da porta da cozinha, onde a madrasta a postou com um olhar que significa *fique*. Ela fica. Aprendeu, ao longo dos anos, exatamente quanto um olhar pode conter.',
      location: 1,
    },
    {
      name: 'O sapatinho serve',
      summary:
        'Cinderela pede para experimentar, e serve. Então tira do bolso o sapatinho do par, o que encerra a discussão antes que a madrasta consiga começá-la.',
      body: '- Posso experimentar? - pergunta Cinderela, e a sala silencia do jeito particular das salas onde algo longamente esperado enfim acontece. A madrasta abre a boca. Nada de útil sai.\n\nO sapatinho desliza como se o pé e o cristal tivessem sido apresentados anos atrás e só agora se encontrassem direito. E então, antes que as objeções consigam se organizar, Cinderela tira do bolso o sapatinho do par - e não resta mais nada sobre o que discutir.',
      location: 1,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'O Reino',
      description:
        'O pequeno reino de que Cinderela nunca saiu, onde reina a família do príncipe e aonde um convite real chega a toda casa que tenha porta.',
    },
    {
      name: 'A Casa de Cinderela',
      description:
        'A casa que o pai de Cinderela lhe deixou, administrada desde a morte dele pela madrasta, que jamais precisou justificar uma única decisão tomada ali dentro.',
    },
    {
      name: 'O Canto da Lareira',
      description:
        'O canto junto ao fogo da cozinha onde Cinderela dorme. As cinzas que se assentam nela ali são a origem de seu nome, e a casa o usa sem pensar duas vezes.',
    },
    {
      name: 'O Jardim',
      description:
        'A horta atrás da casa, com seu canteiro de abóboras e seus ratos. Comum sob todos os aspectos até a noite em que alguém precisa que não seja.',
    },
    {
      name: 'O Palácio Real',
      description:
        'Onde se realiza o grande baile, e onde se espera que o príncipe escolha uma noiva em uma só noite, num salão cheio de mulheres que ele nunca viu.',
    },
  ],
  characters: [
    {
      name: 'Cinderela',
      description:
        'Uma jovem bondosa e trabalhadora, tratada como criada na casa que era de seu pai. Obedece porque recusar nunca funcionou uma única vez, não porque concorde.',
    },
    {
      name: 'Madrasta',
      description:
        'Uma viúva fria e calculista que favorece abertamente as próprias filhas. Nunca proíbe Cinderela de nada de forma explícita; arranja as circunstâncias para que a recusa nunca seja dela para defender.',
    },
    {
      name: 'A Meia-Irmã Mais Velha',
      description:
        'Meia-irmã de Cinderela, vaidosa e desajeitada, e a primeira a estender a mão para qualquer coisa que a irmã queira.',
    },
    {
      name: 'A Meia-Irmã Mais Nova',
      description:
        'A outra meia-irmã, tão vaidosa quanto a mais velha e mais rápida em dizer em voz alta o que a mãe apenas insinua.',
    },
    {
      name: 'A Fada Madrinha',
      description:
        'Uma madrinha que aparece uma única vez, na pior hora, e ajuda em termos anunciados de antemão. Ela empresta; não dá.',
    },
    {
      name: 'O Príncipe',
      description:
        'O herdeiro do reino, obrigado a escolher uma noiva num único baile. Dança a noite toda com uma mulher cujo nome não lhe ocorre perguntar.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11],
    [0, 1, 2, 8, 10, 11],
    [0, 1, 2, 8, 10],
    [0, 1, 2, 8, 10],
    [3, 4],
    [5, 6, 7, 9, 11],
  ],
  relations: [
    { pair: [0, 1], type: 'Madrasta' },
    { pair: [0, 2], type: 'Meia-irmã' },
    { pair: [0, 3], type: 'Meia-irmã' },
    { pair: [1, 2], type: 'Mãe e filha' },
    { pair: [1, 3], type: 'Mãe e filha' },
    { pair: [2, 3], type: 'Irmãs' },
    { pair: [0, 4], type: 'Madrinha' },
    { pair: [0, 5], type: 'Apaixonados' },
  ],
  items: [
    {
      name: 'Os Sapatinhos de Cristal',
      description:
        'Um par de sapatinhos de cristal, conjurados do nada em vez de transformados a partir de algo. É por isso que sobrevivem à meia-noite quando o resto do encanto não sobrevive.',
      category: 'Objeto conjurado',
      initialState: 'Conjurados',
      owner: 0,
      journey: [
        { scene: 4, state: 'Calçados para o baile', owner: 0 },
        { scene: 7, state: 'Um deles fica na escadaria', owner: null },
        { scene: 11, state: 'Reunido ao seu par', owner: 0 },
      ],
    },
    {
      name: 'A Carruagem de Abóbora',
      description:
        'Uma carruagem feita de uma abóbora da horta, puxada por cavalos que eram ratos uma hora atrás e conduzida por um cocheiro que era um rato-do-mato. Emprestada, em todos os sentidos.',
      category: 'Objeto conjurado',
      initialState: 'Uma abóbora na horta',
      owner: null,
      journey: [
        { scene: 3, state: 'Escolhida no canteiro', owner: null },
        { scene: 4, state: 'Transformada em carruagem', owner: 0 },
        { scene: 6, state: 'Abóbora de novo, na estrada', owner: null },
      ],
    },
    {
      name: 'O Vestido de Baile',
      description:
        'Um vestido conjurado a partir dos próprios trapos de Cinderela, e é por isso que volta a ser trapos: o encanto só devolve o que tomou emprestado.',
      category: 'Objeto conjurado',
      initialState: 'Trapos',
      owner: 0,
      journey: [
        { scene: 4, state: 'Conjurado de seus trapos', owner: 0 },
        { scene: 5, state: 'Usado, e não reconhecida nele', owner: 0 },
        { scene: 6, state: 'Trapos outra vez', owner: 0 },
      ],
    },
  ],
  worldRules: [
    {
      title: 'O Encanto da Meia-Noite',
      description:
        'O encanto da Fada Madrinha termina na décima segunda badalada da meia-noite, e tudo o que ele transformou volta ao que era. A hora não é castigo nem prova - é enunciada de saída, e Cinderela a aceita antes que qualquer coisa seja conjurada.',
    },
    {
      title: 'As Transformações da Fada Madrinha',
      description:
        'Um aceno da varinha transforma uma abóbora em carruagem, ratos em cavalos, um rato-do-mato em cocheiro e trapos em vestido. Cada transformação precisa de algo real sobre o que agir: a magia altera o que está ali e nunca cria a partir do nada.',
    },
    {
      title: 'O Que o Encanto Não Desfaz',
      description:
        'A única exceção à regra acima. Os sapatinhos de cristal foram conjurados, não transformados, então a meia-noite não tem estado anterior a que devolvê-los. Um sapatinho perdido na escadaria continua de cristal ao amanhecer - e continua sendo a única prova de que Cinderela esteve ali.',
    },
  ],
  notes: [
    {
      title: 'Continuidade: o segundo sapatinho',
      body: 'Cinderela tem o sapatinho do par desde o instante em que chega em casa. Toda cena depois do baile precisa ser escrita como se ela soubesse que pode encerrar a história quando quiser - e não o faça, até que alguém enfim lhe pergunte.',
    },
    {
      title: 'Motivo visual: cinzas e cristal',
      body: 'Os dois materiais da história. Ela é nomeada por um e identificada pelo outro. As cenas da lareira e as cenas do palácio devem seguir trocando um pelo outro.',
    },
    {
      title: 'Meta de revisão: ninguém a proíbe',
      body: 'A madrasta nunca diz não. Ela arranja as circunstâncias, de modo que o obstáculo seja sempre um fato e não uma decisão. Manter todo obstáculo do primeiro capítulo negável.',
    },
  ],
  tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
  choiceLabel: 'Continuar em direção a',
  triggers: { set: 'convidada_para_o_baile', unset: 'reconhecida_em_casa' },
  effects: [
    { type: 'itemGrant', item: 0, scene: 4 },
    { type: 'itemTake', item: 1, scene: 6 },
    { type: 'triggerSet', item: null, scene: 1 },
    { type: 'triggerUnset', item: null, scene: 0 },
  ],
};

export const cinderella: LocalizedNarrative = { en: cinderellaEn, pt: cinderellaPt };
