# Sistema de Status (stats) no Keres

Sistema opcional, ligado por história, para medir personagens em eixos criados pelo autor e
compará-los num gráfico radar. Este documento descreve o modelo de dados, a matemática da escada e
as regras que não cabem em constraint de banco.

## 1. Ligar e desligar

`Story` tem dois campos:

- **`statSystem: boolean`** (padrão `false`) - liga a feature naquela história. Desligado, o item
  "Status" some do menu lateral e o painel some do detalhe do personagem; **nada é apagado**, e
  religar devolve tudo.
- **`statNotation: 'letter' | 'number'`** (padrão `'letter'`) - como os valores são exibidos. Com
  letras aparece o rótulo do degrau (`F`, `C`, `SS`); com números, o próprio valor.

Os dois são editados em Configurações da História e sincronizam junto com o resto da `Story`.

## 2. As quatro entidades

| Entidade | O que é | Campos próprios |
|---|---|---|
| `Stat` | Um eixo mensurável | `name`, `isPrimary`, `order` |
| `StatStrength` | Um degrau da escada de valores | `statId` (anulável), `label`, `minValue` |
| `StatRelation` | O valor de um stat para um personagem | `characterId`, `modeId` (anulável), `statId`, `value` |
| `Mode` | Uma forma alternativa de um personagem | `characterId`, `name`, `modeChanges`, `order` |

**Primário x secundário.** Só os primários viram eixo do radar, e por isso são no máximo **12**
(`MAX_PRIMARY_STATS`); acima disso o desenho fica ilegível. Secundários não têm limite: aparecem
apenas como lista de texto. O gráfico precisa de pelo menos **3** primários
(`MIN_PRIMARY_STATS_FOR_CHART`) - abaixo disso o polígono degenera numa linha, e a tela mostra um
convite a cadastrar mais no lugar do desenho.

**Modos.** Existem mesmo com o sistema desligado: descrever o que muda numa transformação é útil
por si só. `Mode` entra na busca global pelo nome; como não tem tela própria, o resultado carrega o
**id do personagem dono** e abrir leva ao detalhe dele (ver `ENTITY_ROUTES.Mode` em
`apps/client/src/utils/entityNavigation.ts`).

## 3. A escada de tiers

Cada degrau guarda só o próprio piso; o intervalo dele é `[minValue, piso do próximo[`. A escada
inteira sai de ordenar os degraus por `minValue`, e a escada sempre abre no zero - quando o degrau
mais baixo começa acima de 0, `sortLadder` insere um degrau implícito (sem id, rótulo `—`) para
que nenhum valor fique fora de todos os intervalos.

**Por stat, com padrão da história.** `StatStrength.statId` nulo é a escada padrão, usada por todo
status que não tenha uma própria. Preenchido, é o override daquele status. Assim "destreza vai de 0
a 100" e "força vai de F a S" convivem na mesma história sem obrigar 12 cadastros.

**Notação numérica.** Usa a mesma tabela: a tela oferece um gerador (`de 0 a 100 de 10 em 10`) que
grava as linhas, e o rótulo é o próprio número. Um único caminho de renderização e de
sincronização para as duas notações.

### Do valor ao raio

Com pisos `c0=0 < c1 < … < cn`, o anel *k* fica no raio `k/n`, e um valor em `[ck, ck+1[` fica em
`(k + fração)/n`. É o exemplo do pedido original: com F em 0, C em 50 e A em 400, o valor 100 está
dentro de C, a um terço do caminho até A.

**Transbordo.** O último degrau não tem topo. Acima de `cn` o desenho entra numa faixa reservada de
20% do raio (`OVERSHOOT_RATIO`): um degrau inteiro além do topo - medido pela largura do último
intervalo fechado - preenche a faixa toda, e daí para cima trava na borda. O anel externo dessa
faixa é tracejado, que é o que deixa "acima da escala" visível sem reescalar o gráfico inteiro por
causa de um personagem.

### A régua de tiers

O campo de valor é um número solto: sozinho, ele não diz que 100 é "C" nesta escada nem quanto
falta para o próximo degrau. Por isso o formulário do personagem desenha, sob cada campo, uma
régua com uma faixa por degrau, uma marca em cada piso e o ponto do valor - que acompanha o que
está sendo digitado, antes mesmo de salvar. O mesmo componente aparece na tela da escada, como
prévia do que está sendo montado.

Ao lado do campo há um **selo com o rótulo do degrau** em que o número caiu, atualizado enquanto
se digita. A régua diz *onde* o valor está; o selo diz *como ele se chama* - que é justamente o
que uma escada de pisos arbitrários (F em 0, C em 50, A em 400) esconde. Vale nas duas notações,
já que na numérica o rótulo é o piso do degrau. Acima do último degrau o selo mostra `A+`, o mesmo
transbordo que a faixa tracejada desenha (`formatTierLabel` em `statLadder.ts`).

**Um cartão por status a partir de médio.** Em tela estreita nome, campo e régua empilhados
bastam. Numa tela larga a mesma disposição deixa o campo numérico com metade da largura e a
barra esticada sem necessidade, então de `medium` para cima cada status vira um cartão num
`ResponsiveGrid` (duas colunas em médio, três em largo) com o campo em largura fixa. O
agrupamento também deixa claro a que status cada régua pertence.

O eixo da régua é **numérico**, e não um degrau por fatia igual como no radar. São perguntas
diferentes: o radar compara personagens entre eixos, então cada anel é um degrau; a régua mostra
o formato da escada, então F em 0, C em 50 e A em 400 aparece como uma faixa estreita seguida de
uma enorme, que é a verdade sobre aqueles números. A faixa tracejada no fim é o mesmo transbordo
de 20% do radar.

Rótulos que não cabem são omitidos, sempre preservando os das duas pontas. O cálculo respeita o
alinhamento com que cada um é desenhado (o primeiro sai da marca para a direita, o último para a
esquerda) - supor todos centrados fazia "90" e "100" saírem colados numa escada numérica.

## 4. Herança de modo

Um modo que **não** tem linha própria para um status lê o valor do modo normal, marcado como
herdado na interface. Gravar um valor num modo é justamente o ato de deixar de herdar; limpar o
campo apaga a linha e devolve a herança. A regra vive num lugar só,
`apps/client/src/utils/statValues.ts`, consumida pelo painel, pela comparação e pelo ranking.

Apagar um modo apaga junto os valores registrados só para ele: sem o modo, uma `StatRelation` com
aquele `modeId` ficaria órfã e o servidor recusaria qualquer edição posterior nela.

## 5. Invariantes e conflitos

`stat_id` e `mode_id` são anuláveis, e no Postgres NULLs são distintos entre si - um índice único
deixaria passar justamente as colisões da escada padrão e do modo normal. Quem garante são os
handlers de sincronização da API, que levantam `SyncConflictError` e deixam o cliente abrir a tela
de resolução:

- **`StatStrength`**: dois degraus com o mesmo piso na mesma escada. O intervalo de um deles teria
  largura zero e nenhum valor cairia nele.
- **`StatRelation`**: dois valores para o mesmo `(personagem, modo, status)`. A leitura passaria a
  depender da ordem das linhas.
- **`Stat`**: o 13º primário. O teto é invariante de dado, não só de tela: um cliente antigo não
  pode empurrá-lo pela sincronização.
- **FKs**: status, personagem ou modo inexistente, e modo que não pertence ao personagem.

O cliente repete as duas primeiras checagens antes de gravar, para virarem erro de formulário
imediato em vez de conflito de sync opaco horas depois.

## 6. Onde está o quê

- **Matemática pura** (sem React, sem banco): `packages/shared/graphs/statLadder.ts` (escada),
  `statRadarLayout.ts` (geometria), `statRadarSvg.ts` (arquivo exportado) e
  `statLadderBarLayout.ts` (a régua de tiers), mais `apps/client/src/utils/statValues.ts`
  (herança) e `statRanking.ts` (tier list). Mesma disciplina dos layouts de grafo do app: a tela
  interativa e o SVG exportado consomem a mesma geometria e nunca discordam - e por serem
  compartilhados, a vitrine do site desenha exatamente os mesmos gráficos.
- **Telas**: `apps/client/src/screens/stats/` - lista, formulário, escada, comparação e ranking,
  todas sob a entrada "Status" do menu da história (`navigation/StatsStack.tsx`).
- **No personagem**: painel no detalhe (`components/features/stats/CharacterStatPanel`), e no
  formulário os modos (`ModeManager`) e os valores (`CharacterStatValuesEditor`) - o detalhe só
  exibe, nunca edita.
- **Formato de exportação**: as quatro coleções entraram na **V5** (`CURRENT_STORY_FORMAT_VERSION`);
  a migração `V4 -> V5` materializa listas vazias e deixa `statSystem` desligado, então pacotes
  antigos continuam importáveis sem ligar a feature sozinhos.
