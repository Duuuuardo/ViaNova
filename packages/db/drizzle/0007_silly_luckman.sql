ALTER TABLE "oidc_auth_codes" ADD COLUMN IF NOT EXISTS "code_challenge" text;--> statement-breakpoint
ALTER TABLE "oidc_auth_codes" ADD COLUMN IF NOT EXISTS "code_challenge_method" text;