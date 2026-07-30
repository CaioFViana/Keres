-- A galeria passa de "uma imagem tem um dono" para "uma mídia tem N donos", e o arquivo
-- deixa de ser identificado por caminho (`image_path`) e passa a ser identificado pelo
-- conteúdo (`hash`). Uma linha antiga perde aqui o seu único ponteiro para o arquivo, e não
-- teria como preencher as colunas obrigatórias que a migration seguinte adiciona - a
-- limpeza é explícita em vez de deixar a próxima migration falhar no meio.
DELETE FROM "galleries";--> statement-breakpoint
ALTER TABLE "galleries" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "galleries" DROP COLUMN "owner_type";--> statement-breakpoint
ALTER TABLE "galleries" DROP COLUMN "image_path";