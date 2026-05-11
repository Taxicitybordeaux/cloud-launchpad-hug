// Re-export du client Supabase Lovable Cloud déjà configuré.
// Permet d'importer `supabase` depuis "@/lib/supabase" comme dans les
// prompts d'intégration tracking, sans dupliquer la config.
export { supabase } from "@/integrations/supabase/client";
