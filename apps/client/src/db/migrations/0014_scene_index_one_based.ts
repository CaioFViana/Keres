import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  -- Índice de cena passa a ser 1..N dentro do capítulo, como o de capítulo já era.
-- Capítulos cujas cenas começavam em 0 sobem todas em um, preservando a ordem atual.
-- Buracos deixados por exclusões antigas continuam existindo de propósito: fechá-los é
-- trabalho da correção da Análise da História, que também empurra a nova ordem ao servidor.
UPDATE "scenes"
SET "index" = "index" + 1
WHERE "chapter_id" IN (
  SELECT "chapter_id" FROM "scenes" WHERE "index" = 0 AND "is_deleted" = 0
);

`);
}
