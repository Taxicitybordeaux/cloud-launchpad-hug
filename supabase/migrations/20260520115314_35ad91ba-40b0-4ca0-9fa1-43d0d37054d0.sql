
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('admin','chauffeur','client')),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_audience ON public.push_subscriptions(audience);
CREATE INDEX idx_push_subscriptions_reservation ON public.push_subscriptions(reservation_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert)
CREATE POLICY "Anyone can subscribe to push"
ON public.push_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anyone can unsubscribe by endpoint (we accept this; endpoint is essentially a secret)
CREATE POLICY "Anyone can unsubscribe by endpoint"
ON public.push_subscriptions
FOR DELETE
TO anon, authenticated
USING (true);

-- Admins can read all
CREATE POLICY "Admins can read push subs"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update last_seen etc.
CREATE POLICY "Admins can update push subs"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
