-- O SQLite recusa `ALTER TABLE ... ADD COLUMN ... NOT NULL` sem valor padrão mesmo com a
-- tabela vazia, então a forma gerada por padrão (uma sequência de ADD COLUMN) não roda
-- aqui. Como a migration anterior já removeu `image_path` - o único ponteiro que uma linha
-- antiga tinha para o seu arquivo -, não há conteúdo a preservar: a tabela é recriada com
-- o formato novo.
DROP TABLE IF EXISTS `galleries`;--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`media_type` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_name` text NOT NULL,
	`hash` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`title` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer,
	`local_path` text,
	`upload_state` text DEFAULT 'pending' NOT NULL,
	`download_state` text DEFAULT 'downloaded' NOT NULL
);
