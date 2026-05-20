# Notifications Push Web

## 1. Base de données

Nouvelle table `push_subscriptions` :
- `audience` : `'admin' | 'chauffeur' | 'client'`
- `endpoint` (unique), `p256dh`, `auth`
- `user_id` (nullable, pour admin/chauffeur connectés)
- `reservation_id` (nullable, pour clients liés à une course via tracking)
- `user_agent`, `created_at`, `last_seen_at`

RLS :
- Admin : full CRUD via `has_role(auth.uid(),'admin')`
- Insert public autorisé (les visiteurs/clients doivent pouvoir s'abonner sans compte) avec validation côté serveur
- Delete par endpoint propre (désinscription)

## 2. Service worker

Fichier `public/sw.js` :
- `push` event → affiche notification (titre, corps, icône, URL cible)
- `notificationclick` → ouvre/focus l'URL associée (ex: `/admin/courses`, `/chauffeur`, `/suivi/$id`)

## 3. Library

Installation `web-push` côté serveur (compatible Workers via nodejs_compat).

## 4. Server functions / routes

- `subscribe.functions.ts` : enregistre une souscription (audience + reservation_id optionnel)
- `unsubscribe.functions.ts` : supprime par endpoint
- Helper `push.server.ts` : `sendPushTo(audience, payload)` qui itère les souscriptions, envoie via web-push, supprime les 410/404

## 5. Intégration des déclencheurs

- `api/public/notify-reservation.ts` (création) → push **admin**
- Nouvelle update du status (admin/chauffeur action) → push **client** (via souscription liée au `reservation_id`) + push **chauffeur** quand `status='acceptee'` ou course assignée
- Réutiliser les emails existants, ajouter le push en parallèle

## 6. UI

- **Admin** : bouton "Activer les notifications" dans `admin.dashboard.tsx` (header)
- **Chauffeur** : bouton dans `chauffeur.tsx`
- **Client** : prompt automatique sur `/suivi/$id` et `/reservation/$id` ("Recevoir les mises à jour")

Composant partagé `<EnablePushButton audience="..." reservationId="..." />` qui gère :
- Vérification support navigateur
- Permission `Notification.requestPermission()`
- `serviceWorker.register('/sw.js')` + `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })`
- Appel de la server function `subscribe`
- État visuel (activé / désactivé / non supporté / refusé)

La clé publique VAPID est exposée via `import.meta.env.VITE_VAPID_PUBLIC_KEY` (à ajouter au build) **ou** récupérée via une server function GET publique pour éviter une variable d'env supplémentaire — j'utiliserai la **server function** (plus simple, pas de config build).

## Détails techniques

- `web-push` package, payload chiffré côté serveur via `sendNotification(subscription, JSON.stringify({title,body,url}))`
- Sur erreur 410/404 → suppression auto de la souscription expirée
- Service worker en cache `no-store` (déjà géré par TanStack au niveau `public/`)
- iOS Safari ≥16.4 : push fonctionne uniquement si l'app est "Add to Home Screen" — afficher un hint contextuel
- Test : route `/api/admin/test-push` pour envoyer une notif de test à l'admin connecté