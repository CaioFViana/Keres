# Plano de testes do Keres

## Objetivo

Introduzir testes sem acoplar os ambientes que o monorepo já usa: Expo/React Native,
Elysia/PostgreSQL, Vite/React e Electron.

## Ferramentas

| Área | Ferramenta principal | Escopo inicial |
| --- | --- | --- |
| `packages/shared` | Vitest | Schemas, migrações de exportação e utilitários puros. |
| `apps/api` | Vitest | Serviços e rotas Elysia, com banco isolado para integração. |
| `apps/admin` | Vitest + Testing Library | Componentes e páginas React/Vite. |
| `apps/client` | Jest + `jest-expo` + React Native Testing Library | Componentes, hooks e fluxos Expo. |
| `apps/desktop` | Vitest | Utilitários e IPC, com Electron mockado. |

## Ordem de implantação

1. Separar, na API, a criação da aplicação dos efeitos de bootstrap (migrações, admin root e
   abertura de porta). Testes devem importar `createApp()` sem tocar no banco.
2. Adicionar Vitest ao pacote Shared e cobrir schemas/migrações que já são regras críticas.
3. Configurar Vitest para API/Admin/Desktop e um comando raiz que os orquestre.
4. Configurar Jest Expo exclusivamente no Client; testes não ficam em diretórios de rotas.
5. Introduzir integração com PostgreSQL descartável para a API e, depois, E2E web/mobile
   separadamente dos testes unitários.

## Regras

- O comando raiz deve executar todas as suítes sem iniciar servidores de desenvolvimento.
- Testes de API nunca usam o banco de desenvolvimento.
- Módulos nativos Expo e Electron são mockados em testes unitários.
- Um formato de teste novo deve entrar no CI antes de se tornar obrigatório para releases.
