Plano: Permita exclusão de história.
Algumas coisas tem de ser processadas em certas ordems, enquanto em alguns casos, nem permita exclusão.

Temos muitas tabelas, muitas mesmo. algumas não faz diferença se for excluidos.

# Provavelmente Só colocar cascade:
Character_relations se excluido não afeta ninguém.
Character quando excluido, cascade em character_relations e Character character_moments
Tag Ao ser excluida, exclua cascade em todas as tabelas de relação que ela aparece como tagCharacter por exemplo.
Suggestion depende. Se a história for excluida, exclua todas as que a história aparece. se User for excluido, exclua todos que o user estiver.
World_Rules pode só colcoar cascate.
Notes pode colocar cascate.
Gallery pode por cascate (note id e story id ambos se excluidos, exclua este.)

# Não permita exclusão em certas condições.
Locations só pode ser excluido se for exclusão da história em si E não tenha nenhuma cena/momento o referenciando. (ou seja, deixa como está e mude o caso de uso de deletestory?)
Chapters só pode ser excluido se não houver mais scenes nele.

Momentos podem sempre ser excluidos. Cascade nele. PORÉM, caso seja por causa de Locations, apenas o torne null. não sei se há um nome diferente de cascade para isso. me informe se souber. Caso seja por causa de scenes, pode excluir.
Scenes só podem ser excluidos se não houver momentos dentro dele. NO ENTANTO, tem o problema de choices. Leia o arquivo choice_mechanics na pasta docs + casos de uso relevantes sobre isso para entender como deveria funcionar. Caso uma cena seja excluida, choices desta podem ser excluidos. porém, verifique a próxima linha.
SIMILARMENTE, caso um choice seja excluido, tem toda a lógica dele de linear vs branching + muita lógica. não sei como seria feito idealmente. Caso seja linear, acerte? Caso seja branching, nada acontece? não sei.