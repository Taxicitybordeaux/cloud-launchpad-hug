ALTER TABLE public.email_send_log ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_idem_unique
  ON public.email_send_log (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status <> 'failed';