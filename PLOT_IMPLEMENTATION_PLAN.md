# Plano de implementação: Plots

## Objetivo

Adicionar **Plots** como linhas narrativas para histórias lineares. Um Plot agrupa cenas que
podem pertencer a mais de uma linha narrativa. Cada associação explica, em uma nota curta, o
papel daquela cena naquele Plot.

Plots não existirão em histórias branching nesta fase.

## Decisões confirmadas

- `Plot` é uma entidade própria, com formulário e tela de detalhes.
- `PlotScene` é uma relação N:N entre Plot e Scene, com nota de uma linha.
- A relação será editada dentro de `SceneFormScreen`, não haverá `PlotSceneFormScreen`.
- Não haverá tags, favoritos, comentários, sugestões ou atributos customizados para Plots.
- Plots entrarão na Busca global por nome e detalhes. `PlotScene` não entra: é uma relação, não
  um destino independente.
- O leitor de Plot é textual, em fluxo vertical, e não uma coleção de cartões.

## Modelo de dados

### Plot

```text
id, storyId
name
details
createdAt, updatedAt, version, isDeleted, deletedAt
```

### PlotScene

```text
id, storyId
plotId
sceneId
note
createdAt, updatedAt, version, isDeleted, deletedAt
```

Regras de integridade:

- índice único em `(plotId, sceneId)`;
- `note` obrigatória, sem quebras de linha, com limite curto (recomendação: 160 caracteres);
- Plot, Scene e relação precisam pertencer à mesma história;
- serviços e sync handlers rejeitam criação/edição em histórias que não sejam lineares;
- uma história linear com Plots não pode ser convertida para branching até que seus Plots sejam
  removidos. A interface deve explicar o bloqueio;
- leituras, gráficos e Reader ignoram registros soft-deleted e relações com cenas removidas.

## Navegação

Novo drawer `PlotsStack`, abaixo de `NarrativeElementsStack`, disponível apenas para histórias
lineares:

```text
PlotsStack
├─ PlotListScreen
├─ PlotDetailScreen
├─ PlotFormScreen
├─ PlotMatrixScreen
├─ PlotProgressScreen
└─ PlotReaderScreen
```

O item do drawer é ocultado em histórias branching. A proteção de serviços continua obrigatória,
pois esconder uma tela não protege dados sincronizados ou importados.

## Telas e fluxos

### PlotListScreen

- Lista simples, com busca por nome e ordenação básica; sem Advanced Search.
- Cada item mostra nome, trecho dos detalhes e quantidade de cenas relacionadas.
- Header: criar Plot, abrir Matriz de Plots e abrir Cobertura de Plots.
- Um Plot sem cenas é válido, mas deve ser visualmente identificável como `0 cenas`.

### PlotFormScreen

- Cria e edita apenas `name` e `details`.
- Não gerencia cenas: isso evita que a mesma relação tenha dois editores concorrentes.

### SceneFormScreen: seção “Plots”

Nova seção visível apenas em histórias lineares, inspirada no gerenciamento de relações de
personagem:

- relações já existentes aparecem como `Nome do Plot + nota`;
- adicionar relação escolhe um Plot disponível e preenche a nota de uma linha;
- editar altera apenas a nota ou troca o Plot, respeitando a unicidade;
- remover desfaz somente a relação;
- ao salvar a Scene, alterações pendentes de PlotScene são persistidas usando os mesmos padrões
  de log de operação, sincronização e feedback já usados pelas relações de personagem.

`PlotDetailScreen` é deliberadamente uma visão de leitura: mostra nome, detalhes e as cenas
relacionadas em ordem narrativa. A linha da cena abre o detalhe da Scene; a edição da relação
continua centralizada em `SceneFormScreen`.

## Ordem narrativa compartilhada

Extrair ou reutilizar uma função única para ordenar cenas lineares por:

1. índice do Chapter;
2. índice da Scene.

Essa ordem será usada no detalhe do Plot, Reader, Matriz e Cobertura. Não duplicar a ordenação
local hoje presente em Matrix, Item Journey e Timeline.

## PlotMatrixScreen

Gráfico SVG e interativo inspirado na matriz de presença:

- linhas: Plots selecionados;
- colunas: cenas em ordem narrativa, agrupadas visualmente por Chapter;
- célula: nota da relação PlotScene;
- clique na linha abre o Plot; clique na célula ou cabeçalho abre a Scene;
- MultiSelectPill, estado vazio orientado, limite inicial de 12 e opção de selecionar todos;
- zoom, ajuste à tela e exportação SVG;
- cores, claro/escuro e exportação seguem os padrões dos SVGs atuais.

Em vez de encaixar Plot no modal global de Presence Matrix, extrair a infraestrutura comum para
uma matriz de séries × cenas. Characters usam checkmark, Items usam estado e Plots usam nota.
Cada produto continua em sua própria screen e stack.

## PlotProgressScreen

Gráfico de cobertura, também exportável como SVG:

```text
Plot principal   ███████░░░  7/12 cenas · 58%
```

- denominador: todas as cenas ativas da história;
- média no cabeçalho: total de relações PlotScene dividido pela quantidade de Plots, incluindo
  Plots vazios;
- barras ordenadas por nome, com opção futura de ordenar por cobertura;
- toque em uma barra abre o Plot;
- aviso curto: cenas podem pertencer a vários Plots, portanto percentuais não precisam somar 100%.

O nome correto da métrica é **cobertura**, não participação, pois os Plots podem se sobrepor.

## PlotReaderScreen

Modo de leitura estrutural, com selector `Todas as cenas` ou um Plot.

- `Todas as cenas`: cada Scene aparece uma vez, em ordem narrativa.
- Plot selecionado: apenas cenas relacionadas àquele Plot, na mesma ordem.
- Renderização deliberadamente textual: número/título pequeno da Scene seguido pelo `summary` em
  parágrafo contínuo, com divisores discretos — sem cartões, bordas de card ou controles de
  edição.
- Toque no título leva ao detalhe completo da Scene.
- O cabeçalho informa o escopo e a quantidade, por exemplo `Plot de redenção · 6 cenas`.

O Reader não mostra a nota de PlotScene no corpo principal: seu objetivo é ler o resumo da
história, não revisar metadados. A nota continua disponível no detalhe do Plot e na Matriz.

## Dados, sincronização e importação

Adicionar Plot e PlotScene em todas as camadas já exigidas por entidades da história:

1. Entidades e schemas Zod compartilhados; exportações de `@keres/shared`.
2. `OperationLogEntityType`, tipos recuperáveis e apresentação de operações.
3. Tabelas, relações ORM e migrations no cliente SQLite e API/Postgres.
4. Serviços client-side com validação de história linear, unicidade, soft delete, operação local e
   eventos `plot_changed` / `plot_scene_changed`.
5. Handlers de sync de cliente e servidor, registro no Sync Engine e eventos remotos.
6. Export/import completo, remapeamento de IDs, migração de versão e clonagem de exemplos.
7. Busca global: `Plot` busca `name` e `details`, usa ícone próprio e abre `PlotDetailScreen`.

PlotScene não é adicionado à Busca global, Tags, Comments, See Also ou Favorites nesta fase.

## Testes e critérios de aceite

- Criar, editar, remover e sincronizar Plot e PlotScene.
- Rejeitar associação duplicada, Scene de outra história, nota vazia e história branching.
- Bloquear conversão de linear para branching com Plots ativos.
- Garantir ordem narrativa idêntica em detalhe, Reader e ambos os gráficos.
- Validar export/import e exemplo clonado com Plots e relações.
- Validar Matrix, SVG de cobertura, média incluindo Plot vazio, sobreposição de Plot e tema
  claro/escuro.
- Validar Reader em `Todos` e em Plot selecionado.
- Validar descoberta pela Busca global e retorno correto para a tela anterior.
- Atualizar traduções, help contextual, catálogo de ajuda e documentação de release/formato.

## Sequência de entrega

1. Modelo compartilhado, banco, sync, import/export e testes de serviço.
2. `PlotsStack`, lista, formulário e detalhe.
3. Seção de Plots dentro de `SceneFormScreen`.
4. Busca global, help e documentação.
5. Matriz Plot × Cena e exportação.
6. Cobertura de Plots e exportação.
7. Plot Reader, validação responsiva e regressão completa.
