# Plano: reordenação de atributos customizados

1. [x] Conferir o fluxo existente de reordenação de capítulos e os serviços/sincronizadores de `StorySchemaField`.
2. [x] Criar um modal de reordenação para os atributos da aba selecionada, usando controles de mover para cima/baixo e ordem sequencial iniciando em 0, consistente com a criação dos atributos.
3. [x] Adicionar ao serviço uma operação única de reordenação, ancorada na story e sincronizada em lote com o servidor.
4. [x] Integrar o modal à tela de esquema, disponível apenas para quem pode editar, e manter a ordem restrita ao tipo de entidade atualmente selecionado.
5. [x] Cobrir o serviço e validar tipagem/testes do client.
