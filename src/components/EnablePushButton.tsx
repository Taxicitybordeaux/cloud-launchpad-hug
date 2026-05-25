import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { getFcmToken } from "@/lib/firebase";
import { subscribePush, unsubscribePush } from "@/lib/push.functions";

type Props = {
  audience: "admin" | "chauffeur" | "client";
  reservationId?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
};

const STORAGE_KEY = "fcm_token";

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

  const subscribeFn = useServerFn(subscribePush);
  const unsubscribeFn = useServerFn(unsubscribePush);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && Notification.permission === "granted") setSubscribed(true);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const fcm = await getFcmToken();
      if (!fcm) {
        toast.error("Permission refusée", {
          description: "Activez les notifications dans les réglages du navigateur.",
        });
        return;
      }
      await subscribeFn({
        data: {
          audience,
          fcm_token: fcm,
          reservation_id: reservationId ?? null,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      localStorage.setItem(STORAGE_KEY, fcm);
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
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        await unsubscribeFn({ data: { fcm_token: stored } });
        localStorage.removeItem(STORAGE_KEY);
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
