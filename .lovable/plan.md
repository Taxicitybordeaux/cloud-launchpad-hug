# Plan d'optimisation chat chauffeur + suivi

## 1. Abonnement Realtime ciblé (max N réservations visibles)

Aujourd'hui le canal `drv-courses` reçoit **tous** les INSERT de `reservation_messages` (toutes réservations confondues). On filtre côté serveur au lieu du client.

- Un seul canal `drv-courses`, mais on (dés)abonne dynamiquement à un filtre `reservation_id=in.(...)` sur la liste des courses actives + celles avec unread.
- Plafond dur : **50 réservations max** dans le filtre. Au-delà, on retombe sur le filtre `sender=eq.client` global (rare).
- Quand la liste change (nouvelle course, statut → completed, unread qui disparaît), on recrée le canal avec le nouveau filtre. Debounce 500 ms pour éviter les reconnexions en rafale.

## 2. Verrou cross-onglets pour le marquage lu

Aujourd'hui deux onglets qui ouvrent la même course peuvent envoyer deux UPDATE en parallèle, faisant remonter puis redescendre le badge.

- Nouveau helper `acquireReadLock(reservationId)` dans `chat-badge-sync.ts` :
  - Écrit `drv-chat-read-lock:{id}` dans `localStorage` avec timestamp + tab-id.
  - Si un autre onglet a posé un lock < 3 s, on skip l'UPDATE (l'autre onglet s'en charge) et on met juste à jour l'UI locale via l'event `storage`.
  - TTL 3 s + release explicite au succès.
- Le compteur global partagé via `BroadcastChannel("drv-chat")` : quand un onglet baisse son unread, il diffuse `{ reservationId, unread_chauffeur: 0 }` — les autres onglets appliquent la baisse **sans** requête serveur.

## 3. RPC batch `mark_reservation_read_by_chauffeur`

Nouvelle fonction SQL `SECURITY DEFINER` :

```
mark_reservation_read_by_chauffeur(p_reservation_id uuid)
→ UPDATE reservation_messages SET read_by_chauffeur=true
  WHERE reservation_id=p_reservation_id
    AND sender='client'
    AND read_by_chauffeur=false
  RETURNING count(*)
```

- Un seul round-trip au lieu de N UPDATE par message.
- Idempotent (le WHERE filtre les déjà lus).
- Appelée par `InlineDriverChat` à l'ouverture + à la fermeture (au lieu de la boucle actuelle).

## 4. Recalcul incrémental du badge

Au lieu de rappeler `getUnreadCountsForReservations` à chaque event Realtime :

- `unreadMap` devient la source de vérité locale.
- Sur INSERT `reservation_messages` (sender=client) → `unreadMap[id].unread_chauffeur += 1` + total badge += 1.
- Sur BroadcastChannel `{reservationId, unread_chauffeur: 0}` → on remplace directement l'entrée.
- Le refetch complet (`getUnreadCountsForReservations`) devient un **filet de sécurité** : appelé seulement au mount + reconcile 5 min + `visibilitychange`, plus à chaque event.

## 5. Case "Bagages" sur la page suivi

Ajouter l'affichage du nombre de bagages dans `src/routes/suivi.$id.tsx`, dans la section infos course (à côté du nombre de passagers). Champ déjà présent en base (`reservations.bagages`), il faut juste l'afficher.

## Fichiers touchés

- `src/routes/driver.tsx` — abonnement filtré, recalcul incrémental
- `src/components/InlineDriverChat.tsx` — appel RPC + lock cross-onglets
- `src/lib/chat-badge-sync.ts` — helper `acquireReadLock` + `BroadcastChannel`
- `src/lib/chat.functions.ts` — nouveau wrapper `markReservationReadByChauffeur`
- **Migration** — fonction SQL `mark_reservation_read_by_chauffeur` + GRANT `authenticated`
- `src/routes/suivi.$id.tsx` — affichage bagages

## Détails techniques

- Le BroadcastChannel est ignoré si l'API n'existe pas (Safari < 15.4) — fallback sur l'event `storage` déjà en place.
- Le RPC est exposé via un `createServerFn` (`.middleware([requireSupabaseAuth])` → RLS respectée sur `reservation_messages`).
- Le filtre Realtime `reservation_id=in.(a,b,c)` accepte jusqu'à ~100 IDs avant que Postgres se plaigne ; on plafonne à 50 pour rester safe.
- Ordre de travail : d'abord la migration SQL (approbation user), puis les changements code dans un second temps.

Confirmes-tu que je pars sur ce plan complet (points 1→5) ?
