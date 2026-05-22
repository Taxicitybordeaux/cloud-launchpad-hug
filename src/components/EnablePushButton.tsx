import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getVapidPublicKey, subscribePush, unsubscribePush } from "@/lib/push.functions";

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
  const getKey = useServerFn(getVapidPublicKey);
  const subscribeFn = useServerFn(subscribePush);
  const unsubscribeFn = useServerFn(unsubscribePush);

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

      const { key } = await getKey();
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

      await subscribeFn({
        data: {
          audience,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          reservation_id: reservationId ?? null,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
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
        // Supprime les deux audiences
        await unsubscribeFn({ data: { endpoint: sub.endpoint } });
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
