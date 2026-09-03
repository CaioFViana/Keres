ALTER TABLE `scenes` ADD `calendar_date_override` text;--> statement-breakpoint
ALTER TABLE `scenes` ADD `calendar_date_override_calendar_id` text REFERENCES story_calendars(id);