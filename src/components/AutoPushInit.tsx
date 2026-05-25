/**
 * AutoPushInit.tsx
 *
 * Composant à placer UNE SEULE FOIS dans le layout racine (__root.tsx).
 * Il s'abonne silencieusement aux notifications push dès la visite.
 *
 * Détection de l'audience (par ordre de priorité) :
 *  1. Rôle Supabase → "admin" | "chauffeur" | "client"
 *     (un chauffeur reçoit ses notifs même s'il navigue sur la page d'accueil)
 *  2. Fallback pathname → /admin/* | /chauffeur/*  si pas de session
 *
 * Aucun rendu visible — le composant retourne null.
 * Il ne demande la permission qu'une fois et ne re-subscribe pas si le
 * token est déjà connu pour cette audience dans la session courante.
 */

import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { subscribePush, type PushAudience } from "@/lib/push.functions";
import { getFcmToken } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "fcm_token";
/** Délai avant la demande de permission (ms) — évite d'interrompre le chargement */
const SUBSCRIBE_DELAY_MS = 3000;

/** Vérifie si les push sont supportés dans ce navigateur. */
function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Fallback : déduit l'audience depuis le pathname quand il n'y a pas de session.
 */
function audienceFromPath(pathname: string): PushAudience {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/chauffeur")) return "chauffeur";
  return "client";
}

/**
 * Résout l'audience réelle en combinant la session Supabase et le pathname.
 *
 * Priorité :
 *   - Si l'utilisateur a un rôle enregistré dans profiles (role = "admin" | "chauffeur")
 *     → on utilise ce rôle, quelle que soit la page visitée.
 *   - Sinon, fallback sur le pathname.
 */
async function resolveAudience(pathname: string): Promise<PushAudience> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return audienceFromPath(pathname);

    // Cherche le rôle dans la table user_roles
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    if (error || !roles || roles.length === 0) return audienceFromPath(pathname);

    const roleList = roles.map((r) => r.role as string);
    if (roleList.includes("admin")) return "admin";
    if (roleList.includes("chauffeur")) return "chauffeur";
    return "client";
  } catch {
    // En cas d'erreur réseau, fallback sur le pathname
    return audienceFromPath(pathname);
  }
}

export function AutoPushInit() {
  const location = useLocation();
  const subscribeFn = useServerFn(subscribePush);

  // Audiences déjà souscrites dans cette session (évite les appels réseau répétés)
  const subscribedAudiences = useRef<Set<PushAudience>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPushSupported()) return;

    // Annule un timer précédent (navigation rapide)
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        // Résout l'audience réelle (rôle Supabase ou fallback pathname)
        const audience = await resolveAudience(location.pathname);

        // Ne re-subscribe pas si déjà fait pour cette audience dans cette session
        if (subscribedAudiences.current.has(audience)) return;

        // Récupère (ou demande) le token FCM
        const fcm = await getFcmToken();
        if (!fcm) return; // Permission refusée ou navigateur incompatible

        // Appel serveur pour enregistrer / mettre à jour la souscription
        await subscribeFn({
          data: {
            audience,
            fcm_token: fcm,
            reservation_id: null,
            user_agent: navigator.userAgent.slice(0, 500),
          },
        });

        // Mémorise localement le token (utilisé par EnablePushButton)
        localStorage.setItem(STORAGE_KEY, fcm);

        // Marque l'audience comme souscrite pour cette session
        subscribedAudiences.current.add(audience);

        console.info(`[AutoPushInit] Souscription push OK — audience: ${audience}`);
      } catch (err) {
        // Silencieux : on ne montre rien à l'utilisateur
        console.warn("[AutoPushInit] subscribe silently failed", err);
      }
    }, SUBSCRIBE_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // On re-lance à chaque changement de pathname ET d'état de session éventuel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}
