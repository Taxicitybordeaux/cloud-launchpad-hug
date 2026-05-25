ALTER TABLE public.push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN auth DROP NOT NULL;
-- Cleanup ancient web-push subscriptions (we are migrating to FCM)
DELETE FROM public.push_subscriptions WHERE fcm_token IS NULL;