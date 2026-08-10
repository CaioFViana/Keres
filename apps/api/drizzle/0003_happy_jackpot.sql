CREATE TABLE "media_storage_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"storage_identity" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
