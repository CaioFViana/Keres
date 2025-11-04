# Keres - Story Organizer Project Plan

Um projeto offline-first para organização de histórias (solo ou colaborativa), com sincronização inteligente entre dispositivos locais e servidor remoto. O objetivo é fornecer uma ferramenta robusta e intuitiva para escritores, permitindo que organizem todos os aspectos de suas narrativas, desde personagens e locais até a estrutura de cenas e regras do mundo. O sistema será projetado para ser acessível e fácil de usar, com foco na organização eficiente do conteúdo da história.

Backend com **Elysia (Bun)** + **Zod** para rotas/validação, **Drizzle ORM** para persistência, **ULID** como identificadores. Frontend (React Native/Expo para mobile, Tauri + React para desktop) terá suporte a SQLite local em um modelo offline-first com engine de sincronização.

---

## 📂 Estrutura de Repositório

```
story-organizer/
├── apps/
│ ├── api/ # API Elysia (Bun)
│ │ ├── src/
│ │ │ ├── index.ts # bootstrap Elysia app
│ │ │ ├── routes/ # rotas agrupadas por recurso
│ │ │ ├── schemas/ # validações Zod
│ │ │ ├── db/ # config Drizzle
│ │ │ └── modules/ # controllers/use-cases
│ ├── client/ # frontend (React Native + Expo)
│
├── packages/
│ ├── shared/ # tipos, utils, contratos zod
│ ├── db/ # schema drizzle + migrations
│ └── config/ # configuração comum
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 🗄️ Estrutura de Dados

*   **Atualizações Recentes:** A tabela `Story` agora inclui um campo `type` para diferenciar entre histórias lineares e ramificadas. Uma nova tabela `Choices` foi adicionada para suportar a mecânica de histórias "Escolha Sua Aventura".

### Usuários
Para permitir múltiplos logins. Cada usuário pode ter quantas histórias desejar, sem que as tabelas de outras histórias interfiram (Ex: "raças" de uma história não devem aparecer em outra).

**Nota sobre a Tabela `User` Local (Cliente):**
A tabela `User` no banco de dados local do cliente funcionará primariamente como um **cache de dados de referência**. Ela armazenará informações mínimas de usuários remotos (como `id`, `username`, `displayName`, `avatarUrl`, `version`) que são referenciados por histórias ou outras entidades que o usuário local possui ou com as quais interage. Esta tabela **não** se destina a ser uma cópia completa de todos os usuários do servidor remoto, nem uma "lista de amigos" social. O motor de sincronização será responsável por popular e manter este cache, garantindo que os dados de usuários relevantes estejam disponíveis offline para manter a integridade referencial das histórias.

**Nota Importante sobre Sincronização:** Para suportar a engine de sincronização offline-first, todas as entidades persistentes (como `Story`, `Character`, `Chapter`, etc.) incluirão um campo `version: number;`. Este campo é crucial para a detecção e resolução de conflitos durante o processo de sincronização entre clientes e o servidor, garantindo a consistência dos dados.

### Story
A tabela principal. Armazena os dados gerais da história.

### Characters
Nenhuma história existe sem personagens.

### Gallery
Para usar imagens para ilustrar elementos da história.

### Chapters
Uma coleção de cenas. Não significa ordem cronológica, mas sim "ordem de exibição".

### Scenes
Unidades narrativas fundamentais.

### Locations
Informações gerais sobre um local.

### Relational Tables

#### Character X Scene
Lista quem estava onde e quando.

#### Character X Character
Relações fixas. Como "irmãos", "Mestre/Escravo", "Mãe/Filha"...

### Choices
Representa as escolhas em histórias ramificadas (CYOA).

### World Rules
Por exemplo, quem pode fazer o quê? Qual é a relação de poder?

Ex: Mana é necessária para lançar feitiços.
Ex: Com cristais elementais, podemos carregar máquinas para lançar os mesmos feitiços daquele elemento.
Ex: Ninguém pode usar o elemento luz. Exceto nosso protagonista. É o que o torna especial.

### Notes
Qualquer autor deve ser capaz de escrever livremente, sem muita organização ou vinculação a algo. O sistema permitirá ancorar a algo, mas não o forçará.

### Tags
Enquanto alguns enumeradores agem como tags, nem tudo se encaixa nisso. Aplicamos tags a tudo com uma tabela relacional?

### Listas Customizáveis (Suggestions)
Para campos que requerem listas de valores pré-definidos (como gêneros literários, raças, gêneros de personagens, tipos de relação, etc.), o sistema oferecerá um mecanismo de listas customizáveis. O objetivo é fornecer sugestões padrão, mas permitir total flexibilidade para o usuário adaptar ou criar suas próprias entradas.

**Características:**
- **Sugestões Padrão:** O sistema virá com listas de sugestões comuns (ex: gêneros literários populares, raças de fantasia comuns, gêneros de personagens básicos).
- **Customização pelo Usuário:** O usuário poderá adicionar, editar ou remover qualquer entrada dessas listas. As alterações são persistentes e específicas do usuário.
- **Escopo:**
    - **Por História:** Para elementos mais específicos de um universo narrativo (ex: raças e sub-raças personalizadas, gêneros de personagens únicos para aquela história), as listas podem ser customizadas por história.

**Exemplos de Uso:**
- **Gêneros Literários:** O usuário pode adicionar "Fantasia Urbana" ou remover "Romance Histórico" das sugestões.
- **Gêneros de Personagens:** Além de "Masculino" e "Feminino", o usuário pode adicionar "Não-binário" ou "Agênero", ou até mesmo termos específicos do seu mundo como "Elfo-do-Bosque".
- **Raças/Sub-raças:** O sistema pode sugerir "Elfo", "Anão", "Humano", mas o usuário pode adicionar "Draconiano" ou "Meio-Orc", e sub-raças como "Elfo da Floresta" ou "Anão da Montanha".
- **Tipos de Relação:** Além de "Irmão", "Mãe", "Amigo", o usuário pode adicionar "Mentor", "Rival", "Mestre/Aprendiz".

### Gráfico de Relações entre Entidades

```mermaid
graph LR
    users --> story
    users --> suggestions

    story --> characters
    story --> gallery
    story --> chapters
    story --> locations
    story --> world_rules
    story --> notes
    story --> tags
    story -- when story specific --> suggestions

    chapters --> scenes
    locations -- occurs on--> scenes

    scenes -- source --> choices
    choices -- target (next_scene_id) --> scenes

    tags -- via relational table --> chapters/scenes/characters/locations
    characters --> character_relations
    character_relations --> characters

    characters --> character_scenes
    character_scenes --> scenes


    notes -- can have --> gallery
```

## 🔗 Fluxo de Arquitetura

- **API** (`apps/api`)
  - Elysia (Bun) expõe rotas REST/JSON.
  - Zod valida inputs/outputs.
  - Drizzle manipula DB.
  - ULID gera IDs.
  - Engine de Sincronização (op-based replication)

### Estratégia de Resolução de Conflitos

Para garantir a integridade dos dados e uma experiência de usuário consistente em um ambiente colaborativo e offline-first, o Keres adotará uma estratégia híbrida de resolução de conflitos:

*   **Conflitos de Edição (mesmo campo):** Será aplicada a regra **Última Escrita Vence (Last-Write-Wins - LWW)**, utilizando o campo `updated_at` (timestamp) da entidade. A alteração mais recente prevalecerá. O campo `version`, gerenciado pelo servidor, será usado para garantir atualizações sequenciais e detectar dados de cliente desatualizados.
*   **Conflitos de Edição (campos diferentes):** Se diferentes clientes editarem campos distintos da mesma entidade, as alterações serão **mescladas** automaticamente.
*   **Conflitos Envolvendo Exclusões:** A **exclusão sempre vencerá uma edição**. Para isso, as entidades que podem ser excluídas e sincronizadas incluirão os campos `isDeleted: boolean` e `deletedAt: number | null` (tombstones). Se um item for marcado como excluído por um cliente e editado por outro, a exclusão será priorizada, garantindo que a intenção de remover o item seja respeitada.

### Estratégias de Armazenamento de Atualizações para Sincronização

Para otimizar o desempenho e o uso de recursos, a estratégia de armazenamento de atualizações (`StoryUpdates`) variará conforme o estado de sincronização da história:

*   **Histórias Online (Sincronizadas com Servidor):** Para histórias que já foram sincronizadas com um servidor remoto, todas as atualizações desde a última sincronização bem-sucedida devem ser armazenadas. Isso garante que nenhum dado seja perdido e que a replicação seja completa quando a conexão for restabelecida.
*   **Histórias Offline (Nunca Sincronizadas):** Para histórias que são estritamente locais e nunca foram sincronizadas com um servidor, apenas as últimas 500 atualizações devem ser mantidas. Isso evita o acúmulo excessivo de dados de histórico que não seriam utilizados para sincronização remota, mantendo o banco de dados local leve e eficiente.

### Mecanismo Detalhado de Sincronização

1.  **Formato das Operações (`StoryUpdates`):** As operações serão definidas como objetos JSON que descrevem a mudança. Exemplos:
    *   `{"type": "create", "entity": "NomeDaEntidade", "data": {...}}`
    *   `{"type": "update", "entity": "NomeDaEntidade", "id": "ulid", "changes": {"campo": "novo_valor"}}`
    *   `{"type": "delete", "entity": "NomeDaEntidade", "id": "ulid"}`
2.  **Mecanismo de Rastreamento de Mudanças:** O ORM do lado do cliente (ou camada de banco de dados customizada) irá interceptar todas as operações de criação, atualização e exclusão. Para cada operação, ele gerará um registro `StoryUpdate` (conforme definido acima) e o armazenará em uma tabela local de "log de operações". Este log será a fonte para a sincronização.
3.  **Protocolo de Comunicação:** WebSockets serão utilizados para notificações em tempo real de mudanças. Uma API REST será empregada para puxar e empurrar informações, permitindo também solicitações manuais de mudanças.
4.  **Autenticação e Autorização:** JWT (JSON Web Tokens) será usado para autenticação. O administrador do servidor registrará os clientes, e estes receberão uma chave de API ou usarão login/senha para obter um JWT e um refresh token.
5.  **Sincronização Inicial (Bootstrapping):** Haverá uma função de importação/exportação de histórias a partir de JSON, permitindo que o servidor envie uma história inteira de uma vez. As tabelas de história são agnósticas ao ID do usuário e utilizam ULIDs para garantir unicidade universal.
6.  **Lógica de Mesclagem de Campos Diferentes:** Para campos diferentes dentro da mesma entidade, todas as alterações não conflitantes de ambos os lados serão aplicadas. Se houver conflito no *mesmo* campo, a estratégia LWW (Última Escrita Vence), baseada no campo `updated_at` (timestamp), será aplicada.
7.  **Gerenciamento das "Últimas 500 Atualizações":** Uma tabela dedicada de "log de operações" armazenará as atualizações. Para histórias offline, quando o número de entradas exceder 500, as entradas mais antigas serão excluídas. Isso pode ser determinado usando `ROW_NUMBER()` ordenado por `updated_at` em ordem decrescente.
8.  **Tratamento de Erros e Retentativas:** Cada operação de sincronização enviada será tratada como uma transação. Se nem todas as operações do servidor forem enviadas com sucesso, nenhuma alteração será aplicada (tudo ou nada).
9.  **Integração do Banco de Dados Local Customizado:** A pasta `packages/shared/entities` contém o mapeamento inicial e idealizado das tabelas. A implementação do banco de dados local customizado aderirá a essas definições de entidade.
10. **Detecção de Conflitos Complexos:** Se um campo foi atualizado recentemente (por exemplo, nas últimas horas), uma notificação será exibida na tela para informar o usuário sobre a alteração recente.

- **Frontend** (`apps/client`)
  - Desenvolvido com React Native, Expo e React Native Web para uma base de código unificada.
  - Opera de forma offline-first utilizando **um banco de dados local customizado**.
  - Sincroniza automaticamente com a API remota via o engine de sincronização.

### Configuração de Ambiente

O Keres adota uma abordagem offline-first, onde a configuração de ambiente para o banco de dados é adaptada para suportar tanto o uso local (SQLite) quanto a conexão com um servidor remoto (PostgreSQL).

#### Variável `DATABASE_URL`

A string de conexão para o banco de dados é a principal forma de configurar a persistência.

*   **Para uso local (offline-first):** O cliente usará um banco de dados SQLite local, tipicamente um arquivo no sistema de arquivos do usuário (ex: `file:./data/keres.sqlite`).
*   **Para conexão ao servidor:** O servidor se conectará a um banco de dados PostgreSQL (ex: `postgres://user:password@localhost:5432/keres_db`).

#### Variável `JWT_SECRET`

O segredo usado para assinar e verificar JSON Web Tokens (JWTs) é configurável:

*   **Para o servidor:** Recomenda-se um segredo forte e aleatório, gerenciado com segurança.
*   **Para o cliente (offline-first):** Pode ser um segredo fixo ou gerado na primeira execução, usado para verificações de tokens locais.

#### Exemplo de Arquivos `.env`

Você pode usar arquivos `.env` para gerenciar essas variáveis de ambiente.

**`.env` para o Servidor:**

```dotenv
DATABASE_URL=postgres://seu_usuario:sua_senha@seu_host_db:5432/seu_db_nome
JWT_SECRET=seu_segredo_jwt_forte_para_online
```

**`.env` para o Cliente (Offline-First):**

```dotenv
DATABASE_URL=file:./data/keres.sqlite # Caminho para o arquivo SQLite local
JWT_SECRET=segredo_jwt_fixo_para_offline # Ou gerado dinamicamente
```

---

## 🏗️ Próximos Passos

- Definir migrations no `packages/db` (Drizzle).
- Criar contratos Zod no `packages/shared`.
- Implementar rotas CRUD base (users, stories, characters).
- Desenvolver o engine de sincronização.
- Criar app desktop com SQLite integrado (Tauri/Electron).