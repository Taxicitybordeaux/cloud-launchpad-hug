ALTER TABLE public.client_accounts
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS tva_intracom text,
  ADD COLUMN IF NOT EXISTS billing_address text;

COMMENT ON COLUMN public.client_accounts.company_name IS 'Raison sociale optionnelle pour les factures pro';
COMMENT ON COLUMN public.client_accounts.siret IS 'Numéro SIRET (FR) pour factures entreprise';
COMMENT ON COLUMN public.client_accounts.tva_intracom IS 'Numéro de TVA intracommunautaire';
COMMENT ON COLUMN public.client_accounts.billing_address IS 'Adresse de facturation complète';