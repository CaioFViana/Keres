# Plano de reutilização e padronização das telas do client

Data: 2026-09-05. Escopo: `apps/client`. Status: planejamento; nenhuma mudança funcional nesta etapa.

## Objetivo e princípio de arquitetura

Centralizar a estrutura, apresentação e comportamentos transversais das telas, deixando nas telas os campos, regras de domínio, permissões e comandos específicos. A unidade de reutilização será a composição de componentes pequenos e hooks com responsabilidades delimitadas.

Reutilizar o máximo do que realmente tem o mesmo contrato. Evitar uma tela CRUD universal com dezenas de flags, um formulário inteiro descrito por configuração ou um container que conheça serviços, stores e tipos de entidade. Essas alternativas reduziriam JSX às custas de tornar alterações específicas mais difíceis.

## Diagnóstico verificado no código

Contagens por arquivo em `apps/client/src/screens`, por busca textual; representam adoção dos padrões, não uma medição de percentual de duplicação:

| Padrão | Arquivos |
| --- | ---: |
| Arquivos `.tsx` no diretório de telas | 98 |
| Configuração direta com `setOptions` | 79 |
| Chamada direta a `setDocumentTitle` | 65 |
| Uso de `KeyboardAwareScreen` em JSX | 26 |
| Uso de `commonFormStyleDefs` | 15 |
| Uso de `commonDetailStyleDefs` | 20 |
| Uso de `FormContainer` em JSX | 1 |
| Chamada a `useEntityListScreen` | 8 |
| Uso de `ScreenLoading` em JSX | 41 |

Já existem abstrações úteis: `KeyboardAwareScreen`, `FormActions`, `ScreenLoading`, `ScreenError`, `DetailField`, `CommentableDetailField`, `GenericFilterSortList`, `useEntityListScreen`, `useConfirmDelete`, `useEntityRelations` e os hooks de lifecycle. O próximo passo deve aproveitar essa base.

Exemplos que orientam o plano:

- `TagFormScreen`: repete efeito de header, título, descrição, labels, linha de switch, montagem de estilos, padding e loading manual.
- `ItemDetailScreen`: repete header com ações, estrutura de rolagem, título, seções, contexto de comentários por campo, metadados e botão de retorno.
- `NoteListScreen`: já usa hook e lista compartilhados, mas ainda monta header, container e uma longa ligação de propriedades de filtros.
- `StoryCalendarFormScreen`: demonstra que formulários têm fluxos de validação e confirmação próprios, que devem continuar no domínio.
- O `FormContainer` atual atende somente `ColdInstallScreen`: centraliza conteúdo vertical e horizontalmente, aplica padding 20 e largura máxima 840. Não é adequado como padrão implícito para todos os formulários existentes.
- `getCommonContainerStyles` e `commonFormStyleDefs` aplicam ambos padding 20. Há telas, como `TagFormScreen`, que combinam os dois. A migração precisa conferir o espaçamento efetivo, não apenas substituir nomes de estilos.
- `KeyboardAwareScreen` já calcula o padding inferior e permite que o estilo recebido o sobrescreva. Várias telas também calculam esse padding. A responsabilidade deve ter um único dono por modalidade de container.

## 1. Header declarativo e ações compartilhadas — prioridade máxima

Criar `useScreenHeader` em `src/hooks` e `HeaderActions`/`HeaderAction` em `src/components/common/navigation`.

Contrato proposto do hook:

- `title`: texto já traduzido ou resolvido pelo vocabulário da história.
- `target`: proprietário explícito do header, inicialmente `self` ou `parent`. Mapear os navegadores existentes antes de escolher os valores por tela; não adivinhar pela existência de um parent.
- `actions`: ações tipadas com `id`, `icon`, `label`, `onPress`, `visible`, `disabled` e, quando necessário, estado ocupado.
- Alternativa `renderActions` para controles especializados, mutuamente exclusiva com `actions`.
- Título do documento segue `title`; aceitar uma substituição explícita somente quando houver necessidade real.

O hook concentra atualização no foco, atualização de título/ações enquanto a tela está focada e remoção explícita de ações ausentes. Telas sem ações não precisam criar um `<View />` vazio. A tela anterior não pode limpar ou sobrescrever o header da próxima ao perder foco. Os callbacks devem sempre operar sobre os dados atuais, sem exigir que cada tela repita a infraestrutura de efeitos.

`HeaderActions` centraliza espaçamento, cores, tamanho visual e área de toque, acessibilidade e estado desabilitado. Os ícones e condições continuam declarados pela tela. Atalhos para criar/editar só serão adicionados se simplificarem os primeiros usos, sem um registro global de rotas de entidades.

Preservar a responsabilidade de `MainSystemStack` pelos controles de menu, ajuda e retorno em `headerLeft`. Manter `useBackButtonHandler` separado do header na primeira migração, preservando retorno entre stacks e callbacks personalizados.

Preservar também `DocumentTitleSync` como inicializador: seu comentário documenta uma regressão ao tentar inferir globalmente o título do navegador mais profundo. A centralização proposta continua explícita e dirigida pela tela focada.

Headers de mapa e quadro podem usar `renderActions` com `LocationMapHeaderActions` e `BoardCanvasHeaderActions`; não precisam virar uma sequência artificial de ações simples.

## 2. Containers de formulário e detalhe

Introduzir uma base visual pequena, `ScreenContainer`, em `src/components/layout`: fundo, ocupação da tela e política de largura. Ela não cria rolagem automaticamente. Listas virtualizadas, gráficos e canvases mantêm o controle da própria rolagem e gestos.

### Criar EntityFormContainer

Manter o `FormContainer` atual dedicado ao fluxo de instalação inicial. Criar `EntityFormContainer` em `src/components/common/forms` para os formulários de criação e edição de entidades. São contratos de layout distintos; não será necessário introduzir variantes de instalação, compatibilidade de props ou migração do único consumidor atual.

- Compor `KeyboardAwareScreen`, preservando o tratamento atual de teclado, foco e plataforma.
- Usar layout de edição com conteúdo alinhado ao topo, sem herdar a centralização vertical e horizontal do fluxo de instalação.
- Centralizar padding, largura, título/descrição opcionais e região opcional de ações composta com `FormActions`.
- Diferenciar estilo da superfície de estilo do conteúdo no novo contrato.
- Ter uma única rolagem principal. O cálculo da folga inferior permanece no mecanismo compartilhado de teclado, sem chamadas repetidas em cada formulário.
- Validar uma política de largura para formulários comuns nos pilotos. O valor 840 existente é referência da instalação, não justificativa suficiente para limitar automaticamente todas as telas.
- Não carregar dados, salvar, excluir, navegar ou inferir permissões. Receber filhos e ações já definidos pela tela.

O nome `EntityFormContainer` delimita seu uso, mas não exige conhecer o tipo ou identificador da entidade. Formulários de perfil, configurações e outros fluxos serão avaliados separadamente; podem compartilhar primitivas de layout, campos e teclado sem serem forçados a esse container.

### Criar DetailContainer

- Compor superfície e `ScrollView` com espaçamento e folga inferior padronizados.
- Permitir título, descrição e footer opcionais, com conteúdo livre por composição.
- Reutilizar a política de largura e tipografia; detalhes com tabelas ou conteúdo amplo podem declarar largura ampla.
- Concentrar o uso do cálculo de padding inferior para detalhes. Considerar um nome neutro para `useFormScrollBottomPadding`, com alias temporário para não misturar renomeação ampla e mudança de comportamento.
- Manter galerias, relações, comentários e metadados como componentes explícitos. O container não conhece `entityType` ou `entityId`.

A política de safe area deve considerar o espaço já consumido pelo navegador e evitar aplicação duplicada. Alterações visuais intencionais, como corrigir padding acumulado, devem ser identificadas no lote correspondente e verificadas em tela.

## 3. Padronizar os elementos internos

Criar apenas as peças confirmadas pelos pilotos:

- `ScreenTitle`: variantes de formulário e detalhe, preservando inicialmente a diferença atual de tamanho.
- `ScreenSection`: título, descrição opcional, ações opcionais e conteúdo; aproveitar `CollapsibleCard` para seções recolhíveis já atendidas por ele.
- `FormField`: label, indicação de obrigatório, ajuda/erro e controle como filho; conectar acessibilidade conforme a capacidade do controle.
- `FormSwitchField`: rótulo e switch com alinhamento e espaçamento compartilhados.

Manter `TextInput`, seletores, `DetailField` e `FormActions` existentes. Evitar aplicar automaticamente margens tanto no campo quanto no controle. Migrar progressivamente os estilos estruturais de `commonStyles` para seus componentes, mantendo estilos de domínio locais.

Reutilizar `ScreenLoading` e `ScreenError` nos casos manuais. Se os pilotos confirmarem a repetição, criar um `ScreenContentState` com estados explícitos de carga inicial, erro, ausência e conteúdo, composto sobre essas peças.

Separar carga inicial, atualização e salvamento. Atualizar ou salvar não deve desmontar conteúdo já apresentado, perder formulário, rolagem ou fechar filtros. A lista já preserva essa distinção com `isInitialLoading`; conservar esse contrato.

## 4. Outras oportunidades, depois da estrutura

### Ligação entre hooks e listas

Avaliar um adaptador tipado entre `useEntityListScreen` e `GenericFilterSortList` para agrupar propriedades de busca, filtro, ordenação e favorito. Preservar `renderItem`, configuração dos filtros e regras específicas na tela. Não criar uma segunda lista que duplique a existente.

Confirmar reutilização antes de extrair o carregamento de opções de tags. Os hooks de opções existentes devem ser avaliados para não criar uma alternativa paralela.

### Campos de detalhe com comentários

Extrair um adaptador junto aos componentes de comentários que produza as propriedades comuns e a ligação de cada campo: permissões, autor, callbacks, `fieldKey` e `contentSnapshot`. O texto capturado deve continuar sendo o valor exibido daquele campo. Preservar menções e exclusão de links para a própria entidade. Evitar um contexto genérico de página que esconda essas dependências.

### Ciclo de vida e operações

Ampliar a adoção de `useEntityEventSubscriptions` onde houver assinaturas manuais equivalentes. Manter carga inicial separada da assinatura de eventos, conforme o contrato documentado em `useEntityRefreshLifecycle`, para evitar ciclos de recarga.

Depois de comparar mais formulários, avaliar um hook pequeno para execução assíncrona e estado de salvamento, incluindo proteção contra envio duplicado. Validação, payload, transações, notificações e navegação continuam explícitos. Reutilizar `useConfirmDelete` para exclusões compatíveis.

Essas extrações são uma etapa posterior: não combinar alterações de acesso a dados com a migração visual dos mesmos arquivos.

## Sequência de implementação

| Lote | Entrega | Condição para avançar |
| --- | --- | --- |
| 1 | Inventário por tela: proprietário do header, ações, tipo de conteúdo, loading, exceções e retorno | Todas as telas classificadas, incluindo telas fora de `src/screens` que usem os padrões |
| 2 | `useScreenHeader` e ações; pilotos em `NoteListScreen`, `TagFormScreen`, `ItemDetailScreen`, uma tela com header próprio e `LocationMapScreen` | Foco, ações condicionais, título web e retorno verificados |
| 3 | Criação de `EntityFormContainer`, `DetailContainer` e primitivas internas; pilotos em Tag, Item e calendário | Sem rolagem/padding duplicados; teclado e conteúdo longo corretos; instalação inicial preservada se houver alterações nas primitivas compartilhadas |
| 4 | Migrar headers restantes em lotes por família | Toda configuração comum passa pelo hook; exceções explícitas |
| 5 | Migrar formulários e detalhes simples: tags, notas, world rules, plots e items; depois characters, locations, capítulos, cenas e escolhas | Cada família mantém seus fluxos e usa a estrutura compartilhada |
| 6 | Avaliar listas, settings, perfil, packs, ajuda e telas especializadas; aplicar somente as peças compatíveis | Cobertura de toda a superfície, sem forçar scroll em listas/canvases |
| 7 | Adaptadores confirmados de lista/comentários/lifecycle; remover compatibilidade e estilos obsoletos; documentar exemplos | Sem abstrações concorrentes e sem usos antigos não justificados |

Cada lote deve ser revisável e reversível. Os pilotos calibram os contratos antes da migração em massa. Não alterar schema, serviços ou formatos de dados para viabilizar esta refatoração.

## Verificação e critérios de aceite

Testes de comportamento necessários:

- Header: troca lista → detalhe → edição → retorno; troca entre drawers; atualização de nome, idioma, vocabulário, tema e permissão; ausência de ações herdadas; callback com entidade atual; títulos no navegador correto.
- Retorno: preservar os testes de `useBackButtonHandler` e navegação, inclusive origem em outro stack.
- Formulário: salvar/excluir existentes, erro preservando campos, envio duplicado bloqueado quando o novo estado de operação for adotado; carregar entidade ausente sem formulário enganoso.
- Lista: filtrar até zero resultados com modal aberto, recarregar e trocar história sem perder controles nem mostrar dados da história anterior.
- Detalhe: atualização por eventos sem loops, comentários com campo e snapshot corretos, permissões e menções preservadas.

Verificação visual/manual dos pilotos: web estreita e larga, Android e iOS; temas claro/escuro; último campo com teclado aberto, botão final acessível, folga de navegação, texto longo e conteúdo amplo. Se algum ambiente não estiver disponível, registrar a lacuna em vez de considerar a plataforma validada.

Executar typecheck, lint e testes pertinentes por lote, incluindo os testes existentes de navegação, hooks de retorno/lifecycle/listas, formulários afetados e ações de mapa. Não substituir verificações de interação por snapshots extensos de JSX.

Resultado esperado:

1. Uma tela comum declara título e ações sem escrever efeitos de navegação ou estilos de ícones.
2. Formulários e detalhes comuns não reimplementam rolagem, folga inferior, título e footer.
3. Alterações de espaçamento, campos e ações comuns têm um lugar definido para manutenção.
4. Regras de domínio e navegação específica continuam visíveis no código da tela.
5. Não há perda de estado durante atualizações nem regressões de título, retorno ou teclado.
6. Todo uso residual de configuração direta de header ou estrutura manual tem justificativa registrada.

Comparar as contagens iniciais ao final e revisar o boilerplate removido nos pilotos. Não fixar uma meta arbitrária de redução de linhas: o critério é a eliminação de responsabilidades duplicadas sem tornar os usos mais difíceis de entender.

## Documentação final

A API compartilhada está estável o suficiente para servir de referência. Uma regra de lint restrita a usos novos de infraestrutura duplicada continua adiada: os resíduos restantes (`commonFormStyleDefs`/`commonDetailStyleDefs` em telas especializadas, headers de mapa/quadro, canvases) são exceções justificadas, não dívida a varrer neste lote.

### Lista — `NoteListScreen`

Usar `ScreenContainer` (sem rolagem própria) + `GenericFilterSortList`. A lista virtualizada é dona do viewport.

- Header: `useScreenHeader` com `target: 'parent'` e ações declaradas (`id`, `icon`, `label`, `onPress`, `visible`). Sem `setOptions` nem ícones manuais.
- Dados: `useEntityListScreen` devolve `listProps` (`EntityListFilterProps`) para busca, filtro, ordenação e favorito. Espalhar `{...listProps}` na lista.
- O que fica na tela: `renderItem`, `filterOptions`, `sortOptions`, `entityName`, placeholders e regras específicas (ex.: recarregar tags no `tag_changed`).
- Loading: `isInitialLoading` → `ScreenLoading`; `error` → `ScreenError`. Recargas posteriores não desmontam a lista.
- Exceção: não envolver a lista num segundo componente de lista nem forçar `ScrollView`/`DetailContainer`. Mapas, canvases, calendário e análises usam `ScreenContainer` ou um header próprio (`renderActions`), nunca este shell de detalhe.

### Formulário — `TagFormScreen`

Usar `EntityFormContainer` (não o `FormContainer` da instalação). O container trata teclado, padding, título/descrição e a região de ações; validação, payload, exclusão e permissões continuam na tela.

- Header: `useScreenHeader` só para o título da barra. Os botões de salvar/excluir vão em `actions`, compostos com `FormActions` pelo container.
- Campos: `FormField` (label + controle filho, acessibilidade via callback) e `FormSwitchField`. Estilos de input vêm de `getCommonInputStyles`; não reaplicar padding do container no campo.
- Operações: `useAsyncOperation` no save (bloqueia envio duplicado); `useConfirmDelete` na exclusão. Loading inicial usa `ScreenLoading`/`ScreenError` *antes* de montar o formulário, para não mostrar campos vazios como se fossem o rascunho.
- Exceção: `ColdInstallScreen` permanece no `FormContainer` antigo (centralização vertical). Calendário, vocabulário e outros fluxos com confirmação própria reutilizam as primitivas (`FormField`, teclado) sem serem forçados a este container se o layout não couber.

### Detalhe — `ItemDetailScreen`

Usar `DetailContainer` (ScrollView + título + footer). Galeria, relações, comentários e metadados são filhos explícitos; o container não conhece `entityType`.

- Header: `useScreenHeader` com ações condicionais (editar, atalhos de domínio). `visible` segue permissão/`canEdit`.
- Ciclo de vida: `useEntityInitialLoad` e `useEntityEventSubscriptions` em efeitos separados. Reassinatura de listener nunca deve disparar o loader inicial.
- Comentários: `createCommentFieldBindings` uma vez por tela; cada campo recebe `commentField('title')` etc. O snapshot é o valor exibido daquele campo.
- Loading: carga inicial `ScreenLoading`/`ScreenError`. Atualização por evento substitui dados no lugar, sem desmontar o detalhe.
- Exceção: detalhes com gestores que escrevem (relações, cenas) continuam emitindo no `entityEventEmitter` na própria tela. Headers de mapa/quadro usam `renderActions`. Não forçar `DetailContainer` em canvas, grafo, matriz de presença ou instalação.

