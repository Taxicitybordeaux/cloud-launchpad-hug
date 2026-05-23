import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { requestAndSaveFCMToken } from "@/lib/firebase";

type Props = {
  audience: "admin" | "chauffeur" | "client";
  reservationId?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

async function getVapidKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    const data = await res.json();
    return data.key ?? null;
  } catch {
    return null;
  }
}

async function apiSubscribe(payload: {
  audience: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reservation_id?: string | null;
  user_agent?: string;
}): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("subscribe_failed");
}

async function apiUnsubscribe(endpoint: string): Promise<void> {
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}

export function EnablePushButton({
  audience,
  reservationId,
  variant = "outline",
  size = "sm",
  className,
  label,
}: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch (_) {}
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permission refusée", {
          description: "Activez les notifications dans les réglages du navigateur.",
        });
        return;
      }

      let reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const key = await getVapidKey();
      if (!key) {
        toast.error("Clé VAPID manquante");
        return;
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };

      await apiSubscribe({
        audience,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        reservation_id: reservationId ?? null,
        user_agent: navigator.userAgent.slice(0, 500),
      });

      // En parallèle : enregistrer aussi le token Firebase Cloud Messaging
      // (les deux canaux coexistent, FCM nécessite une clé service-account côté serveur pour envoyer)
      requestAndSaveFCMToken(audience).catch((err) => console.warn("[FCM] register failed", err));

      setSubscribed(true);
      toast.success("Notifications activées 🔔");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur", { description: e?.message ?? "Impossible d'activer les notifications." });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiUnsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications désactivées");
    } catch (e: any) {
      toast.error("Erreur", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  if (supported === null) return null;
  if (!supported) {
    return (
      <Button variant="ghost" size={size} disabled className={className}>
        <BellOff className="h-4 w-4 mr-2" />
        Push non supporté
      </Button>
    );
  }

  return (
    <Button
      variant={subscribed ? "secondary" : variant}
      size={size}
      onClick={subscribed ? disable : enable}
      disabled={busy}
      className={className}
    >
      {subscribed ? <BellRing className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
      {label ?? (subscribed ? "Notifications activées" : "Activer les notifications")}
    </Button>
  );
}
