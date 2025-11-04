Explicação da Estrutura de Arquivos:

   * `apps/client/src/App.tsx`:
       * Propósito: É o componente raiz da aplicação React Native. Ele será responsável por configurar provedores globais (como o ThemeProvider e o NavigationContainer),
         gerenciar estados de carregamento iniciais e renderizar o navegador principal da aplicação.
       * Escolha: Manter o App.tsx o mais limpo possível, delegando responsabilidades específicas a outros componentes e provedores, é uma boa prática para escalabilidade e
         manutenção.

   * `apps/client/src/navigation/`: Este diretório agrupa toda a lógica de navegação da aplicação.
       * `AppNavigator.tsx`:
           * Propósito: O navegador de nível superior que orquestra a transição entre os principais "stacks" da aplicação (Cold Install, Seleção de Histórias, Sistema Principal).
           * Escolha: Centraliza a lógica de navegação principal, tornando mais fácil entender o fluxo geral e adicionar novas seções.
       * `ColdInstallStack.tsx`:
           * Propósito: Um navegador de pilha dedicado para a experiência de onboarding inicial do usuário.
           * Escolha: Garante um fluxo isolado e linear para novos usuários, sem distrações das funcionalidades principais.
       * `StorySelectionStack.tsx`:
           * Propósito: Um navegador de pilha para gerenciar as telas relacionadas à seleção, criação e gerenciamento de histórias.
           * Escolha: Agrupa funcionalidades relacionadas à gestão de histórias, facilitando a navegação dentro desse contexto.
       * `MainSystemStack.tsx`:
           * Propósito: Um navegador de pilha para a funcionalidade central da aplicação, que provavelmente incluirá um navegador de gaveta (drawer navigator) para a barra
             lateral, conforme descrito no screen_flow.md.
           * Escolha: Organiza as telas do sistema principal, permitindo uma navegação complexa (como a barra lateral) sem sobrecarregar o navegador principal.

   * `apps/client/src/screens/`: Este diretório contém os componentes das telas principais da aplicação.
       * `ColdInstallScreen.tsx`:
           * Propósito: A tela de boas-vindas e configuração inicial do usuário.
           * Escolha: Componente específico para a primeira interação do usuário.
       * `StorySelectionScreen.tsx`:
           * Propósito: A tela onde os usuários visualizam e selecionam suas histórias.
           * Escolha: Componente central para a gestão de histórias.
       * `MainDashboardScreen.tsx`:
           * Propósito: A tela principal do dashboard para uma história selecionada, fornecendo uma visão geral e estatísticas.
           * Escolha: Ponto de entrada visual para uma história ativa.
       * `GalleryScreen.tsx`:
           * Propósito: Tela dedicada à exibição de imagens e itens da galeria.
           * Escolha: Funcionalidade específica que se beneficia de uma tela dedicada.
       * `SettingsScreen.tsx`:
           * Propósito: Tela para configurações da aplicação e configurações específicas da história.
           * Escolha: Centraliza as opções de configuração.
       * `ImportExportScreen.tsx`:
           * Propósito: Tela para lidar com a funcionalidade de importação/exportação de JSON.
           * Escolha: Funcionalidade distinta que requer uma interface de usuário própria.
       * `CharacterRelationsScreen.tsx`:
           * Propósito: Tela para gerenciar e exibir relacionamentos entre personagens.
           * Escolha: Funcionalidade específica que pode ter uma UI complexa.
       * `ChoicesScreen.tsx`:
           * Propósito: Tela para gerenciar as escolhas da história, potencialmente incluindo uma visualização em grafo.
           * Escolha: Funcionalidade central para histórias ramificadas.
       * `common/`: Um subdiretório para padrões de tela genéricos e reutilizáveis.
           * `ListingScreen.tsx`:
               * Propósito: Um componente de tela genérico que pode ser reutilizado para exibir listas de várias entidades (Personagens, Locais, Capítulos, etc.).
               * Escolha: Reduz a duplicação de código e promove a consistência na exibição de listas.
           * `DetailScreen.tsx`:
               * Propósito: Um componente de tela genérico para exibir os detalhes de uma única entidade e fornecer opções de edição.
               * Escolha: Promove a reutilização e a consistência na exibição de detalhes de entidades.
   * `apps/client/src/theme/`: Este diretório centraliza toda a lógica e definições relacionadas a temas.
       * `colors.ts`:
           * Propósito: Define as paletas de cores para os modos claro e escuro, garantindo consistência em toda a aplicação.
           * Escolha: Centraliza as definições de cores, facilitando a manutenção e a troca de temas.
       * `ThemeProvider.tsx`:
           * Propósito: Um Provedor de Contexto React que disponibiliza o tema atual (incluindo cores) para todos os componentes filhos.
           * Escolha: Permite que os componentes acessem as cores e outras propriedades do tema sem a necessidade de passá-las manualmente via props.
       * `index.ts`:
           * Propósito: Um arquivo "barrel" para exportar todas as utilidades e componentes relacionados ao tema deste diretório.
           * Escolha: Simplifica as importações de módulos relacionados ao tema.

   * `apps/client/src/state/`: Este diretório contém os "stores" do Zustand para gerenciamento de estado global.
       * `themeStore.ts`:
           * Propósito: Um store Zustand para gerenciar o estado atual do tema (por exemplo, isDarkMode), permitindo que os componentes reajam às mudanças de tema.
           * Escolha: Centraliza o estado do tema, tornando-o acessível globalmente.
       * `authStore.ts`:
           * Propósito: Um store Zustand para gerenciar o estado de autenticação do usuário (por exemplo, JWT, informações do usuário).
           * Escolha: Centraliza o estado de autenticação, essencial para proteger rotas e funcionalidades.
       * `storyStore.ts`:
           * Propósito: Um store Zustand para gerenciar a história atualmente selecionada e outros dados globais relacionados à história.
           * Escolha: Centraliza o estado da história ativa, facilitando o acesso e a modificação em toda a aplicação.

   * `apps/client/src/utils/`: Este diretório contém funções e serviços utilitários.
       * `db.ts`:
           * Propósito: Conterá funções para inicializar e interagir com o banco de dados SQLite local.
           * Escolha: Separa a lógica de persistência de dados local do restante da aplicação.
       * `syncEngine.ts`:
           * Propósito: Abrigará a lógica para a engine de sincronização customizada, lidando com rastreamento de mudanças, comunicação com o backend e resolução de conflitos.
           * Escolha: Centraliza a complexa lógica de sincronização, mantendo-a modular e reutilizável.