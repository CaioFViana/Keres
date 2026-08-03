# Mecânicas de Escolha (Choices) no Keres

Este documento detalha como as escolhas (Choices) são implementadas e gerenciadas no sistema Keres, diferenciando entre histórias lineares e ramificadas.

## 1. A Entidade `Choice`

A entidade `Choice` é fundamental para definir as transições entre cenas em uma história. Seus campos principais são:

*   **`id`**: Identificador único da escolha.
*   **`sceneId`**: O ID da cena de origem, ou seja, a cena onde a escolha é apresentada ao leitor.
*   **`nextSceneId`**: O ID da cena de destino, para onde o leitor é levado após fazer esta escolha.
*   **`text`**: O texto que descreve a escolha (ex: "Vire à esquerda na floresta").
*   **`createdAt`, `updatedAt`**: Timestamps de criação e última atualização.

É importante notar que, na implementação atual, as escolhas sempre conectam **cenas** entre si. A possibilidade de conectar momentos (partes menores dentro de uma cena) é uma questão em aberto (referência: TODO 8 no `tmp/planningTODO.txt`).

## 2. Tipos de História e Gerenciamento de Escolhas

O campo `type` na entidade `Story` (`'linear'` ou `'branching'`) determina como as escolhas são tratadas pelo sistema.

### 2.1. Histórias Lineares (`Story.type = 'linear'`)

Em histórias lineares, o fluxo narrativo é sequencial e nunca existe nenhuma linha de `Choice`. A navegação é ditada inteiramente pelo `index` das cenas dentro de cada capítulo (`SceneService.getPreviousNextScenes`), sem nenhuma aresta explícita conectando-as.

### 2.2. Histórias Ramificadas (`Story.type = 'branching'`)

Em histórias ramificadas (Interactive Fiction/CYOA), o autor tem controle total sobre as escolhas, permitindo múltiplos caminhos narrativos.

*   Os usuários criam, atualizam e excluem escolhas explicitamente através da API e da interface do usuário.
*   Cada escolha define um texto e uma cena de destino, permitindo que uma cena tenha múltiplas saídas.
*   A navegação não é ditada pelo `index` das cenas, mas sim pelas escolhas definidas pelo autor.

### 2.3. Conversão entre os dois tipos

O tipo de uma história pode ser convertido pelo próprio usuário (tela de Configurações da História), implementado em `StoryService.convertStoryType`/`checkLinearCompatibility` (`apps/client/src/services/storymanagement/storyTypeConversion.ts`):

*   **Linear -> Branching**: sempre permitido. Uma escolha explícita é gerada para cada par de cenas consecutivas (por `index`, dentro de cada capítulo), incluindo uma escolha "ponte" entre a última cena de um capítulo e a primeira do próximo - é o que preserva a sequência entre capítulos como dado explícito e editável.
*   **Branching -> Linear**: só quando o grafo de escolhas é compatível com uma sequência simples - sem bifurcações (mais de uma escolha saindo da mesma cena), sem convergências (mais de uma escolha chegando na mesma cena), sem ciclos, sem cenas desconectadas do resto do capítulo, e sem escolhas cruzando capítulos fora do padrão "última cena do capítulo M -> primeira cena do capítulo M+1". Quando compatível, as cenas são reindexadas seguindo a cadeia encontrada e todas as escolhas da história são apagadas.

## 3. Conexão entre Cenas e Implicações

Atualmente, todas as escolhas (implícitas ou explícitas) conectam uma `sceneId` a uma `nextSceneId`. Isso significa que a granularidade da ramificação ocorre no nível da cena.
