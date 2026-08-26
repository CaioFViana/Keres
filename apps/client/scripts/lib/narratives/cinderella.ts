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
      location: 2,
    },
    {
      name: 'The invitation to the ball',
      summary:
        'A royal invitation arrives for a ball where the prince will choose a bride. It is addressed to every young woman in the kingdom, which is precisely the problem: Cinderella is one of them, and everyone in the house knows it.',
      location: 1,
    },
    {
      name: 'The torn dress',
      summary:
        'The stepsisters pull apart the dress Cinderella made from what she was allowed to keep, and the stepmother calls the matter settled. Nobody forbids her to go. They simply arrange for it to be impossible.',
      location: 1,
    },
    {
      name: 'The Fairy Godmother',
      summary:
        'Left crying in the garden, Cinderella is answered. The Fairy Godmother asks for a pumpkin, six mice and a pair of lizards, and names a condition instead of a price.',
      location: 3,
    },
    {
      name: 'The pumpkin and the mice',
      summary:
        "The garden empties itself into a carriage, a team of horses and a coachman, and Cinderella's rags become a gown. Only the glass slippers are made from nothing that was there before.",
      location: 3,
    },
    {
      name: 'The stranger at the ball',
      summary:
        'Nobody at the palace recognises her, her own family least of all. The prince dances with her the whole evening and never once asks her name - an omission he will spend the rest of the story paying for.',
      location: 4,
    },
    {
      name: 'The stroke of midnight',
      summary:
        'The first stroke of the clock reaches Cinderella mid-sentence. She runs before the twelfth, because the Fairy Godmother stated the condition plainly and Cinderella agreed to it.',
      location: 4,
    },
    {
      name: 'The lost slipper',
      summary:
        'On the palace stairs one glass slipper comes away and stays behind. It is the only thing the spell does not reclaim, and the only evidence the prince is left holding.',
      location: 4,
    },
    {
      name: 'Back among the ashes',
      summary:
        'Cinderella is at the hearth before dawn, in her own rags, the second slipper hidden. Her stepsisters come home full of the mysterious princess and describe her at length, to her face.',
      location: 2,
    },
    {
      name: "The prince's search",
      summary:
        'The prince has the slipper carried from house to house across the kingdom. The method is absurd and everyone involved knows it, and it works anyway, because there is only one foot it can belong to.',
      location: 0,
    },
    {
      name: "The stepsisters' turn",
      summary:
        'Both stepsisters force their feet at the slipper while the stepmother keeps Cinderella out of the room. Neither of them fits, and neither of them concedes it.',
      location: 1,
    },
    {
      name: 'The slipper fits',
      summary:
        'Cinderella asks to try, and it fits. Then she takes the matching slipper out of her pocket, which ends the argument before her stepmother can begin it.',
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
      location: 2,
    },
    {
      name: 'O convite para o baile',
      summary:
        'Chega um convite real para um baile em que o príncipe escolherá sua noiva. É endereçado a todas as jovens do reino, e é justamente esse o problema: Cinderela é uma delas, e todos na casa sabem disso.',
      location: 1,
    },
    {
      name: 'O vestido rasgado',
      summary:
        'As meias-irmãs desfazem o vestido que Cinderela costurou com o pouco que lhe permitiram guardar, e a madrasta dá o assunto por encerrado. Ninguém a proíbe de ir. Apenas providenciam para que seja impossível.',
      location: 1,
    },
    {
      name: 'A Fada Madrinha',
      summary:
        'Deixada chorando no jardim, Cinderela é atendida. A Fada Madrinha pede uma abóbora, seis ratos e um par de lagartixas, e enuncia uma condição em vez de cobrar um preço.',
      location: 3,
    },
    {
      name: 'A abóbora e os ratos',
      summary:
        'O jardim se esvazia numa carruagem, numa parelha de cavalos e num cocheiro, e os trapos de Cinderela viram um vestido. Só os sapatinhos de cristal não foram feitos de nada que já estivesse ali.',
      location: 3,
    },
    {
      name: 'A desconhecida no baile',
      summary:
        'Ninguém no palácio a reconhece, e sua própria família menos que todos. O príncipe dança com ela a noite inteira e não lhe pergunta o nome nenhuma vez - omissão que ele passará o resto da história pagando.',
      location: 4,
    },
    {
      name: 'A badalada da meia-noite',
      summary:
        'A primeira badalada do relógio alcança Cinderela no meio de uma frase. Ela corre antes da décima segunda, porque a Fada Madrinha enunciou a condição com todas as letras e Cinderela concordou com ela.',
      location: 4,
    },
    {
      name: 'O sapatinho perdido',
      summary:
        'Na escadaria do palácio um sapatinho de cristal se solta e fica para trás. É a única coisa que o encanto não retoma, e a única prova que resta nas mãos do príncipe.',
      location: 4,
    },
    {
      name: 'De volta às cinzas',
      summary:
        'Cinderela está junto ao fogo antes do amanhecer, em seus próprios trapos, com o segundo sapatinho escondido. As meias-irmãs voltam falando sem parar da princesa misteriosa e a descrevem longamente, na sua cara.',
      location: 2,
    },
    {
      name: 'A busca do príncipe',
      summary:
        'O príncipe manda levar o sapatinho de casa em casa por todo o reino. O método é absurdo e todos os envolvidos sabem disso, e ainda assim funciona, porque existe um único pé a que ele pode pertencer.',
      location: 0,
    },
    {
      name: 'A vez das meias-irmãs',
      summary:
        'As duas meias-irmãs forçam o pé no sapatinho enquanto a madrasta mantém Cinderela fora da sala. Nenhuma das duas serve, e nenhuma das duas admite.',
      location: 1,
    },
    {
      name: 'O sapatinho serve',
      summary:
        'Cinderela pede para experimentar, e serve. Então tira do bolso o sapatinho do par, o que encerra a discussão antes que a madrasta consiga começá-la.',
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
