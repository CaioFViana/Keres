# Mecânicas de Escolha (Choices) no Keres

Este documento detalha como as escolhas (Choices) são implementadas e gerenciadas no sistema Keres, diferenciando entre histórias lineares e ramificadas.

## 1. A Entidade `Choice`

A entidade `Choice` é fundamental para definir as transições entre cenas em uma história. Seus campos principais são:

*   **`id`**: Identificador único da escolha.
*   **`sceneId`**: O ID da cena de origem, ou seja, a cena onde a escolha é apresentada ao leitor.
*   **`nextSceneId`**: O ID da cena de destino, para onde o leitor é levado após fazer esta escolha.
*   **`text`**: O texto que descreve a escolha (ex: "Vire à esquerda na floresta").
*   **`isImplicit`**: Um booleano que indica se a escolha foi gerada automaticamente pelo sistema (para histórias lineares) ou criada explicitamente pelo usuário (para histórias ramificadas).
*   **`createdAt`, `updatedAt`**: Timestamps de criação e última atualização.

É importante notar que, na implementação atual, as escolhas sempre conectam **cenas** entre si. A possibilidade de conectar momentos (partes menores dentro de uma cena) é uma questão em aberto (referência: TODO 8 no `tmp/planningTODO.txt`).

## 2. Tipos de História e Gerenciamento de Escolhas

O campo `type` na entidade `Story` (`'linear'` ou `'branching'`) determina como as escolhas são tratadas pelo sistema.

### 2.1. Histórias Lineares (`Story.type = 'linear'`)

Em histórias lineares, o fluxo narrativo é sequencial. As escolhas são gerenciadas automaticamente pelo backend para garantir essa progressão.

*   **Escolhas Implícitas (`isImplicit: true`)**:
    *   Quando uma cena é criada, atualizada ou excluída em uma história linear, o sistema recalcula e recria as escolhas implícitas para o capítulo ao qual a cena pertence.
    *   Para cada cena em um capítulo (exceto a última), uma escolha implícita é gerada, conectando-a à próxima cena na sequência definida pelo `index` das cenas.
    *   Essas escolhas implícitas têm um texto padrão (ex: "Próxima Cena (Implícita)") e `isImplicit` definido como `true`.
    *   Os usuários não interagem diretamente com essas escolhas na interface; elas servem para manter a estrutura de grafo subjacente e a navegação sequencial.
*   **Lógica de Backend**: A lógica para gerenciar escolhas implícitas está implementada nos casos de uso de cenas:
    *   `CreateSceneUseCase.ts`
    *   `DeleteSceneUseCase.ts`
    *   `UpdateSceneUseCase.ts`
    Nestes casos de uso, todas as escolhas implícitas de um capítulo são removidas e recriadas para refletir a ordem atualizada das cenas.

### 2.2. Histórias Ramificadas (`Story.type = 'branching'`)

Em histórias ramificadas (Interactive Fiction/CYOA), o autor tem controle total sobre as escolhas, permitindo múltiplos caminhos narrativos.

*   **Escolhas Explícitas (`isImplicit: false`)**:
    *   Os usuários criam, atualizam e excluem escolhas explicitamente através da API e da interface do usuário.
    *   Cada escolha explícita define um texto e uma cena de destino, permitindo que uma cena tenha múltiplas saídas.
    *   A navegação não é ditada pelo `index` das cenas, mas sim pelas escolhas definidas pelo autor.

## 3. Conexão entre Cenas e Implicações (Referência: TODO 8)

Atualmente, todas as escolhas (implícitas ou explícitas) conectam uma `sceneId` a uma `nextSceneId`. Isso significa que a granularidade da ramificação ocorre no nível da cena.
