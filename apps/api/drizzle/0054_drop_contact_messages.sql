-- The landing page messages move into `messages` (channel 'site'): same text, same address, read stays read.
-- They have no user on either side, so the sender's side is born deleted: the administrators removing one removes the row.
INSERT INTO "messages" ("id", "channel", "subject", "body", "contact_email", "created_at", "sender_deleted_at", "admin_read_at")
SELECT "id", 'site', "subject", "body", "contact_email", "created_at", "created_at", CASE WHEN "is_read" THEN "created_at" ELSE NULL END
FROM "contact_messages";--> statement-breakpoint
DROP TABLE "contact_messages" CASCADE;
