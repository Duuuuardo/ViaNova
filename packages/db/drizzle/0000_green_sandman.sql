CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"avatar_url" text,
	"phone" text,
	"email_verified_at" timestamp,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verifications_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "totp_secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text[],
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "totp_secrets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_addon_types" (
	"id" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit_label" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"stripe_price_id" text,
	"limits_per_unit" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_catalog" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"description" text,
	"icon" text,
	"web_url" text NOT NULL,
	"api_url" text NOT NULL,
	"oidc_client_secret_hash" text NOT NULL,
	"redirect_uris" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"tier" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"stripe_price_id" text,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_subscription_id" text NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"status" text NOT NULL,
	"amount_due_cents" integer DEFAULT 0 NOT NULL,
	"amount_paid_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'brl' NOT NULL,
	"hosted_invoice_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "product_subscription_addons" (
	"id" text PRIMARY KEY NOT NULL,
	"product_subscription_id" text NOT NULL,
	"addon_type_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"stripe_subscription_item_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text,
	"organization_id" text,
	"owner_user_id" text,
	"plan_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'none' NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_auth_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"client_slug" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"scope" text DEFAULT 'openid' NOT NULL,
	"nonce" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_auth_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "oidc_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"kid" text NOT NULL,
	"alg" text DEFAULT 'RS256' NOT NULL,
	"private_pem" text NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_keys_kid_unique" UNIQUE("kid")
);
--> statement-breakpoint
CREATE TABLE "service_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"jti" text NOT NULL,
	"product_slug" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_tokens_jti_unique" UNIQUE("jti")
);
--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_secrets" ADD CONSTRAINT "totp_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_addon_types" ADD CONSTRAINT "product_addon_types_product_slug_product_catalog_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."product_catalog"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_plans" ADD CONSTRAINT "product_plans_product_slug_product_catalog_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."product_catalog"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_product_subscription_id_product_subscriptions_id_fk" FOREIGN KEY ("product_subscription_id") REFERENCES "public"."product_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subscription_addons" ADD CONSTRAINT "product_subscription_addons_product_subscription_id_product_subscriptions_id_fk" FOREIGN KEY ("product_subscription_id") REFERENCES "public"."product_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subscription_addons" ADD CONSTRAINT "product_subscription_addons_addon_type_id_product_addon_types_id_fk" FOREIGN KEY ("addon_type_id") REFERENCES "public"."product_addon_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_product_slug_product_catalog_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."product_catalog"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_subscriptions" ADD CONSTRAINT "product_subscriptions_plan_id_product_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."product_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_auth_codes" ADD CONSTRAINT "oidc_auth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_auth_codes" ADD CONSTRAINT "oidc_auth_codes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_auth_codes" ADD CONSTRAINT "oidc_auth_codes_client_slug_product_catalog_slug_fk" FOREIGN KEY ("client_slug") REFERENCES "public"."product_catalog"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_tokens" ADD CONSTRAINT "service_tokens_product_slug_product_catalog_slug_fk" FOREIGN KEY ("product_slug") REFERENCES "public"."product_catalog"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_sub_addons_sub_type_idx" ON "product_subscription_addons" USING btree ("product_subscription_id","addon_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_subs_product_workspace_idx" ON "product_subscriptions" USING btree ("product_slug","workspace_id");