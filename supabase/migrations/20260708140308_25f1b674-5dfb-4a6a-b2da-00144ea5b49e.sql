
CREATE OR REPLACE FUNCTION public.sync_reviews_to_avis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.avis WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.avis (id, author_name, note, commentaire, status, created_at)
  VALUES (
    NEW.id,
    NEW.name,
    NEW.rating,
    NEW.text,
    CASE WHEN NEW.approved THEN 'approved' ELSE 'pending' END,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE
    SET author_name = EXCLUDED.author_name,
        note        = EXCLUDED.note,
        commentaire = EXCLUDED.commentaire,
        status      = EXCLUDED.status,
        created_at  = EXCLUDED.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reviews_to_avis_ins ON public.reviews;
DROP TRIGGER IF EXISTS trg_sync_reviews_to_avis_upd ON public.reviews;
DROP TRIGGER IF EXISTS trg_sync_reviews_to_avis_del ON public.reviews;

CREATE TRIGGER trg_sync_reviews_to_avis_ins
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_reviews_to_avis();

CREATE TRIGGER trg_sync_reviews_to_avis_upd
AFTER UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_reviews_to_avis();

CREATE TRIGGER trg_sync_reviews_to_avis_del
AFTER DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_reviews_to_avis();

-- Backfill : recopie toute ligne de reviews absente dans avis
INSERT INTO public.avis (id, author_name, note, commentaire, status, created_at)
SELECT r.id, r.name, r.rating, r.text,
       CASE WHEN r.approved THEN 'approved' ELSE 'pending' END,
       r.created_at
FROM public.reviews r
ON CONFLICT (id) DO NOTHING;
