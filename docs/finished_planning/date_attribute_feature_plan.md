# Plano: Date Picker para atributos customizados (`AttributeType.DATE`)

Branch base: `ouroboros`. Feature seguinte à de `AttributeType.ENTITY`, já implementada.

## 1. Problema

`AttributeType.DATE` hoje é um `TextInput` livre com placeholder `YYYY-MM-DD`
(`AttributeValueInput.tsx`). Não há date picker em lugar nenhum do app. Consequências:

- nada garante formato, então a Detail screen mostra o que o usuário digitou, cru;
- a checagem da Análise da História usa `Date.parse`, que aceita coisas demais;
- não há como registrar hora.

## 2. Invariante central: a data **não tem fuso horário**

A preocupação levantada — "diferença de fuso horário mexer em horas internas da história" — se
resolve **não guardando fuso nenhum**. O valor é uma data civil *flutuante*: `15/01/2024 10:30`
é 15/01/2024 10:30 em Brasília, em Tóquio e em Londres, porque é uma hora **interna da
história**, não um instante no tempo real.

Por isso **não** é adicionado um campo de fuso na Story. Seria contraproducente: qualquer
conversão entre fuso da história e fuso do sistema reintroduz exatamente o deslocamento que se
quer evitar. O fuso do sistema é levado em conta de uma única forma — sendo mantido fora do
caminho:

| Armadilha | Como é evitada |
|---|---|
| `new Date('2024-01-15')` é interpretado como UTC e renderiza **14/01** em UTC-3 | O valor nunca é parseado por `new Date(string)`. O parser é uma regex que extrai os componentes. |
| `new Date(y, m, d)` usa fuso local e pode deslizar em bordas de horário de verão | Datas são construídas com `Date.UTC(...)` e lidas com `getUTC*`. |
| `Date.UTC(15, 0, 1)` vira **1915** (armadilha do ano de 2 dígitos) | `setUTCFullYear(year)` explícito depois da construção. |
| `toLocaleDateString()` sem `timeZone` usa o fuso do dispositivo | Toda formatação passa `timeZone: 'UTC'`. |
| Formatação seguir o locale do **sistema** e não o do app | O idioma vem de `i18n.language`, nunca do dispositivo. |

O único ponto em que o fuso do sistema legitimamente entra é o botão "Hoje" do picker e o mês
inicial ao abrir sem valor — "hoje" para quem está escrevendo é a data local dele.

## 3. Formato canônico

Armazenamento continua texto puro em `AttributeValue.value` (§`attributeValueCodec.ts`),
como pedido. Duas formas, e o formato **se auto-descreve**:

- só data: `YYYY-MM-DD`
- data + hora: `YYYY-MM-DDTHH:mm`

Sem sufixo `Z`, sem offset, sem segundos. Ter ou não hora é decidido **por valor**, não por
campo: um switch "incluir hora" dentro do picker, e a renderização infere pelo formato da
string. Isso evita uma coluna nova em `StorySchemaField` (que custaria migração SQLite +
Postgres + sync handler + export/import) e mantém compatibilidade total com valores de texto
livre já gravados.

> Alternativa não escolhida: uma coluna `dateIncludesTime` no campo, forçando todos os valores
> daquele atributo à mesma forma. É mais previsível para um sistema de schema, mas custa toda a
> cadeia de migração online. Se for preferível, é aditivo — o formato canônico não muda.

Ano vai de 1 a 9999, zero-padded. Datas impossíveis (30/02) são rejeitadas por round-trip.

## 4. Camadas

### 4.1 `packages/shared/utils/attributeDateValue.ts` (novo)

Funções puras, sem React, testáveis no vitest do shared:

| Função | Papel |
|---|---|
| `parseAttributeDate(raw)` | regex estrita + validação de calendário → `{year, month, day, hour, minute}` ou `null`. `hour/minute` `null` = só data |
| `formatAttributeDate(parts)` | componentes → string canônica |
| `isValidAttributeDate(raw)` | `parseAttributeDate(raw) !== null` |
| `attributeDateWeekday(parts)` | 0–6, via `Date.UTC` + `getUTCDay()` — imune a fuso |
| `toUtcDate(parts)` | `Date` em UTC, para alimentar o `Intl` |
| `formatAttributeDateForDisplay(raw, language)` | string localizada com dia da semana (e hora, se houver), ou `null` se não parseia |

`formatAttributeDateForDisplay` usa `Intl.DateTimeFormat(language, { weekday: 'long', year,
month: 'long', day, [hour, minute], timeZone: 'UTC', hourCycle })` sobre a data UTC. Com
`timeZone: 'UTC'` + data construída em UTC, a saída é idêntica em qualquer fuso. `Intl` já é
usado no app (`EntityMetadata`, `OperationLogListItem`), mas há `try/catch` caindo na string
canônica se o runtime não tiver ICU.

### 4.2 Picker (client)

`components/common/inputs/DatePickerInput/` — mesma dupla do ColorPicker:

- **`DatePickerInput.tsx`**: ícone de calendário + `TextInput` read-only mostrando o valor **já
  formatado** (não o canônico), abrindo um `ResponsiveModal`. Estrutura copiada de
  `ColorPickerInput`, inclusive `commonInputStyles.customComponentInput`.
- **`DatePickerModal.tsx`**: conteúdo do modal, com estado próprio, confirmando em "Selecionar"
  (o valor só sai no confirm, como no ColorPicker).

Layout do modal, de cima para baixo:

1. **Cabeçalho com o dia da semana** — "quarta-feira, 15 de janeiro de 2024 10:30", no idioma do
   app. É o requisito "mostrar dia da semana no topo" e serve de preview do que a Detail vai
   mostrar.
2. Navegação `‹ mês ›` + campo de ano digitável (histórias em ano 1342 ou 7000 são normais).
3. Cabeçalho de dias da semana, abreviados no idioma do app (derivados do `Intl`, não escritos
   à mão).
4. Grade do mês. Dia selecionado destacado; células vazias antes do dia 1.
5. Switch **"incluir hora"** (`ThemedSwitch`). Ligado, revela dois campos numéricos `HH:mm`,
   clampados.
6. "Hoje" e "Limpar".
7. "Cancelar" / "Selecionar".

Valor inicial inválido ou legado (texto livre antigo) não é destruído ao abrir: o modal começa
no mês de hoje sem seleção, e o valor antigo só é substituído se a pessoa confirmar.

### 4.3 Como aparece na história

`CustomAttributeDetailFields.formatValueForDisplay` ganha o ramo DATE, chamando
`formatAttributeDateForDisplay(raw, i18n.language)`:

- `2024-01-15` → **"segunda-feira, 15 de janeiro de 2024"** (pt) / "Monday, January 15, 2024" (en)
- `2024-01-15T10:30` → **"segunda-feira, 15 de janeiro de 2024 10:30"**
- valor legado não parseável → a string crua, sem quebrar nada

Idioma = idioma da aplicação (`i18n.language`), nunca o do dispositivo. Como consequência de
graça, o `contentSnapshot` dos comentários passa a guardar a data formatada, e não o ISO cru.

### 4.4 Demais pontos

| Arquivo | Mudança |
|---|---|
| `AttributeValueInput.tsx` | `case DATE` → `DatePickerInput` (vale também para o "valor padrão" em `StorySchemaFieldFormScreen`, que passa por aqui) |
| `AdvancedSearchModal.tsx` | `case 'date'` → `DatePickerInput` em vez de `TextInput`. Seguro: nenhum campo **nativo** é `type: 'date'` em `entityFields.ts`, esse case só é alcançado por atributo customizado |
| `utils/storyAnalysisChecks.ts` | inválido = `!isValidAttributeDate(raw) && Number.isNaN(Date.parse(raw))`. O `Date.parse` fica como segunda chance **de propósito**: sem ele, todo valor de texto livre gravado antes desta feature viraria warning novo de uma vez |
| `utils/attributeSearchPredicate.ts` | **sem mudança** — `LIKE %valor%` sobre o formato canônico casa prefixo (`2024-01` acha janeiro inteiro), que é o comportamento útil |
| `locales/{en,pt}.json` | chaves novas do picker |

Deliberadamente **fora**: `EntityService` (log de operações) e `GlobalSearchService` (snippet)
continuam mostrando o valor canônico. `2024-01-15T10:30` é legível, e formatar ali exigiria
carregar idioma dentro de camada de serviço.

## 5. Testes

- `packages/shared/test/utils/attributeDateValue.test.ts`: parse estrito (aceita/rejeita),
  30/02 rejeitado, round-trip, ano de 2 dígitos não vira 19xx, dia da semana correto,
  **e o teste que importa: formatar o mesmo valor com `TZ=UTC`, `TZ=America/Sao_Paulo` e
  `TZ=Asia/Tokyo` dá exatamente a mesma string**.
- `apps/client/test/components/DatePickerModal.test.tsx`: abre no mês certo, seleciona dia,
  liga hora e emite `T10:30`, "Limpar" emite `null`, valor legado não some ao abrir.

## 6. Riscos

1. **`Intl` sem ICU completo** em algum runtime → nomes de mês/dia em inglês ou erro. Coberto
   por `try/catch` com fallback para a string canônica.
2. **Ano > 9999** não é representável no formato canônico. Se histórias de longuíssimo prazo
   forem um caso real, o formato precisa mudar antes de haver dados gravados.
3. **Valores legados de texto livre** continuam existindo e são exibidos crus. Não há migração
   automática: adivinhar se "01/02/2024" é 1º de fevereiro ou 2 de janeiro é impossível.
