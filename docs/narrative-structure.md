# Estrutura narrativa: capítulos, cenas, eventos, âncoras, tramas, rotas e escolhas

Este documento descreve como os objetos narrativos do Keres se conectam. Ele é uma referência de modelo e comportamento: os nomes podem mudar pelo Vocabulário da história, mas os tipos, ids, sincronização e regras abaixo continuam os mesmos.

## Visão geral

```text
Story
├── Chapter / Event (containers editoriais)
│   ├── Scene (unidade narrativa e temporal)
│   └── ChapterAnchor (quando o container acontece na linha do tempo)
├── Plot ──< PlotScene >── Scene       (trama: participação N:N)
└── [branching]
    ├── Scene ── Choice ──> Scene      (grafo de leitura)
    ├── ChoiceCheckGroup ─< ChoiceCheck (quando uma escolha está disponível)
    ├── Scene / Choice ── Effect        (muda o estado da simulação)
    └── Route ──< RouteStep              (um percurso autoral pelo grafo)
```

Uma mesma cena pode participar de um capítulo, de várias tramas, de uma rota e de várias escolhas. Essas relações respondem perguntas diferentes; nenhuma deve ser usada como substituta da outra.

## Os três eixos da história

Há três formas independentes de organizar a mesma narrativa.

| Eixo | Pergunta que responde | Objetos principais |
|---|---|---|
| Editorial | “Em que ordem o autor apresenta isto?” | Chapter, Event e `index` de Scene |
| Temporal | “Quando isto acontece no universo?” | gap, duration, data inicial, calendário, data fixa e ChapterAnchor |
| Causal/de leitura | “Para onde o leitor pode ir?” | Choice, checks, effects e Route |

Por exemplo, um flashback pode ser o quinto capítulo na ordem editorial, acontecer antes do primeiro capítulo na linha do tempo e estar acessível por uma escolha específica no grafo. Isto é válido e é justamente a razão de os eixos não compartilharem uma única “ordem”.

## Chapter e Event

`Chapter` e `Event` usam o mesmo container persistido, diferenciado por `type`:

- **Chapter** agrupa cenas e representa a organização editorial comum de uma história.
- **Event** representa um acontecimento, período ou camada histórica que pode atravessar cenas ou existir apenas como contexto temporal.

Cada tipo possui seu próprio espaço de índice. O índice dos capítulos forma a espinha editorial usada pela timeline linear; o de eventos serve para a organização do autor, não para afirmar uma cronologia universal. Cenas podem não ter capítulo: fragmentos, estudos e anotações narrativas não precisam ser forçados a um container.

Um capítulo ou evento pode existir sem âncora. Nesse caso ele não declara quando ocorre; continua sendo útil como estrutura editorial ou temática.

## Scene: a unidade fundamental

Uma `Scene` é a menor unidade narrativa que o sistema mede. Ela pode ter:

- um Chapter opcional e um `index` dentro da organização editorial;
- uma Location opcional;
- `gap` + unidade: intervalo entre o fim da cena anterior na espinha e o início desta;
- `duration` + unidade: quanto a própria cena dura;
- uma data fixa opcional (`calendarDateOverride`), em coordenadas normalizadas, associada ao calendário gregoriano interno ou a um calendário customizado;
- marcadores de início/fim e conteúdo descritivo.

Na história linear, cenas de capítulos consecutivos formam a **espinha temporal**: gap, início, duração e fim são calculados cumulativamente a partir da data/hora inicial da Story, caso ela exista. Uma Scene com data fixa é uma exceção explícita a essa interpretação relativa para aquela cena; o dado é guardado como coordenadas, não como texto de mês/era, para sobreviver a renomes de calendário.

`gap` não é uma data absoluta. Ele continua descrevendo o intervalo narrativo relativo. Datas, calendários e âncoras apenas oferecem maneiras de interpretar ou posicionar essa espinha.

Em uma história branching, o grafo de escolhas não inventa uma cronologia. As telas temporais usam a espinha editorial disponível; um autor não deve inferir que duas cenas em ramos diferentes ocorrem em sequência somente porque uma Choice aponta para a outra.

## ChapterAnchor: posicionar um container no tempo

`ChapterAnchor` não ancora uma Scene. Ele ancora um Chapter ou Event a um ou mais trechos da espinha de cenas.

Cada âncora define:

- o container (`chapterId`);
- um ponto inicial: Scene + posição `start`, `middle` ou `end`;
- offset opcional, inclusive negativo, em uma unidade de tempo;
- um ponto final opcional, com a mesma estrutura.

Sem ponto final, o trecho permanece aberto e a duração é lida das cenas do próprio container. Com ponto final, ele declara um intervalo explícito. Um container que pausa e retorna pode ter vários trechos, ordenados por `order`; um trecho aberto não pode coexistir com outro do mesmo container, pois não haveria como saber onde separar seus conteúdos.

Use uma âncora para afirmar, por exemplo, “esta guerra começou 300 anos antes da Cena A” ou “este capítulo de flashback acontece entre o meio da Cena X e o fim da Cena Y”. Ela não reordena cenas, não altera uma Choice e não grava uma nova data nas cenas de referência.

## Plot e PlotScene: uma trama não é um percurso

`Plot` é uma linha temática/narrativa: romance, conspiração, arco de personagem, mistério etc. Ela funciona tanto em histórias lineares quanto branching.

Uma cena entra em uma trama por `PlotScene`, uma relação N:N com:

- `plotId`;
- `sceneId`;
- uma nota curta obrigatória que explica o papel daquela cena na trama.

Uma cena pode pertencer a várias tramas e uma trama pode começar vazia. Em uma história linear a participação pode ser lida seguindo a ordem editorial; em branching, a interface apresenta a distribuição no grafo, sem fingir que existe uma única ordem de leitura.

Uma Plot não escolhe transições, não limita Choices e não é uma Route. A Plot responde “do que esta cena trata nesta linha narrativa?”, e não “qual caminho o leitor percorreu?”.

## Choice, checks e effects: o grafo branching

Uma `Choice` é uma aresta explícita:

```text
Scene de origem (sceneId) ── Choice: text ──> próxima Scene (nextSceneId)
```

Ela só existe em histórias branching. Histórias lineares avançam pela ordem das cenas, sem Choices explícitas.

### Disponibilidade de uma escolha

Uma Choice pode ter grupos de condições (`ChoiceCheckGroup`).

- Dentro de um grupo, checks combinam por **AND** ou **OR**.
- Entre grupos da mesma Choice, todos os grupos precisam passar (**AND**).
- Um check em modo `enable` passa quando sua condição é verdadeira.
- Um check em modo `block` passa quando sua condição é falsa; se ela se torna verdadeira, bloqueia a Choice.

Os checks podem avaliar:

- quantidade de visitas a uma Scene;
- presença/ausência de um Item no inventário simulado;
- estado definido/indefinido de um trigger nomeado.

`Effect` é o lado que escreve esse estado. Uma Scene ou Choice pode conceder/remover um Item ou definir/remover um trigger. Ao simular a história, entrar em uma cena registra a visita e aplica os effects da cena; escolher uma Choice aplica seus effects. Esse estado é transitório do Navigator ou Reader: não altera os dados da Story, itens reais ou triggers persistidos.

## Route e RouteStep: um caminho autoral verificável

Uma `Route` pertence apenas a uma história branching e representa um percurso possível que o autor quer nomear, revisar ou oferecer ao Reader. Não é save game, nem Plot.

`RouteStep` registra uma **visita**, não apenas uma Scene:

- `position` é contínua, de 1 até N;
- `sceneId` é a cena visitada;
- `selectedChoiceId` é a Choice tomada ao sair dela;
- no último passo, `selectedChoiceId` é `null`.

Guardar passos em vez de uma lista de ids de cena torna loops inequívocos: uma rota pode visitar a mesma Scene mais de uma vez. A validação confirma que cada Choice existe, sai da cena do passo e chega à Scene do passo seguinte. Rotas inválidas não são apagadas automaticamente: continuam sendo intenção histórica do autor e são mostradas como precisando de revisão.

O Story Navigator usa as mesmas regras de checks/effects para uma simulação superficial. O caminho visitado pode virar Route; o estado simulado de itens e triggers não é salvo na Route.

## Exemplos práticos

### História linear com flashback

1. Capítulo “Retorno” é o capítulo 5 na ordem editorial.
2. Suas cenas têm gaps/durations normais para a leitura.
3. Um ChapterAnchor o posiciona 20 anos antes da Cena 1.
4. A Plot “Origem do conflito” inclui duas cenas desse capítulo e uma cena do presente.

O leitor continua vendo o flashback no ponto editorial escolhido. A timeline explica que ele ocorre antes; a Plot explica por que as três cenas pertencem ao mesmo arco.

### História branching com rota

1. Cena A tem Choices para B e C.
2. A Choice A → B exige trigger `hasKey` definido.
3. A cena anterior ou a própria Choice que encontra a chave possui effect `triggerSet(hasKey)`.
4. A Route “Fuga pelo arquivo” registra A, a Choice A → B, B e assim por diante.

Se a Choice mudar para apontar a D, a Route não é silenciosamente reescrita. A validação indica que ela não representa mais um caminho válido e o autor pode ajustá-la conscientemente.

## Regras de escolha rápida

| Se você quer… | Use… |
|---|---|
| Agrupar cenas como o leitor as encontra | Chapter |
| Registrar um acontecimento/período que pode atravessar a história | Event |
| Medir o que acontece e quanto tempo dura | Scene + gap/duration |
| Dizer quando um capítulo ou evento ocorreu em relação à história | ChapterAnchor |
| Mostrar o papel de uma cena em um arco temático | Plot + PlotScene |
| Criar uma bifurcação de leitura | Choice |
| Restringir uma Choice conforme estado narrativo | ChoiceCheckGroup + ChoiceCheck |
| Alterar o estado usado por checks | Effect |
| Declarar um caminho possível de ponta a ponta | Route + RouteStep |

## Persistência e sincronização

Todos os objetos deste documento são entidades sincronizáveis da Story. Eles participam de exportação e importação, operation log, tombstones e resolução de conflitos. Relações como `PlotScene`, `RouteStep`, `ChapterAnchor`, checks e effects não são detalhes descartáveis da interface: elas são dados autorais e precisam acompanhar a Story quando ela sai ou volta ao dispositivo.

Para detalhes de checks e effects, consulte também [choice_mechanics.md](choice_mechanics.md). Para o fluxo de telas, consulte [screen_flow.md](screen_flow.md).

