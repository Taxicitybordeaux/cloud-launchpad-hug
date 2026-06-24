# Plan — Fusion chat José + factures fiscales

## 1. Fusion du chat côté José (vue unifiée par client)

**Principe** : les deux tables (`reservation_messages` côté course + `direct_messages` côté espace client) restent en base. C'est l'UI de José qui agrège en **un seul thread par client**.

**Onglet Chat driver — refonte**
- Liste des threads : regroupés par client (priorité `client_account_id`, fallback `client_phone` 9 derniers chiffres).
- Chaque thread affiche : avatar/nom, dernier message (toutes sources confondues), badge "💬 Direct" ou "🚖 Course #ABCD" selon la source, compteur non-lus combiné.
- Tri par dernier message reçu.

**Conversation fusionnée**
- Chargement parallèle des deux tables filtrées sur le client.
- Fusion → tri chronologique unique, avec un petit chip discret au-dessus de chaque bulle indiquant le contexte (Direct / Course #ABCD).
- Marquage lu : pour les 2 tables en une fois.

**Réponse intelligente de José**
- Sélecteur en haut de la zone de saisie : "Répondre dans → Chat direct" ou "Course en cours (#ABCD)".
- Défaut auto : si le dernier message entrant vient d'une course active → répond dans cette course ; sinon → direct.
- Le client voit donc la réponse au bon endroit (sur `/suivi/$id` OU `/client/chat`).

**Réalisation**
- Refonte `ChatTab` et `DriverChatConversation` dans `src/routes/driver.tsx`.
- Pas de migration SQL — uniquement de la logique UI/lecture.
- Realtime sur les 2 channels (`direct_messages` + `reservation_messages`).

## 2. Documents fiscaux pour entreprises

**Nouvelle page `/client/factures`** (5ᵉ onglet "Factures" ou sous-section du profil)
- Liste des courses **terminées** groupées par mois.
- Boutons :
  - **PDF du mois** — toutes les courses du mois sélectionné, total HT/TTC, TVA 10 %, numéro de facture séquentiel.
  - **PDF de l'année** — récap annuel pour bilan/notes de frais.
  - **Envoi par email** — bouton "Recevoir par email" qui utilise la file `transactional_emails` existante.
- En-tête : raison sociale optionnelle (nouveau champ `company_name` + `siret` + `tva_intracom` dans `client_accounts`).

**Tech**
- Réutilise `src/lib/client-receipt.ts` (jsPDF déjà installé) → on ajoute `generateMonthlyInvoicePDF()` et `generateYearlyInvoicePDF()`.
- Migration : ajoute 3 colonnes nullables à `client_accounts` (`company_name`, `siret`, `tva_intracom`) + section "Infos entreprise" dans `/client/profil`.

## 3. Ce qu'on peut encore ajouter (roadmap — à arbitrer après)

Idées triées par valeur/effort, à valider plus tard :

**Quick wins (1 itération chacun)**
- **Estimateur de prix sans engagement** : mini-formulaire départ/arrivée → prix instantané, pas besoin d'être logué.
- **QR de réservation rapide** : QR code unique par client à coller dans son agenda → ouvre `/reserver` pré-rempli.
- **Wallet Apple/Google Pay** : ajout du billet de course (date, ETA, chauffeur) au portefeuille.
- **Musique préférée** : champ texte "votre playlist Spotify/style" envoyé à José avec la course.
- **Cadeau anniversaire** : course offerte (ou -20 %) le mois d'anniversaire, alerte automatique.

**Plus stratégique**
- **Mode Entreprise multi-collaborateurs** : 1 compte société → plusieurs voyageurs autorisés, facturation centralisée.
- **PWA installable + mode hors-ligne** : icône sur l'écran d'accueil, courses récentes accessibles sans réseau.
- **Parrainage** : code unique, X € pour parrain + filleul à la 1ʳᵉ course.
- **Programme VIP** : paliers Silver/Gold/Platinum avec avantages (priorité, eau, surclassement).
- **Notifications push intelligentes** : J-1, chauffeur en route avec ETA temps réel, demande d'avis post-course.

## Détails techniques (pour info)

- Pas de touche à `reservation_messages` / `direct_messages` au niveau schéma.
- `ChatTab` réécrit en agrégateur dual-source avec `Map<clientKey, Thread>`.
- Realtime : 2 channels Supabase combinés dans un seul effet.
- PDF factures : jsPDF + jspdf-autotable (déjà présents), numérotation `TC-YYYY-MM-NNN` séquentielle par client.
- Aucun secret nouveau, pas de cron supplémentaire.

## Ce qui sera livré dans cette itération

1. ✅ Fusion chat côté José (point 1 en entier)
2. ✅ Factures fiscales mensuelles + annuelles (point 2 en entier)
3. ❌ Roadmap (point 3) — proposé pour discussion, pas codé
