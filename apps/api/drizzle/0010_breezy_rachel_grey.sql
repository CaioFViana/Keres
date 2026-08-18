CREATE INDEX "operation_log_created_at_idx" ON "operation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "operation_log_user_id_idx" ON "operation_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "operation_log_entity_type_idx" ON "operation_log" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "operation_log_operation_type_idx" ON "operation_log" USING btree ("operation_type");