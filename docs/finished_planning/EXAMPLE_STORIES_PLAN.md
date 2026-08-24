# Plano: histórias de exemplo como vitrine completa do sistema

## Objetivo

Cada história empacotada em `apps/client/src/exampleStories/content/<slug>/{en,pt}.json` deve
exercitar **tudo** que o formato de exportação carrega e que o tipo daquela história permite.
Instalar um exemplo tem que ser suficiente para a pessoa abrir qualquer tela, qualquer gráfico e
qualquer exportação SVG e ver algo cheio e coerente — não uma tela vazia com "nenhum item".

Hoje isso não acontece: nenhum exemplo tem status, modos, mais de um capítulo, ou presença de
personagem em mais de duas cenas. Metade dos produtos visuais do app abre praticamente vazia.

## Estado atual

Contagens por coleção (idioma `en`; `pt` é paralelo):

| Coleção | alice | beauty | cinder | goldi | mermaid | kaguya |
|---|---:|---:|---:|---:|---:|---:|
| tipo | branching | branching | linear | linear | linear | linear |
| chapters | 1 | 1 | 1 | 1 | 1 | 1 |
| scenes | 7 | 10 | 7 | 5 | 7 | 8 |
| characters | 5 | 6 | 6 | 4 | 5 | 9 |
| **characterScenes** | **2** | **2** | **2** | **2** | **2** | **2** |
| characterRelations | 4 | 5 | 5 | 3 | 4 | 9 |
| locations | 3 | 3 | 2 | 2 | 3 | 3 |
| locationRelations | 1 | 1 | 1 | 1 | 1 | 1 |
| items | 2 | 3 | 3 | 2 | 2 | 2 |
| itemJourneys | 2 | 3 | 5 | 2 | 3 | 4 |
| choices | 7 | 10 | — | — | — | — |
| choiceCheckGroups / Checks | 1 / 1 | 1 / 1 | — | — | — | — |
| effects | 1 | 1 | 1 | 1 | 1 | 1 |
| plots / plotScenes | — | — | 1 / 3 | 1 / 3 | 1 / 3 | 1 / 3 |
| **stats / strengths / relations** | **0** | **0** | **0** | **0** | **0** | **0** |
| **modes** | **0** | **0** | **0** | **0** | **0** | **0** |
| **galleryItems** | **0** | **0** | **0** | **0** | **0** | **0** |
| notes / noteRelations | 2 / 2 | 2 / 2 | 1 / 1 | 1 / 1 | 2 / 2 | 1 / 1 |
| tags / tagRelations | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 | 3 / 3 |
| worldRules | 2 | 2 | 2 | 1 | 2 | 1 |
| comments | 1 | 1 | 1 | 1 | 1 | 1 |
| seeAlsoRelations | 1 | 1 | 1 | 1 | 1 | 1 |
| favorites | 1 | 1 | 1 | 1 | 1 | 1 |
| storySchemaFields / attributeValues | 2 / 4 | 2 / 4 | 2 / 4 | 2 / 4 | 2 / 4 | 2 / 4 |
| suggestions | 12 | 12 | 12 | 12 | 12 | 12 |
| cenas com tempo (gap/duration) | 0 | 1 | 0 | 0 | 0 | 0 |

Buracos de variedade, além das contagens:

- `effects` é sempre um único `triggerSet`; `itemGrant`, `itemTake` e `triggerUnset` nunca
  aparecem.
- `choiceChecks` é sempre um único `sceneCount`; `inventory` e `trigger` nunca aparecem.
- `storySchemaFields` são sempre dois campos do tipo `suggestion`; os outros seis tipos
  (`text`, `long_text`, `number`, `boolean`, `date`, `suggestion_list`, `entity`) nunca aparecem.
- `locationRelations` é sempre um único `connected_to`; `contains` nunca aparece, então o mapa
  de locais nunca mostra hierarquia.
- `seeAlsoRelations` é sempre `Character ↔ Location`, de oito tipos possíveis.
- `comments` sempre em `Character.description`, criticidade 2, de uma escala de 1 a 5.
- `favorites` sempre na própria `Story`.
- Todas as histórias têm `statSystem: false`.

### Linha de base da Análise da História

Rodando `buildStoryAnalysisReport` sobre cada exemplo de hoje:

| História | Achados | Quais |
|---|---:|---|
| alice-in-wonderland | 4 | 3× personagem sem cena, 1× local sem ligação |
| beauty-and-the-beast | 5 | 4× personagem sem cena, 1× local sem ligação |
| cinderella | 4 | 4× personagem sem cena |
| goldilocks | 4 | 2× personagem sem cena, 1× personagem sem relação, 1× local não usado |
| little-mermaid | 4 | 3× personagem sem cena, 1× local sem ligação |
| princess-kaguya | 8 | 7× personagem sem cena, 1× local sem ligação |

Nenhum exemplo passa limpo hoje. A boa notícia é que os achados são exatamente os que as fases
2 e 3 resolvem por consequência: personagem sem cena some quando todo personagem entra em
`characterScenes`, e local sem ligação some quando o mapa de locais ganha hierarquia. Ou seja,
"zero achados" não é uma meta extra — é o efeito colateral de atingir os alvos das tabelas
acima, e por isso vale como guarda automatizada.

As duas histórias ramificadas já passam limpo nas checagens caras (alcançabilidade e
satisfazibilidade de escolha); a Fase 6 precisa manter isso ao adicionar ciclo e finais
alternativos.

## O que cada produto visual exige para "ficar completo"

| Produto | Onde | Precisa de |
|---|---|---|
| Mapa da história (SVG) | `storyGraphSvg` | história ramificada com múltiplos capítulos (cores por capítulo), bifurcação, reencontro, pelo menos um ciclo e um final alternativo |
| Mapa de locais (SVG) | `locationGraphSvg` | `contains` **e** `connected_to`, com ao menos dois níveis de hierarquia |
| Mapa de relações (SVG) | `characterRelationGraphSvg` | ≥ 6 personagens e relações que formem grupos, não uma estrela só |
| Matriz de presença (SVG) | `presenceMatrixSvg` | **muitos `characterScenes`** — hoje 2 por história deixa a matriz quase vazia; com o fio novo, ideal é ter personagem contínuo, personagem com vão e personagem de uma cena só |
| Matriz de itens (SVG) | mesma matriz, `kind: item` | ≥ 3 itens com ≥ 3 paradas cada, com estados diferentes |
| Matriz de tramas (SVG) | `presenceMatrixSvg` via Plot | ≥ 3 tramas com sobreposição parcial de cenas (linear) |
| Cobertura de tramas (SVG) | `plotCoverageSvg` | tramas com coberturas bem diferentes entre si, incluindo uma trama vazia |
| Linha do tempo (SVG) | `storyTimelineSvg` | `gap`/`gapType` e `duration`/`durationType` na maioria das cenas, com unidades variadas |
| Radar de status | `statRadarSvg` | `statSystem: true`, 4–6 status primários, ≥ 3 personagens com valores, e ao menos um personagem com **modo** |
| Régua de tiers | `statLadderBarLayout` | escada padrão da história + ao menos um status com escada própria |
| Ranking / comparação | telas de Stats | valores suficientemente espalhados para o ranking não ser um empate |
| Leitor de tramas | `PlotReaderScreen` | resumo preenchido em todas as cenas |
| Análise da história | `storyAnalysisChecks` | idealmente **zero** achados: o exemplo é a referência de história bem-formada |

## Alvo por história

Regra geral: **toda** história cobre tudo que o tipo dela permite. O que muda entre elas é a
escala e o tema, não quais recursos aparecem.

### Mínimos comuns (linear e ramificada)

| Coleção | Mínimo | Observação |
|---|---:|---|
| chapters | 3 | dá cor de capítulo aos gráficos e valida a numeração 1..N |
| scenes | 12 | 3–5 por capítulo |
| cenas com `gap` + `duration` | 80% | unidades variadas (`minutes`, `hours`, `days`, `years`) |
| characters | 6 | |
| characterScenes | 18 | ≥ 3 personagens presentes em ≥ 4 cenas cada |
| characterRelations | 6 | pelo menos dois agrupamentos distintos |
| locations | 5 | |
| locationRelations | 4 | ao menos 2 `contains` e 2 `connected_to` |
| items | 3 | |
| itemJourneys | 9 | ≥ 3 paradas por item, com troca de dono e de estado |
| worldRules | 3 | |
| notes / noteRelations | 3 / 4 | notas ligadas a tipos de entidade diferentes |
| tags / tagRelations | 4 / 10 | mesma tag em tipos diferentes de entidade |
| comments | 4 | campos diferentes, criticidades 1, 3 e 5 |
| seeAlsoRelations | 4 | ao menos 4 pares de tipos diferentes |
| favorites | 3 | Story + Character + Scene |
| storySchemaFields | 8 | **um de cada tipo** de `AttributeType` |
| attributeValues | 12 | todo campo com valor em ao menos duas entidades |
| stats | 5 | `statSystem: true` |
| statStrengths | 12 | escada padrão + uma escada própria de um status |
| statRelations | 20 | ≥ 4 personagens × 5 status |
| modes | 2 | ao menos um personagem com modo, com valores próprios |
| effects | 4 | um de cada: `itemGrant`, `itemTake`, `triggerSet`, `triggerUnset` |
| suggestions | 12+ | catálogos dos campos de sugestão usados |

### Só em história linear (Cinderela, Cachinhos, Sereia, Kaguya)

| Coleção | Mínimo | Observação |
|---|---:|---|
| plots | 4 | incluindo **uma trama vazia**, para a média de cobertura mostrar o caso |
| plotScenes | 14 | coberturas distintas: uma trama quase completa, uma esparsa, uma concentrada em um ato |

### Só em história ramificada (Alice, A Bela e a Fera)

| Coleção | Mínimo | Observação |
|---|---:|---|
| choices | 16 | bifurcação, reencontro, ciclo e ≥ 2 finais |
| choiceCheckGroups | 4 | ao menos um `AND` e um `OR` |
| choiceChecks | 6 | ao menos um de cada tipo (`sceneCount`, `inventory`, `trigger`) e ao menos um em modo `enable` e um em `block` |

## Restrições invioláveis

Estas não são preferências — quebrar qualquer uma delas produz um exemplo que falha na
instalação, na sincronização ou na Análise:

1. **Numeração 1..N.** Capítulos 1..N na história; cenas 1..M **dentro do capítulo**, sem
   buracos nem repetição. Já existe teste que trava isso (`ExampleStoryService.test.ts`).
2. **Tramas só em história linear**, escolhas/checks só em ramificada. Os serviços recusam o
   contrário, e o drawer esconde Tramas em histórias ramificadas.
3. **`formatVersion: 6`** e todas as coleções presentes (mesmo vazias, quando o schema exige).
4. **Ids em formato ULID** (26 caracteres, alfabeto de Crockford — sem `I`, `L`, `O`, `U`),
   únicos dentro do arquivo. A instalação remapeia todos, mas ids repetidos dentro do mesmo
   arquivo colapsariam duas entidades numa só.
5. **Toda referência tem que existir no próprio arquivo**: `chapterId`, `locationId`,
   `sceneId`, `itemId`, `characterId`, `plotId`, `fieldId`, `entityId` de comentário/atributo/
   favorito/see-also.
6. **Nota de PlotScene**: uma linha, ≤ 160 caracteres.
7. **Máximo de 12 status primários** por história.
8. **`userId`** continua `EXAMPLEUSERPLACEHOLDER0000` em story, comentários e favoritos.
9. **Domínio público**: só obras e textos de domínio público, escritos com nossas palavras.
10. **en e pt paralelos**: mesmos ids, mesma estrutura, só o texto muda. Um recurso presente em
    um idioma tem que existir no outro.

## Fora de escopo, e por quê

- **Galeria (`galleryItems`, `galleryRelations`)**: uma linha de galeria aponta para um arquivo
  de mídia local; exemplos são JSON estático, sem mídia empacotada (ver `ExampleStoryService`).
  Uma linha sem arquivo apareceria como miniatura quebrada — pior que a lista vazia. Fica de
  fora até existir uma forma de empacotar mídia com o exemplo.
- **Dados de sincronização** (`serverLastOperationVersion` > 0, conflitos, permissões,
  publicações): pertencem a uma conta e a um servidor, não ao conteúdo da história.
- **Sugestões literárias / Story Devices**: catálogo do app, não dado de história.

## Execução

Cada fase é independente e verificável; nenhuma depende da fase seguinte.

### Fase 0 — Ferramenta de autoria (antes de tocar em conteúdo)

Escrever `apps/client/scripts/build-example-story.ts` que monte o JSON a partir de uma descrição
enxuta (capítulos → cenas → quem aparece, itens, tramas) e gere ids ULID determinísticos por
slug. Escrever 12 arquivos de ~2.000 linhas à mão, em dois idiomas, com referências cruzadas
corretas, é onde o erro humano entra.

O script cuida de: numeração 1..N, `createdAt/updatedAt` fixos, `version: 1`, campos nulos
obrigatórios, e paridade en/pt (mesmos ids nos dois).

### Fase 1 — Estrutura narrativa

Para as seis histórias: dividir em 3 capítulos, chegar a ≥ 12 cenas, preencher `summary` em
todas, e distribuir `gap`/`duration` com unidades variadas. É a fase que enche a Linha do tempo
e dá cor de capítulo a todos os mapas.

### Fase 2 — Elenco e presença

Subir para ≥ 6 personagens, ≥ 18 `characterScenes` (com os três perfis: contínuo, com vão, de
uma cena só), ≥ 6 relações formando grupos. Enche a Matriz de presença e o Mapa de relações.

### Fase 3 — Mundo

≥ 5 locais com hierarquia (`contains`) e ligações (`connected_to`); ≥ 3 regras de mundo. Enche o
Mapa de locais.

### Fase 4 — Itens

≥ 3 itens com ≥ 3 paradas cada, com troca de dono e de estado. Enche a Matriz de itens e a
Trajetória.

### Fase 5 — Status e modos

`statSystem: true`, 5 status, escada padrão + uma escada própria, valores para ≥ 4 personagens,
2 modos com valores próprios. Enche Radar, Régua, Ranking e Comparação — hoje todos vazios.

### Fase 6 — Tramas (linear) e ramificação (ramificada)

Lineares: 4 tramas (uma vazia) e ≥ 14 relações com coberturas distintas.
Ramificadas: ≥ 16 escolhas com bifurcação, reencontro, ciclo e dois finais; 4 grupos de
condição cobrindo `AND`/`OR` e os três tipos de check; 4 efeitos cobrindo os quatro tipos.

### Fase 7 — Camada editorial

Esquema da história com um campo de **cada** tipo de atributo e valores preenchidos; tags
aplicadas a tipos diferentes de entidade; notas ligadas a entidades diferentes; 4 comentários em
campos e criticidades diferentes; 4 "veja também" entre pares de tipos diferentes; favoritos em
três tipos.

### Fase 8 — Guardas

Testes novos em `apps/client/test/services/ExampleStoryService.test.ts`:

- **matriz de cobertura**: para cada exemplo, cada coleção aplicável ao tipo da história tem no
  mínimo a contagem-alvo desta tabela. É o teste que impede um exemplo novo entrar pela metade;
- **variedade**: os quatro tipos de efeito, os três tipos de check, os oito tipos de atributo,
  os dois tipos de relação de local, ≥ 3 criticidades de comentário;
- **integridade referencial**: toda referência aponta para um id existente no mesmo arquivo;
- **ids**: todos únicos e em formato ULID válido;
- **paridade en/pt**: mesmos ids e mesmas contagens nos dois idiomas;
- **Análise limpa**: `buildStoryAnalysisReport` de cada exemplo instalado devolve zero achados —
  o exemplo é a referência de história bem-formada;
- **tamanho**: cada arquivo abaixo de 250 KB (hoje: 30–46 KB; o alvo triplica o conteúdo, então
  o teto dá folga sem deixar o bundle crescer sem limite).

### Fase 9 — Verificação visual

Com uma história instalada, conferir os nove produtos SVG/gráficos da tabela acima, em tema
claro e escuro, e exportar cada um. É a única fase que não dá para automatizar aqui.

## Riscos

- **Tamanho do bundle**: os exemplos são `import` estático dentro do JS do app. Seis histórias
  triplicando de tamanho saem de ~240 KB para ~700 KB de JSON. Aceitável, mas é o motivo do
  teto de 250 KB por arquivo na Fase 8. Se apertar, o caminho é carregar o conteúdo sob demanda
  em vez de cortar recursos.
- **Tradução**: dobrar o conteúdo dobra o texto a escrever em pt e en. A paridade estrutural é
  testável (Fase 8), a qualidade do texto não.
- **Manutenção**: cada recurso novo do sistema passa a implicar atualizar seis histórias em dois
  idiomas. O teste de cobertura da Fase 8 é o que transforma esse esquecimento em falha de
  build em vez de exemplo silenciosamente desatualizado.
- **Ordem de entrega**: as fases 1 e 2 mudam ids e contagens que as fases seguintes referenciam.
  Fazer uma história inteira de ponta a ponta antes de repetir nas outras cinco é mais seguro
  que fazer uma fase por vez nas seis — sugestão: **Cinderela** primeiro (linear, já é a mais
  completa) e **Alice** em seguida (ramificada), e só então replicar o padrão.
