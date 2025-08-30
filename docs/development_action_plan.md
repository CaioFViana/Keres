# Keres - Plano de Ação para Desenvolvimento do Sistema

Este documento detalha um plano de ação faseado para o desenvolvimento do sistema Keres, baseado no `docs/project_plan.md` e nas decisões arquiteturais tomadas. O desenvolvimento seguirá uma abordagem de backend-first para as funcionalidades principais, seguida pela integração frontend e, por fim, a implementação do modo offline e sincronização.

## Fase 1: Configuração e Infraestrutura Essencial

1.  **Inicialização do Monorepo:**
    *   Configurar o `package.json` raiz para gerenciar os workspaces (`apps/*` e `packages/*`).
    *   Instalar ferramentas de monorepo (ex: Turborepo, Nx, Lerna - se necessário, ou usar workspaces nativos do npm/yarn/bun).

2.  **Configuração de `packages/shared`:**
    *   Definir tipos e interfaces globais do projeto.
    *   Criar contratos Zod para validação de dados que serão compartilhados entre backend e frontend.
    *   Configurar utilitários comuns.

3.  **Configuração de `packages/db`:**
    *   Configurar o Drizzle ORM.
    *   Definir o esquema inicial para a tabela `users`.
    *   Criar a primeira migration para a tabela `users`.
    *   Configurar o ambiente de banco de dados (ex: Docker para PostgreSQL/SQLite).

4.  **Configuração de `apps/api`:**
    *   Configurar o Hono para o servidor API.
    *   Configurar o ambiente de desenvolvimento (TypeScript, ESLint, Prettier).
    *   Estruturar as camadas de Clean Architecture (`domain`, `application`, `infrastructure`, `presentation`, `shared`).

## Fase 2: Gerenciamento de Usuários (Backend Completo)

1.  **Implementação do Domínio de Usuários:**
    *   Definir a entidade `User` em `apps/api/src/domain/entities/User.ts`.
    *   Criar interfaces para o repositório de usuários em `apps/api/src/domain/repositories/IUserRepository.ts`.
    *   Desenvolver serviços de domínio relacionados a usuários (ex: `PasswordHasherService`) em `apps/api/src/domain/services/`.

2.  **Implementação da Infraestrutura de Usuários:**
    *   Implementar o repositório de usuários (`UserRepository`) em `apps/api/src/infrastructure/persistence/` usando Drizzle.
    *   Implementar serviços de infraestrutura (ex: `BcryptPasswordHasher`) em `apps/api/src/infrastructure/services/`.

3.  **Implementação da Aplicação de Usuários:**
    *   Criar casos de uso para usuários (ex: `CreateUserUseCase`, `AuthenticateUserUseCase`, `GetUserProfileUseCase`) em `apps/api/src/application/use-cases/`.
    *   Definir DTOs de entrada e saída para os casos de uso em `apps/api/src/application/dtos/`.

4.  **Implementação da Apresentação de Usuários:**
    *   Desenvolver controladores para as rotas de usuário (ex: `UserController`) em `apps/api/src/presentation/controllers/`.
    *   Definir as rotas Hono para autenticação e CRUD de usuários em `apps/api/src/presentation/routes/`.
    *   Criar schemas Zod para validação de requisições e respostas de usuário em `apps/api/src/presentation/schemas/`.

5.  **Testes:**
    *   Escrever testes unitários para o domínio, aplicação e infraestrutura de usuários.
    *   Escrever testes de integração para as rotas da API de usuários.

## Fase 3: Gerenciamento de Histórias (Backend Completo)

1.  **Implementação do Domínio de Histórias:**
    *   Definir a entidade `Story` e outras entidades relacionadas (se houver) em `apps/api/src/domain/entities/`.
    *   Criar interfaces para o repositório de histórias em `apps/api/src/domain/repositories/IStoryRepository.ts`.

2.  **Implementação da Infraestrutura de Histórias:**
    *   Implementar o repositório de histórias (`StoryRepository`) em `apps/api/src/infrastructure/persistence/`.

3.  **Implementação da Aplicação de Histórias:**
    *   Criar casos de uso para histórias (ex: `CreateStoryUseCase`, `GetStoryUseCase`, `UpdateStoryUseCase`, `DeleteStoryUseCase`) em `apps/api/src/application/use-cases/`.
    *   Definir DTOs de entrada e saída para os casos de uso de histórias.

4.  **Implementação da Apresentação de Histórias:**
    *   Desenvolver controladores para as rotas de história (ex: `StoryController`) em `apps/api/src/presentation/controllers/`.
    *   Definir as rotas Hono para CRUD de histórias em `apps/api/src/presentation/routes/`.
    *   Criar schemas Zod para validação de requisições e respostas de história.

5.  **Testes:**
    *   Escrever testes unitários e de integração para o módulo de histórias.

## Fase 4: Desenvolvimento Frontend Core

1.  **Inicialização do Projeto Expo:**
    *   Criar o projeto Expo em `apps/client`.
    *   Configurar o ambiente de desenvolvimento (TypeScript, ESLint, Prettier).

2.  **Configuração de Navegação:**
    *   Implementar a navegação principal do aplicativo usando React Navigation.

3.  **Interface de Usuário e Autenticação:**
    *   Desenvolver telas de login e registro.
    *   Integrar com a API de usuários para autenticação e gerenciamento de perfil.

4.  **Interface de Gerenciamento de Histórias:**
    *   Desenvolver tela para listar histórias do usuário.
    *   Implementar funcionalidade para criar novas histórias.
    *   Desenvolver tela para visualizar e editar detalhes de uma história.

## Fase 5: Desenvolvimento Iterativo de Funcionalidades (Backend & Frontend)

Para cada uma das seguintes funcionalidades, seguir o ciclo:
*   Definição do esquema da tabela em `packages/db`.
*   Implementação do domínio (entidades, interfaces de repositório) no backend.
*   Implementação da infraestrutura (repositórios) no backend.
*   Criação de casos de uso na camada de aplicação do backend.
*   Desenvolvimento de controladores e rotas na camada de apresentação do backend.
*   Criação de schemas Zod para validação.
*   Desenvolvimento da interface de usuário correspondente no frontend.
*   Escrita de testes (unitários, integração).

1.  **Personagens:** Gerenciamento completo de personagens (CRUD).
2.  **Capítulos, Cenas e Momentos:** Estruturação da narrativa (CRUD).
3.  **Locais:** Gerenciamento de informações sobre locais (CRUD).
4.  **Galeria:** Upload e gerenciamento de imagens (CRUD).
5.  **Relações (Personagem X Personagem, Personagem X Momento):** Definição e rastreamento de relações.
6.  **Regras do Mundo, Notas e Tags:** Gerenciamento de metadados e informações adicionais.
7.  **Listas Customizáveis (Sugestões):** Interface para o usuário gerenciar suas listas personalizadas.

## Fase 6: Modo Offline e Sincronização

1.  **Integração SQLite:**
    *   Configurar o SQLite no `apps/client` para armazenamento local de dados.
    *   Adaptar os repositórios do frontend para usar SQLite quando offline.

2.  **Lógica de Sincronização:**
    *   Desenvolver um mecanismo de sincronização para manter os dados consistentes entre o armazenamento local (SQLite) e a API online.
    *   Implementar estratégias de resolução de conflitos (se aplicável).

3.  **Exportação/Importação de Dados:**
    *   Implementar funcionalidade para exportar histórias completas (incluindo dados relacionados e imagens) para JSON.
    *   Implementar funcionalidade para importar histórias de JSON.

## Fase 7: Testes Abrangentes, Refinamento e Implantação

1.  **Testes:**
    *   Realizar testes de ponta a ponta (E2E) para as principais jornadas do usuário.
    *   Revisar e expandir a cobertura de testes unitários e de integração.

2.  **Otimização e Segurança:**
    *   Otimizar o desempenho do backend e frontend.
    *   Realizar uma revisão de segurança para identificar e mitigar vulnerabilidades.

3.  **Documentação:**
    *   Atualizar a documentação técnica e de usuário.

4.  **Implantação:**
    *   Definir e automatizar o processo de implantação para o backend e o frontend (web e mobile).
