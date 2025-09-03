
# Keres - Estratégia para Modo Offline

Este documento detalha a estratégia adotada para implementar o modo offline no Keres, combinando uma experiência de usuário híbrida com uma arquitetura de dados isolada, complementada por funcionalidades de exportação e importação.

## 1. Abordagem de Experiência do Usuário (UX Híbrida)

O aplicativo Keres oferecerá ao usuário a escolha explícita entre operar em modo "Online" ou "Offline" no ponto de entrada (tela de login).

*   **Modo Online:** O aplicativo se conectará a um backend remoto (servidor central), permitindo acesso a dados compartilhados e colaboração (se implementado no futuro).
*   **Modo Offline:** O aplicativo se conectará a um backend local (executado no próprio dispositivo do usuário), utilizando um banco de dados SQLite local e independente.

A interface do usuário indicará claramente o modo de operação atual, e o aplicativo lembrará a última escolha do usuário para conveniência.

## 2. Abordagem de Dados (Datasets Independentes)

A principal característica desta estratégia é que os dados nos modos online e offline serão **completamente isolados**. Não haverá sincronização automática entre o banco de dados remoto e o banco de dados SQLite local.

**Prós:**
*   **Simplicidade na Implementação:** Evita a complexidade inerente à sincronização de dados em tempo real e à resolução de conflitos (ex: "last-write-wins", mesclagem de dados), que são notoriamente difíceis de implementar corretamente e podem levar a perda de dados ou inconsistências.
*   **Previsibilidade:** As alterações de dados são locais e não são afetadas por operações externas inesperadas.
*   **Privacidade e Segurança:** Para usuários que preferem manter seus dados estritamente locais e não expostos a servidores externos.
*   **Desempenho:** Operações locais são geralmente mais rápidas, pois não dependem da latência da rede.
*   **Alinhamento com "Self-Hosted/Offline":** Suporta diretamente a visão de um aplicativo que pode ser totalmente autônomo no dispositivo do usuário.

**Contras:**
*   **Sem Sincronização Automática:** Os usuários precisarão entender que os dados não são compartilhados automaticamente entre os modos. Isso requer comunicação clara na UI.
*   **Transferência Manual de Dados:** Para mover dados entre os modos online e offline, o usuário precisará realizar operações explícitas de exportação e importação.
*   **Potencial para Confusão:** Se não for bem comunicado, o usuário pode criar dados em um modo e esperar vê-los no outro, levando a frustração.

## 3. Funcionalidades de Exportação e Importação

Para permitir que os usuários gerenciem seus dados entre os modos online e offline (ou entre diferentes instâncias do aplicativo), serão implementadas funcionalidades robustas de exportação e importação.

*   **Exportação:** Permitirá que o usuário exporte uma história completa (incluindo todos os seus dados relacionados, como personagens, cenas, etc.) para um arquivo JSON.
*   **Importação:** Permitirá que o usuário importe um arquivo JSON de história para o banco de dados atual (seja ele o remoto ou o local).

Essas funcionalidades servirão como o mecanismo principal para "sincronização" manual, dando total controle ao usuário sobre seus dados.

## 4. Adaptação Técnica do Backend (`apps/api`)

Para suportar esta estratégia, o backend Hono (`apps/api`) será adaptado para:

*   **Conexão Dinâmica ao Banco de Dados:** O backend será configurado para alternar sua conexão Drizzle ORM entre um banco de dados PostgreSQL (para o modo online) e um banco de dados SQLite (para o modo offline), com base em variáveis de ambiente ou configuração fornecida pelo frontend.
*   **Execução Local:** O `apps/api` será projetado para ser executável como um processo local no dispositivo do usuário (ex: empacotado com Electron para desktop, ou como um serviço leve em mobile).
*   **Endpoints de Exportação/Importação:** Serão adicionadas rotas de API específicas para lidar com as operações de exportação e importação de dados.

Esta abordagem oferece um equilíbrio entre funcionalidade, simplicidade de desenvolvimento e controle do usuário, alinhando-se com a visão central do projeto Keres.
