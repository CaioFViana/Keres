# Suporte a Estruturas de História Dinâmicas (Interactive Fiction/CYOA)

Este documento resume a discussão e o plano para adaptar a estrutura de dados do Keres para suportar narrativas não-lineares, como Interactive Fiction (IF) ou "Choose Your Own Adventure" (CYOA), sem comprometer a experiência existente para histórias lineares.

## Problema Inicial

A estrutura atual das histórias no Keres é linear, definida pelos campos `index` em `Chapters` e `Scenes`. Isso impede a representação de caminhos de narrativa ramificados.

## Objetivo

Permitir que os autores criem histórias com múltiplos caminhos e escolhas, mantendo a simplicidade para histórias lineares e sem a necessidade de lógica de jogo complexa ou preocupações com migração de dados existentes.

## Abordagem Proposta: Suporte Híbrido (Linear e Ramificado)

A solução envolve a introdução de uma nova entidade `Choice` e um campo `type` na entidade `Story`, permitindo que o sistema se adapte dinamicamente ao tipo de narrativa.

### 1. Ajustes no Modelo de Dados

*   **Manter `index` em `Chapter` e `Scene`:** O campo `index` será mantido. Para histórias lineares, ele continuará a definir a ordem sequencial. Para histórias ramificadas, ele servirá como uma ferramenta organizacional (ex: ordem padrão de exibição em listas).

*   **Adicionar `type` à `Story`:**
    *   Um novo campo `type: 'linear' | 'branching'` será adicionado à entidade `Story` (e seus schemas Zod correspondentes).
    *   Novas histórias terão `type` definido como `'linear'` por padrão, garantindo que a experiência existente não seja alterada.

*   **Introduzir a Entidade `Choice`:**
    *   Uma nova entidade `Choice` será criada para representar as transições entre cenas baseadas em escolhas.
    *   **Campos da Entidade `Choice`:**
        *   `id` (ULID)
        *   `sceneId` (ULID, FK para a `Scene` onde a escolha é apresentada)
        *   `text` (string, o texto da escolha, ex: "Vire à esquerda")
        *   `nextSceneId` (ULID, FK para a `Scene` que esta escolha leva)
        *   `isImplicit` (boolean, padrão `false`): Uma flag crucial que indica se a escolha foi gerada automaticamente pelo sistema para uma história linear.
        *   `createdAt`, `updatedAt`

### 2. Lógica de Backend (API)

*   **Gerenciamento Condicional de `Choice`:**
    *   **Para histórias `linear`:** Quando uma `Scene` é criada, atualizada ou reordenada, o backend **automaticamente criará ou atualizará uma `Choice` implícita** (`isImplicit: true`) que liga a cena atual à próxima cena na sequência linear (baseada no `index`). Isso garante que mesmo histórias lineares tenham uma representação de grafo subjacente.
    *   **Para histórias `branching`:** Os objetos `Choice` serão criados, atualizados e excluídos explicitamente pelos usuários através da API.

### 3. Experiência do Frontend

*   **Configuração da História:** O usuário poderá selecionar o `type` da história (`linear` ou `branching`) ao criar uma nova história ou nas configurações da história.

*   **Preservação da Experiência Linear:**
    *   Quando `Story.type` for `linear`, a interface de usuário existente para criação/edição de capítulos e cenas permanecerá inalterada.
    *   O campo `index` continuará a guiar a ordem de exibição e navegação implícita.
    *   As `Choice`s implícitas existirão nos dados, mas não serão expostas ou editáveis diretamente na UI linear.

*   **Nova Experiência de Ramificação:**
    *   Quando `Story.type` for `branching`, uma nova interface de usuário será ativada.
    *   Esta UI permitirá que os usuários definam explicitamente as escolhas para cada cena (texto da escolha e a cena de destino).
    *   Uma ferramenta de visualização em grafo poderá ser implementada para exibir cenas como nós e `Choice`s explícitas como arestas direcionadas, representando visualmente a narrativa ramificada.

## Benefícios Desta Abordagem

*   **Compatibilidade Retroativa:** Histórias lineares existentes e novas continuarão a funcionar como antes.
*   **Separação Clara:** O campo `Story.type` permite que a lógica de backend e frontend se adapte ao tipo de narrativa.
*   **Grafo Subjacente Universal:** Todas as histórias, incluindo as lineares, terão uma representação de grafo, facilitando futuras funcionalidades como visualização ou conversão de tipo.
*   **Sem Lógica de Jogo:** O foco permanece na organização e visualização de dados, sem a complexidade de estados de jogo ou condições de escolha.

Esta abordagem permite uma introdução gradual de narrativas ramificadas, começando com as mudanças no modelo de dados e API, e posteriormente desenvolvendo as interfaces de usuário específicas para a criação e visualização de histórias ramificadas.