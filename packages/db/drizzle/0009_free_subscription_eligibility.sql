ALTER TABLE "product_subscriptions" ADD COLUMN IF NOT EXISTS "free_eligible" boolean NOT NULL DEFAULT true;
