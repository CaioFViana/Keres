CREATE TABLE "attempt_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attempt_limits_window_idx" ON "attempt_limits" USING btree ("window_start");