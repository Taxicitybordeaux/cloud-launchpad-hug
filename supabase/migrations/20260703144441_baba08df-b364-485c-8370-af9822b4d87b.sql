
-- 1) Remove open UPDATE on active_visitors. The client uses delete+insert, so
--    no legitimate UPDATE is needed. Removing the policy prevents any session
--    from overwriting another session's row.
DROP POLICY IF EXISTS "active_visitors_public_update_bounded" ON public.active_visitors;

-- 2) Restrict anonymous reservation inserts: forbid setting client_account_id
--    (would let a user link a reservation to someone else's client account).
DROP POLICY IF EXISTS "Public can create reservation" ON public.reservations;
CREATE POLICY "Public can create reservation"
ON public.reservations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  client_account_id IS NULL
  AND char_length(nom) BETWEEN 1 AND 200
  AND char_length(telephone) BETWEEN 5 AND 30
  AND char_length(depart) BETWEEN 1 AND 500
  AND char_length(arrivee) BETWEEN 1 AND 500
  AND passagers BETWEEN 1 AND 12
  AND (bagages IS NULL OR (bagages BETWEEN 0 AND 20))
  AND (email IS NULL OR char_length(email) <= 320)
  AND (message IS NULL OR char_length(message) <= 2000)
);
