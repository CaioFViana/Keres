# Elaboração do fluxo de telas para Keres.

Telas no react native funcionam via stack, então vamos ter isso em mente.

## Stack 1 - Cold Install

 - Tela de bem vindo/obrigado por instalar.
   - Terá campo para informar nome de usuário.
   - Por trás dos panos o sistema irá iniciar o banco de dados populando as tabelas necessárias.
   - Feito isso, o sistema irá pra tela normal agora.

## Stack 2 - Story selection.
 - Principal tela quando não há Cold install.
 - Apresenta todas as histórias criadas pelo usuário e a qual servidor a história está linkada.
 - Alguns Crud de história estão aqui. 
   - Criação permitirá alterar todos os campos. Edição não permitirá alterar algumas coisas.
   - Terá campo para seleção do sistema de cores (tema). Tema escuro/claro e cores primarias/secundárias. Um select de opções pré-feitas.
   - Sobre a qual servidor sincroniza a história (não permite alterar depois de criado.)
   - Permissões sobre que usuários atribuir permissões. (inserir ID ou usar o servidor para pesquisar alguém?)
 - Crud de servidor está aqui também. Cadastrar um servidor remoto Keres com seu login/senha ou API key.

## Stack 3 - Main System.
 - Sistema propriamente dito.
 - Barra lateral unificada. 
   - Barra lateral dará facil acesso a todos os atributos do sistema.
   - barra lateral terá "<nome história>(demonstrativo. não fará nada.), Início (dashboard), Personagens, Locais, Capitulos, Cenas, Etiquetas, Regras do mundo, notas, Galeria, relações entre personagens (character_relations), Opções (para crud da história, servidor, etc...), voltar (para lista de histórias)"

 - Dashboard do sistema.
   - Titulo da história e seus atributos + qual servidor sincronizavel.
   - Terá informações sobre quantidade de personagens, ultimas 10 alterações na tela, quantidades de choices (se história for branching apenas), quantidade de locations, cenários... etc. Todos aplicáveis.
   - Dashboard só serve para isso mesmo. é incentivado a usarem a barra lateral para navegação.

### Stack 4 em diante.
 - Todos pertencem como subtelas ao stack 3.
 - Subtela 1 - Listagem.
    - Listagem via cards? Talvez uma listagem similar a de uma lista de contatos seja melhor, com uma foto na lateral tirada de gallery caso exista ou simbolo genérico caso não tenha.
      - Nota: Dependendo do tipo de dado da lista, compensa o espaço para descrição ser várias linhas e não uma só.
    - Ao clicar, abrir uma tela dedicada de perfil. Só abrir a tela com parâmetro tipo de dado/id que a função irá abrir a tela correspondente corretamente.
      - Estas telas terão um botão com lápis para subtela de edição. (crud)
    - Aplicavel a: Characters, Chapters, locations, world_rules, notes, tags, scenes, 
  - Subtela 2 - Listagem, mas com outro foco. Uma listagem mais similar a cards, para cliques diversos e aleatórios. (Talvez um botão para alternar entre um tipo e outro e usar o mesmo sempre...?)
    - Usado pela galeria. Seria para mostrar as diversas imagens com suas legendas.
  - Subtela 3 - Settings. Configurações de história e talvez suggestions.
  - Subtela 4 - Importação exportação. Usuário pode importar/exportar via json. tela dedicada por ser diferente das outras.
  - Subtela 5 - Character Relations.
    - Para listagem de relações entre personagens de forma mais simples. talvez como uma tabela/search? A decidir. 
  - Subtela 6 - Choices.
    - Choices é complicado. Poderia ser listados como uma tabela de cena/nome choice/proxima cena, mas aqui é onde precisarei de gerar um GRAFO.
