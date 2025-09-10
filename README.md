### Projeto ainda não está estável para uso. 

# Keres - Gerenciamento e Controle de Histórias

## Visão Geral do Projeto

Keres é um aplicativo organizador de histórias, projetado para ser self-hosted e/ou offline, atendendo tanto a escritores solo quanto a equipes colaborativas. Seu objetivo principal é oferecer uma ferramenta robusta e intuitiva para gerenciar todos os aspectos de uma narrativa, desde personagens e locais até a estrutura de cenas e regras do mundo. O sistema foca na organização eficiente do conteúdo e na facilidade de uso.

## Principais Funcionalidades e Propostas

1.  **Organização Abrangente de Histórias:**
    *   **Personagens:** Gerenciamento detalhado de personagens, incluindo biografia, personalidade, motivações, qualidades, fraquezas e linha do tempo planejada.
    *   **Estrutura Narrativa:** Organização em Capítulos, Cenas e Momentos, permitindo um planejamento granular da história.
    *   **Locais:** Informações detalhadas sobre os locais da história.
    *   **Galeria:** Suporte para ilustrações e imagens associadas a elementos da história.
    *   **Regras do Mundo:** Definição de regras e sistemas que governam o universo da história.
    *   **Notas e Tags:** Flexibilidade para anotações livres e categorização com tags.
    *   **Listas Customizáveis (Sugestões):** Mecanismo para o usuário gerenciar listas pré-definidas e personalizadas (ex: gêneros, raças, tipos de relação), com escopo global ou por história.

2.  **Suporte a Estruturas de História Dinâmicas (Linear e Ramificada):**
    *   O Keres suporta tanto histórias lineares quanto ramificadas ("Escolha Sua Aventura" / CYOA).
    *   Um campo `type` na entidade `Story` (`'linear'` ou `'branching'`) determina o comportamento.
    *   Para histórias lineares, o sistema gera `Choices` implícitas automaticamente para manter a sequência.
    *   Para histórias ramificadas, o autor tem controle total sobre as `Choices` explícitas, definindo múltiplos caminhos entre cenas.

3.  **Modos de Operação Flexíveis (Online e Offline):**
    *   **Modo Online:** Conecta-se a um backend remoto (PostgreSQL por padrão), ideal para acesso compartilhado.
    *   **Modo Offline:** Opera com um backend local (SQLite por padrão) no próprio dispositivo do usuário, garantindo privacidade e desempenho.
    *   **Isolamento de Dados:** Os dados nos modos online e offline são completamente isolados; não há sincronização automática.
    *   **Exportação/Importação:** Funcionalidades robustas de exportação (para JSON) e importação permitem que o usuário transfira manualmente suas histórias entre os modos ou instâncias.

4.  **Arquitetura e Tecnologias:**
    *   **Monorepo:** Estrutura organizada com `apps/` (para `api` e `client`) e `packages/` (para `shared` e `db`).
    *   **Backend (`apps/api`):** Desenvolvido com Hono (rotas/validação), Zod (validação de schemas), Drizzle ORM (persistência) e ULID (identificadores únicos).
    *   **Frontend (`apps/client`):** Construído com React Native, Expo e React Native Web para uma base de código unificada, visando compatibilidade web e mobile.
    *   **Banco de Dados:** Suporte a PostgreSQL (online) e SQLite (offline), com conexão dinâmica baseada no `APP_MODE`.
    *   **Autenticação:** Implementação de autenticação baseada em JWT.

## Estrutura de Dados (Entidades Principais)

O Keres utiliza um esquema de banco de dados detalhado com ULID como chaves primárias e campos comuns como `is_favorite`, `extra_notes`, `created_at`, `updated_at` para a maioria das entidades. As principais entidades incluem:

*   `users`: Gerencia usuários e suas credenciais.
*   `story`: A entidade central, com `type` (`linear`/`branching`) e `user_id`.
*   `characters`: Detalhes dos personagens.
*   `gallery`: Imagens associadas a elementos da história.
*   `chapters`: Coleções de cenas.
*   `scenes`: Coleções de momentos, com `index` e `location_id`.
*   `moments`: O "átomo" do planejamento da história.
*   `locations`: Informações sobre locais.
*   `choices`: Conecta cenas em histórias ramificadas, com `is_implicit` para diferenciar escolhas automáticas de manuais.
*   `world_rules`: Regras do universo da história.
*   `notes`: Anotações livres.
*   `tags`: Categorização de elementos.
*   `suggestions`: Gerencia listas customizáveis (ex: gêneros, raças).
*   **Tabelas Relacionais:** `character_moments` (quem estava onde e quando) e `character_relations` (relações entre personagens).

## Proposta de Valor

Keres visa ser uma ferramenta essencial para escritores, oferecendo:
*   **Organização Detalhada:** Capacidade de estruturar e gerenciar todos os elementos de uma história de forma granular.
*   **Flexibilidade Narrativa:** Suporte para diferentes estilos de escrita, desde narrativas lineares tradicionais até histórias interativas complexas.
*   **Controle e Privacidade:** Opções de self-hosting e modo offline com dados isolados, dando ao usuário total controle sobre suas informações.
*   **Acessibilidade:** Design intuitivo e multiplataforma (web e mobile) para facilitar o uso.
