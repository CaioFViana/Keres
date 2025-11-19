# Estratégia de Resolução de Conflitos no Lado do Cliente

Este documento descreve a estratégia recomendada para o lado do cliente resolver conflitos em um ambiente colaborativo, especialmente para reordenação de cenas em histórias lineares e modificações de escolhas em histórias ramificadas. A abordagem é construída sobre a estratégia Last-Write-Wins (LWW) no servidor, onde o servidor prioriza a última alteração válida e rejeita atualizações baseadas em dados desatualizados.

## 1. Cenários de Conflito

Conflitos surgem quando múltiplos usuários modificam a mesma entidade ou um conjunto interdependente de entidades simultaneamente.

*   **Reordenação de Cenas (`index` da entidade `Scene` em histórias lineares):** Se dois usuários reordenarem cenas dentro do mesmo capítulo, suas atualizações para os campos `index` das `Scene`s podem colidir. A LWW no servidor garantirá que apenas uma série de atualizações de `index` para uma `Scene` específica prevaleça.
*   **Modificação de Escolhas (`Choice` em histórias ramificadas):**
    *   Se dois usuários editarem o mesmo campo (ex: `text` ou `nextSceneId`) de uma `Choice` existente, a LWW no servidor aplicará a última alteração válida.
    *   A criação de novas `Choice`s não gera conflitos de ID, pois ULIDs são usados.

## 2. Papel do Servidor (Resumo)

O servidor atua como árbitro final, aplicando a regra Last-Write-Wins (LWW) e garantindo a consistência dos dados através de:

*   **Bloqueio Otimista:** Cada entidade possui um campo `version`. O servidor rejeita qualquer atualização se a `version` fornecida pelo cliente for menor do que a `version` atual do servidor para aquela entidade (`clientVersion < serverVersion`).
*   **Processamento de `index` de Cena:** O `SceneSyncHandler` processa as atualizações de `index` para cenas individuais e regenera as `Choices` implícitas para o capítulo, mantendo a consistência.
*   **Rejeições Claras:** Em caso de conflito de `version`, o servidor retorna um erro explícito ao cliente.

## 3. Fluxo de Resolução de Conflitos no Lado do Cliente

A responsabilidade de uma experiência de usuário fluida em face de conflitos recai sobre o cliente.

### 3.1. Quando o Cliente Envia Atualizações (Push)

1.  **Geração de `StoryUpdate`:** O cliente gera operações `UPDATE` individuais para cada `Scene` ou `Choice` cujo `index` ou propriedades foram alteradas. Cada `UPDATE` inclui o `id` da entidade, as `changes` (por exemplo, `index`, `text`, `nextSceneId`) e a `version` da entidade *conhecida pelo cliente naquele momento*.
2.  **Push para o Servidor:** O motor de sincronização do cliente envia essas operações para o servidor.
3.  **Captura de Rejeições:** O cliente deve capturar as respostas do servidor:
    *   **Sucesso:** A atualização foi aplicada no servidor.
    *   **Rejeição por Conflito:** O servidor retornou um erro (ex: `Conflict: Scene <ID> is outdated...`). O cliente deve registrar o `id` da entidade conflitante e a mensagem de erro.

### 3.2. Após Push e Durante Pull de Alterações

1.  **Recebimento de Alterações (Pull):** O cliente periodicamente (ou após um push falho) realiza um pull para receber as `StoryUpdate`s que ocorreram no servidor desde a última sincronização. Como o pull "passa apenas as alterações que ocorreram", o cliente aplica essas operações à sua base de dados local, garantindo que sua visão dos dados seja eventualmente consistente com a do servidor.
2.  **Identificação de Conflitos Locais:** O cliente mantém um registro das suas próprias `StoryUpdate`s que foram rejeitadas pelo servidor.

### 3.3. Reconciliação e Reaplicação Inteligente (O Coração da Resolução)

Esta é a etapa crucial para a experiência do usuário:

1.  **Notificação ao Usuário:** Para cada `Scene` ou `Choice` que teve sua atualização rejeitada:
    *   **Alerta:** O cliente deve notificar o usuário de forma clara (ex: um banner, um ícone de conflito, uma mensagem toast) que "Suas alterações para [Nome da Cena/Escolha] não puderam ser salvas diretamente porque foram modificadas por outra pessoa."
    *   **Visibilidade do Estado Atual:** A UI deve exibir o estado *atual* (o que veio do servidor) da entidade afetada.

2.  **Armazenamento da Intenção do Usuário:** Para permitir a reaplicação inteligente, o cliente deve armazenar a *intenção* original do usuário, não apenas os valores absolutos.
    *   **Exemplo de Intenção para Reordenação de Cenas:** Em vez de "Cena X tem `index = 5`", armazenar "Cena X deve estar imediatamente antes da Cena Y" ou "Cena Z deve ser a primeira no Capítulo".

3.  **Reapreciação da Intenção:** Quando o usuário decide resolver um conflito ou o cliente tenta resolver automaticamente:
    *   O cliente reavalia a *intenção* original do usuário contra o *novo estado local* da entidade (que já incorporou as alterações do servidor via pull).
    *   **Exemplo:** Se a intenção era "Cena A antes da Cena B", e a Cena B foi movida por outro usuário, o cliente encontra a nova posição da Cena B e calcula a nova posição para a Cena A.
    *   **Geração de Novas `StoryUpdate`s:** Novas operações `UPDATE` são geradas com os `index` (ou outros campos) recalculados e as *novas `version`s* das entidades (obtidas via pull).

4.  **Novo Push:** As novas operações `UPDATE` são enviadas ao servidor. Como elas agora se baseiam na `version` mais recente, elas devem ser aceitas, resolvendo o conflito.

## 4. Considerações de UI/UX

*   **Feedback Visual:** Elementos visuais claros para indicar que uma entidade está em estado de conflito ou foi recentemente alterada por outro usuário.
*   **Opções de Resolução:** Dar ao usuário opções como "Aceitar Alterações do Servidor" (descartar suas próprias alterações) ou "Manter Minhas Alterações" (tentar reaplicar sua intenção).
*   **Rollback/Undo:** A capacidade de desfazer as próprias alterações locais pode ser útil antes de tentar uma reaplicação.

Ao implementar esta estratégia no lado do cliente, será possível oferecer uma experiência colaborativa robusta e previsível, mesmo com um modelo de sincronização LWW no servidor.