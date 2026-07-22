ALTER TABLE "oidc_auth_codes" ADD COLUMN "code_challenge" text;--> statement-breakpoint
ALTER TABLE "oidc_auth_codes" ADD COLUMN "code_challenge_method" text;