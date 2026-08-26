import type { LocalizedNarrative, StoryNarrative } from './types';

const princessKaguyaEn: StoryNarrative = {
  chapters: [
    {
      name: 'The Tale of the Bamboo Cutter',
      summary:
        'An old couple with no children find one inside a bamboo stalk, and the grove keeps paying for her upkeep as fast as she grows.',
    },
    {
      name: 'Five Impossible Treasures',
      summary:
        'Kaguya-hime never refuses anyone. She asks each of five nobles for a thing that does not exist, and four of them come back lying.',
    },
    {
      name: 'The Fifteenth Night',
      summary:
        'The Emperor cannot be put off with an impossible task, and the Moon cannot be put off at all. Everything Kaguya-hime leaves behind turns out to be worthless to the people who wanted her.',
    },
  ],
  scenes: [
    {
      name: 'A child in the bamboo',
      summary:
        'Cutting bamboo as he has every day of his life, Taketori no Okina finds one stalk shining from the inside. Within it sits a child no taller than his hand, and he carries her home in his palms.',
      location: 3,
    },
    {
      name: 'Growing like bamboo in spring',
      summary:
        'The child reaches full womanhood in three months. Neither the old man nor his wife asks why; they have wanted a daughter for forty years and are not inclined to interrogate one.',
      location: 1,
    },
    {
      name: 'Gold in every stalk',
      summary:
        'From the day he finds her, every stalk the old man cuts has gold inside it. The household becomes wealthy without anyone deciding to become wealthy, which is the first hint that she is being provided for from elsewhere.',
      location: 3,
    },
    {
      name: 'The name Kaguya-hime',
      summary:
        'A naming feast lasts three days, and she is given the name Shining Princess of the Supple Bamboo. Word of her beauty leaves the house with the guests and does not stop travelling.',
      location: 1,
    },
    {
      name: 'Five suitors at the gate',
      summary:
        'Five nobles camp outside the house and refuse to leave. Kaguya-hime does not want any of them and will not say so, because a refusal would fall on the old man who has to live with these families.',
      location: 0,
    },
    {
      name: 'The stone bowl and the jewelled branch',
      summary:
        'She sets each suitor a treasure to fetch. Prince Ishitsukuri sends for an ordinary bowl from a temple outside the city; Prince Kuramochi has a branch made by six jewellers and tells a long story about sailing to Mount Horai.',
      location: 2,
    },
    {
      name: 'The fire-rat robe and the dragon jewel',
      summary:
        "Minister Abe pays a fortune for a robe that burns in the first flame it meets. Counselor Otomo puts to sea after a jewel from a dragon's neck, is nearly drowned by a storm, and comes home swearing he was the injured party.",
      location: 2,
    },
    {
      name: "The swallow's shell",
      summary:
        "Counselor Isonokami climbs to a swallow's nest for a shell that is not there and falls. The jewellers arrive that same week demanding payment for the branch, and every one of the five stories comes apart at once.",
      location: 0,
    },
    {
      name: "The Emperor's courtship",
      summary:
        'The Emperor of Japan hears the reports and comes himself. He is the one man who cannot be sent after an impossible object, and Kaguya-hime tells him plainly that she is not of this country - which he takes for modesty.',
      location: 0,
    },
    {
      name: 'A secret from the Moon',
      summary:
        'As the fifteenth night of the eighth month approaches she cannot stop weeping. She finally tells the old couple where she is from and that her people are coming for her, and that nothing anyone does can stop it.',
      location: 2,
    },
    {
      name: 'The robe of feathers',
      summary:
        "Two thousand of the Emperor's soldiers surround the house. A shining retinue descends anyway, the soldiers cannot lift their arms, and Kaguya-hime leaves a letter and a vial before the robe is placed on her shoulders and she forgets them all.",
      location: 1,
    },
    {
      name: 'The mountain of immortality',
      summary:
        'The Emperor reads the letter and refuses the elixir: eternity without her is the one thing he wants least. He sends both to be burned on the peak nearest the sky, and the smoke has not stopped rising from Mount Fuji since.',
      location: 4,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'The Capital and Its Provinces',
      description:
        'The realm the Emperor governs and the roads that carry rumour through it. Everything in the story that goes wrong for a suitor happens somewhere out here, out of sight of the house.',
    },
    {
      name: "The Bamboo Cutter's House",
      description:
        'A small house that becomes a rich one within a season, without anybody in it changing how they live. It is where Kaguya-hime is raised and where the Moon comes to collect her.',
    },
    {
      name: 'The Moonlit Veranda',
      description:
        'The veranda where Kaguya-hime receives visitors from behind a screen, and where, in the last months, she sits looking up at the moon until whoever is with her has to ask what is wrong.',
    },
    {
      name: 'The Bamboo Grove',
      description:
        'The grove the old man has worked all his life. One stalk in it once held a child, and for as long as she stays, every stalk he cuts holds gold.',
    },
    {
      name: 'Mount Fuji',
      description:
        'The peak nearest the heavens, chosen as the closest place to the Moon. What is burned here does not finish burning.',
    },
  ],
  characters: [
    {
      name: 'Kaguya-hime',
      description:
        'A radiant girl found as an infant inside a glowing bamboo stalk, grown to womanhood in three months. She refuses everyone without ever saying no, and keeps where she came from to herself until keeping it is no longer possible.',
    },
    {
      name: 'Taketori no Okina',
      description:
        'An elderly bamboo cutter who finds Kaguya-hime in the grove and raises her as his own. He is the only person who tries to bargain with the Moon, and the only one who never once asks her for anything.',
    },
    {
      name: "The Bamboo Cutter's Wife",
      description:
        'The old woman who raises Kaguya-hime beside her husband. She notices her daughter watching the moon months before anyone asks about it, and says nothing until she is told.',
    },
    {
      name: 'The Emperor',
      description:
        'The ruler of Japan, drawn by the reports and unable to be sent away on an errand. He is refused as gently as it is possible to refuse a sovereign, and he takes it better than any of the five nobles.',
    },
    {
      name: 'Prince Ishitsukuri',
      description:
        "Asked for the Buddha's stone begging bowl from India. He buys an ordinary bowl from a temple outside the capital and is caught the moment it fails to glow.",
    },
    {
      name: 'Prince Kuramochi',
      description:
        'Asked for a jewelled branch from Mount Horai. He commissions one from six craftsmen, invents a sea voyage to explain it, and is undone when the craftsmen come to the house asking to be paid.',
    },
    {
      name: 'Minister Abe no Miemasa',
      description:
        'Asked for a robe woven from the fur of the fire-rat, which cannot burn. He pays an enormous sum for one from a Chinese merchant, and it goes up at the first touch of flame.',
    },
    {
      name: 'Counselor Otomo no Miyuki',
      description:
        "Asked for the five-coloured jewel from a dragon's neck. He sails after it, is caught by a storm that nearly kills him, and returns telling everyone that Kaguya-hime tried to have him drowned.",
    },
    {
      name: 'Counselor Isonokami no Marotari',
      description:
        'Asked for the cowrie shell a swallow is said to bear. He has himself hauled up to a nest, finds nothing, and falls - the only suitor whose failure costs him more than his pride.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 1, 2, 3, 4, 8, 9, 10, 11],
    [0, 1, 3, 9, 10, 11],
    [8, 10, 11],
    [4, 5],
    [4, 5],
    [4, 6],
    [4, 6],
    [4, 7],
  ],
  relations: [
    { pair: [0, 1], type: 'Foster father' },
    { pair: [0, 2], type: 'Foster mother' },
    { pair: [1, 2], type: 'Married' },
    { pair: [0, 3], type: 'Courted, and refused' },
    { pair: [1, 3], type: 'Petitioned him for protection' },
    { pair: [0, 4], type: 'Suitor' },
    { pair: [0, 5], type: 'Suitor' },
    { pair: [0, 6], type: 'Suitor' },
    { pair: [0, 7], type: 'Suitor' },
    { pair: [0, 8], type: 'Suitor' },
  ],
  items: [
    {
      name: 'The Elixir of Immortality',
      description:
        "A vial of the Moon people's elixir, left behind as a parting kindness. It grants eternal life to a man who has just been given the only reason he would not want one.",
      category: 'Celestial object',
      initialState: "In the Moon retinue's keeping",
      owner: null,
      journey: [
        { scene: 9, state: "Spoken of, as the Moon's parting gift", owner: null },
        { scene: 10, state: 'Left behind beside the letter', owner: null },
        { scene: 11, state: 'Burned on the summit', owner: 3 },
      ],
    },
    {
      name: "Kaguya-hime's Farewell Letter",
      description:
        'The last thing she writes as herself, addressed to the Emperor, before the Robe of Feathers takes every attachment she has with it.',
      category: 'Celestial object',
      initialState: 'Unwritten',
      owner: 0,
      journey: [
        { scene: 9, state: 'Begun in secret', owner: 0 },
        { scene: 10, state: 'Left for the Emperor', owner: 3 },
        { scene: 11, state: 'Read, then burned', owner: 3 },
      ],
    },
    {
      name: 'The Jewelled Branch of Horai',
      description:
        'A branch of silver and gold and white jade, made over three years by six of the finest craftsmen in the capital, and presented as though it had been picked on a mountain that may not exist.',
      category: 'Forged treasure',
      initialState: 'Commissioned, not yet made',
      owner: 5,
      journey: [
        { scene: 4, state: 'Ordered from six craftsmen', owner: 5 },
        { scene: 5, state: 'Presented as brought from Horai', owner: 0 },
        { scene: 7, state: 'Exposed when the craftsmen ask to be paid', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'The Robe of Feathers',
      description:
        'Whoever puts on the celestial Robe of Feathers forgets every earthly attachment at once - love, grief, obligation, the people who raised them. It is not a punishment. It is simply what returning to the Moon requires, and Kaguya-hime asks to finish her letter before it is placed on her.',
    },
    {
      title: 'The Impossible Treasures',
      description:
        'Kaguya-hime never refuses a suitor. She sets each one a task that cannot be completed, so that every refusal is his failure rather than her rejection - which lets four of the five keep their standing by lying about it, and is exactly why the fifth is the one who gets hurt.',
    },
    {
      title: 'Nothing of the Moon Stays',
      description:
        'What comes from the Moon returns to it, and what it leaves behind is worth nothing to whoever keeps it. Gold fills the bamboo only while she is here; the elixir offers a man forever, on the one morning forever has stopped being worth having.',
    },
  ],
  notes: [
    {
      title: 'Continuity: the gold stops',
      body: 'The bamboo yields gold only for as long as Kaguya-hime is in the house. Nothing says so out loud, but no scene after her departure may show the old man wealthy.',
    },
    {
      title: 'Visual motif: light from inside',
      body: 'The stalk glows, the child glows, the retinue descends glowing, and the mountain smokes. Every turning point in the story is lit from within the thing itself.',
    },
    {
      title: 'Revision goal: she never says no',
      body: 'Kaguya-hime declines five nobles and an emperor without once refusing anyone. Keep every rejection phrased as a condition, so the failure always belongs to the man who accepted it.',
    },
  ],
  tags: ['Turning point', 'Foreshadowing', 'Conflict', 'Resolution'],
  choiceLabel: 'Continue toward',
  triggers: { set: 'moon_secret_told', unset: 'suitors_still_hoping' },
  effects: [
    { type: 'itemGrant', item: 1, scene: 10 },
    { type: 'itemTake', item: 2, scene: 7 },
    { type: 'triggerSet', item: null, scene: 9 },
    { type: 'triggerUnset', item: null, scene: 7 },
  ],
};

const princessKaguyaPt: StoryNarrative = {
  chapters: [
    {
      name: 'O Conto do Cortador de Bambu',
      summary:
        'Um casal de velhos sem filhos encontra uma criança dentro de um talo de bambu, e o bambuzal passa a pagar pelo sustento dela na mesma velocidade em que ela cresce.',
    },
    {
      name: 'Cinco Tesouros Impossíveis',
      summary:
        'Kaguya-hime nunca recusa ninguém. Pede a cada um de cinco nobres uma coisa que não existe, e quatro deles voltam mentindo.',
    },
    {
      name: 'A Décima Quinta Noite',
      summary:
        'O Imperador não pode ser adiado com uma tarefa impossível, e a Lua não pode ser adiada de forma alguma. Tudo o que Kaguya-hime deixa para trás acaba não valendo nada para quem a queria.',
    },
  ],
  scenes: [
    {
      name: 'Uma criança no bambu',
      summary:
        'Cortando bambu como em todos os dias de sua vida, Taketori no Okina encontra um talo brilhando por dentro. Dentro dele há uma criança não maior que sua mão, e ele a leva para casa nas palmas.',
      location: 3,
    },
    {
      name: 'Crescendo como bambu na primavera',
      summary:
        'A criança chega à idade adulta em três meses. Nem o velho nem a esposa perguntam por quê; querem uma filha há quarenta anos e não estão inclinados a interrogar uma.',
      location: 1,
    },
    {
      name: 'Ouro em cada talo',
      summary:
        'Desde o dia em que a encontra, todo talo que o velho corta tem ouro dentro. A casa enriquece sem que ninguém tenha decidido enriquecer, e é o primeiro indício de que ela é sustentada de outro lugar.',
      location: 3,
    },
    {
      name: 'O nome Kaguya-hime',
      summary:
        'A festa de nomeação dura três dias, e ela recebe o nome de Princesa Radiante do Bambu Flexível. A notícia de sua beleza sai da casa com os convidados e não para mais de viajar.',
      location: 1,
    },
    {
      name: 'Cinco pretendentes no portão',
      summary:
        'Cinco nobres acampam diante da casa e se recusam a ir embora. Kaguya-hime não quer nenhum deles e não vai dizê-lo, porque a recusa recairia sobre o velho, que precisa conviver com essas famílias.',
      location: 0,
    },
    {
      name: 'A tigela de pedra e o ramo enjoiado',
      summary:
        'Ela impõe a cada pretendente um tesouro a buscar. O príncipe Ishitsukuri manda vir uma tigela comum de um templo fora da capital; o príncipe Kuramochi encomenda um ramo a seis joalheiros e conta uma longa história sobre navegar até o Monte Horai.',
      location: 2,
    },
    {
      name: 'O manto de rato-de-fogo e a joia do dragão',
      summary:
        'O ministro Abe paga uma fortuna por um manto que queima na primeira chama que encontra. O conselheiro Otomo faz-se ao mar atrás de uma joia do pescoço de um dragão, quase se afoga numa tempestade e volta jurando que a vítima foi ele.',
      location: 2,
    },
    {
      name: 'A concha da andorinha',
      summary:
        'O conselheiro Isonokami sobe até um ninho de andorinha atrás de uma concha que não está lá, e cai. Os joalheiros chegam naquela mesma semana cobrando o pagamento do ramo, e as cinco histórias desmoronam de uma vez.',
      location: 0,
    },
    {
      name: 'A corte do Imperador',
      summary:
        'O Imperador do Japão ouve os relatos e vem pessoalmente. É o único homem que não pode ser mandado atrás de um objeto impossível, e Kaguya-hime lhe diz com todas as letras que não é deste país - o que ele toma por modéstia.',
      location: 0,
    },
    {
      name: 'Um segredo da Lua',
      summary:
        'Com a aproximação da décima quinta noite do oitavo mês, ela não consegue parar de chorar. Enfim conta ao casal de velhos de onde veio, que seu povo virá buscá-la, e que nada que alguém faça poderá impedir.',
      location: 2,
    },
    {
      name: 'O manto de plumas',
      summary:
        'Dois mil soldados do Imperador cercam a casa. Uma comitiva luminosa desce assim mesmo, os soldados não conseguem erguer os braços, e Kaguya-hime deixa uma carta e um frasco antes que o manto lhe seja posto sobre os ombros e ela esqueça todos eles.',
      location: 1,
    },
    {
      name: 'A montanha da imortalidade',
      summary:
        'O Imperador lê a carta e recusa o elixir: a eternidade sem ela é a última coisa que quer. Manda queimar ambos no pico mais próximo do céu, e a fumaça não parou de subir do Monte Fuji desde então.',
      location: 4,
    },
  ],
  startScene: 0,
  finishScenes: [11],
  locations: [
    {
      name: 'A Capital e Suas Províncias',
      description:
        'O território que o Imperador governa e as estradas que levam o boato por ele. Tudo o que dá errado para um pretendente acontece em algum ponto daqui de fora, longe da vista da casa.',
    },
    {
      name: 'A Casa do Cortador de Bambu',
      description:
        'Uma casa pequena que se torna rica em uma estação, sem que ninguém lá dentro mude o próprio modo de viver. É onde Kaguya-hime é criada e onde a Lua vem buscá-la.',
    },
    {
      name: 'A Varanda ao Luar',
      description:
        'A varanda onde Kaguya-hime recebe visitas por trás de um biombo e onde, nos últimos meses, fica olhando para a lua até que quem esteja com ela precise perguntar o que há.',
    },
    {
      name: 'O Bambuzal',
      description:
        'O bambuzal em que o velho trabalha a vida inteira. Um talo dali abrigou uma criança, e enquanto ela ficar, todo talo que ele cortar terá ouro.',
    },
    {
      name: 'O Monte Fuji',
      description:
        'O pico mais próximo dos céus, escolhido como o lugar mais perto da Lua. O que se queima aqui não termina de queimar.',
    },
  ],
  characters: [
    {
      name: 'Kaguya-hime',
      description:
        'Uma menina radiante encontrada ainda bebê dentro de um talo de bambu luminoso, adulta em três meses. Recusa todo mundo sem nunca dizer não, e guarda para si de onde veio até que guardar deixe de ser possível.',
    },
    {
      name: 'Taketori no Okina',
      description:
        'Um velho cortador de bambu que encontra Kaguya-hime no bambuzal e a cria como filha. É a única pessoa que tenta negociar com a Lua, e a única que nunca lhe pede nada.',
    },
    {
      name: 'A Esposa do Cortador de Bambu',
      description:
        'A velha que cria Kaguya-hime ao lado do marido. Nota a filha olhando para a lua meses antes de alguém perguntar, e nada diz até que lhe contem.',
    },
    {
      name: 'O Imperador',
      description:
        'O soberano do Japão, atraído pelos relatos e impossível de ser mandado a um mandado qualquer. É recusado do modo mais gentil com que se pode recusar um soberano, e leva melhor que qualquer um dos cinco nobres.',
    },
    {
      name: 'Príncipe Ishitsukuri',
      description:
        'Encarregado de trazer a tigela de pedra de Buda, vinda da Índia. Compra uma tigela comum num templo fora da capital e é desmascarado no instante em que ela não brilha.',
    },
    {
      name: 'Príncipe Kuramochi',
      description:
        'Encarregado de trazer um ramo enjoiado do Monte Horai. Encomenda um a seis artesãos, inventa uma viagem marítima para explicá-lo, e se desmonta quando os artesãos aparecem na casa pedindo para receber.',
    },
    {
      name: 'Ministro Abe no Miemasa',
      description:
        'Encarregado de trazer um manto tecido com pelo do rato-de-fogo, que não queima. Paga uma soma enorme por um a um mercador chinês, e ele se desfaz ao primeiro toque de chama.',
    },
    {
      name: 'Conselheiro Otomo no Miyuki',
      description:
        'Encarregado de trazer a joia de cinco cores do pescoço de um dragão. Sai em busca dela pelo mar, é apanhado por uma tempestade que quase o mata, e volta dizendo a todos que Kaguya-hime tentou afogá-lo.',
    },
    {
      name: 'Conselheiro Isonokami no Marotari',
      description:
        'Encarregado de trazer a concha que se diz nascer de uma andorinha. Manda içar-se até um ninho, não encontra nada e cai - o único pretendente cujo fracasso lhe custa mais que o orgulho.',
    },
  ],
  presence: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [0, 1, 2, 3, 4, 8, 9, 10, 11],
    [0, 1, 3, 9, 10, 11],
    [8, 10, 11],
    [4, 5],
    [4, 5],
    [4, 6],
    [4, 6],
    [4, 7],
  ],
  relations: [
    { pair: [0, 1], type: 'Pai adotivo' },
    { pair: [0, 2], type: 'Mãe adotiva' },
    { pair: [1, 2], type: 'Casados' },
    { pair: [0, 3], type: 'Cortejada, e recusou' },
    { pair: [1, 3], type: 'Pediu-lhe proteção' },
    { pair: [0, 4], type: 'Pretendente' },
    { pair: [0, 5], type: 'Pretendente' },
    { pair: [0, 6], type: 'Pretendente' },
    { pair: [0, 7], type: 'Pretendente' },
    { pair: [0, 8], type: 'Pretendente' },
  ],
  items: [
    {
      name: 'O Elixir da Imortalidade',
      description:
        'Um frasco do elixir do povo da Lua, deixado como gentileza de despedida. Concede vida eterna a um homem que acaba de receber o único motivo para não querer uma.',
      category: 'Objeto celeste',
      initialState: 'Sob a guarda da comitiva da Lua',
      owner: null,
      journey: [
        { scene: 9, state: 'Mencionado, como presente de despedida da Lua', owner: null },
        { scene: 10, state: 'Deixado ao lado da carta', owner: null },
        { scene: 11, state: 'Queimado no cume', owner: 3 },
      ],
    },
    {
      name: 'A Carta de Despedida de Kaguya-hime',
      description:
        'A última coisa que ela escreve sendo ela mesma, endereçada ao Imperador, antes que o Manto de Plumas leve embora todo apego que ela tem.',
      category: 'Objeto celeste',
      initialState: 'Por escrever',
      owner: 0,
      journey: [
        { scene: 9, state: 'Começada em segredo', owner: 0 },
        { scene: 10, state: 'Deixada para o Imperador', owner: 3 },
        { scene: 11, state: 'Lida, e depois queimada', owner: 3 },
      ],
    },
    {
      name: 'O Ramo Enjoiado de Horai',
      description:
        'Um ramo de prata, ouro e jade branco, feito ao longo de três anos por seis dos melhores artesãos da capital, e apresentado como se tivesse sido colhido numa montanha que talvez não exista.',
      category: 'Tesouro forjado',
      initialState: 'Encomendado, ainda por fazer',
      owner: 5,
      journey: [
        { scene: 4, state: 'Encomendado a seis artesãos', owner: 5 },
        { scene: 5, state: 'Apresentado como trazido de Horai', owner: 0 },
        { scene: 7, state: 'Desmascarado quando os artesãos vêm cobrar', owner: null },
      ],
    },
  ],
  worldRules: [
    {
      title: 'O Manto de Plumas',
      description:
        'Quem veste o celeste Manto de Plumas esquece de imediato todo apego terreno - amor, luto, obrigação, as pessoas que o criaram. Não é castigo. É apenas o que voltar à Lua exige, e Kaguya-hime pede para terminar a carta antes que o ponham sobre ela.',
    },
    {
      title: 'Os Tesouros Impossíveis',
      description:
        'Kaguya-hime nunca recusa um pretendente. Impõe a cada um uma tarefa que não pode ser cumprida, de modo que toda recusa seja fracasso dele e não rejeição dela - o que permite a quatro dos cinco preservarem a posição mentindo, e é exatamente por isso que o quinto é o único que se machuca.',
    },
    {
      title: 'Nada da Lua Permanece',
      description:
        'O que vem da Lua volta para ela, e o que ela deixa não vale nada para quem fica. O ouro enche o bambu apenas enquanto ela está aqui; o elixir oferece a um homem o para sempre, justo na manhã em que o para sempre deixou de valer a pena.',
    },
  ],
  notes: [
    {
      title: 'Continuidade: o ouro acaba',
      body: 'O bambu só dá ouro enquanto Kaguya-hime está na casa. Nada diz isso em voz alta, mas nenhuma cena depois da partida dela pode mostrar o velho rico.',
    },
    {
      title: 'Motivo visual: luz vinda de dentro',
      body: 'O talo brilha, a criança brilha, a comitiva desce brilhando, e a montanha fumega. Todo ponto de virada da história é iluminado de dentro da própria coisa.',
    },
    {
      title: 'Meta de revisão: ela nunca diz não',
      body: 'Kaguya-hime declina cinco nobres e um imperador sem recusar ninguém uma única vez. Manter toda rejeição formulada como condição, para que o fracasso pertença sempre ao homem que a aceitou.',
    },
  ],
  tags: ['Ponto de virada', 'Prenúncio', 'Conflito', 'Resolução'],
  choiceLabel: 'Continuar em direção a',
  triggers: { set: 'segredo_da_lua_contado', unset: 'pretendentes_ainda_esperancosos' },
  effects: [
    { type: 'itemGrant', item: 1, scene: 10 },
    { type: 'itemTake', item: 2, scene: 7 },
    { type: 'triggerSet', item: null, scene: 9 },
    { type: 'triggerUnset', item: null, scene: 7 },
  ],
};

export const princessKaguya: LocalizedNarrative = {
  en: princessKaguyaEn,
  pt: princessKaguyaPt,
};
