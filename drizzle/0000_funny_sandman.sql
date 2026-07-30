CREATE TABLE `purchase_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`offer_id` text NOT NULL,
	`source` text NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_intents_email_offer_idx` ON `purchase_intents` (`email`,`offer_id`);