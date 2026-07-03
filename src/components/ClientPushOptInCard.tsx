import { Bell, BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useT } from "@/i18n/I18nProvider";

type ClientPushOptInCardProps = {
  clientAccountId?: string | null;
};

function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIPad = /iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  return /iPhone|iPod/.test(ua) || isIPad;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function ClientPushOptInCard({ clientAccountId }: ClientPushOptInCardProps) {
  const t = useT();
  const { status, subscribe } = usePushNotifications({ clientAccountId });
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    setIos(detectIOS());
    setStandalone(isStandalone());
  }, []);

  const iosNeedsInstall = ios && !standalone;

  async function enable() {
    if (iosNeedsInstall) {
      toast.error("Sur iPhone, installez d'abord l'app : Safari → Partager → Sur l'écran d'accueil, puis rouvrez depuis l'icône.");
      return;
    }
    setBusy(true);
    try {
      // Le hook usePushNotifications s'occupe déjà de : demander la permission,
      // récupérer le token FCM (avec rotation), puis appeler subscribePush côté
      // serveur. Inutile de refaire tout ça en direct — ça produisait deux
      // inscriptions back-to-back pour la même cible.
      const ok = await subscribe("client", null, clientAccountId ?? null);
      if (ok) {
        toast.success(t("client.push.toast_ok"));
      } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        toast.error("Notifications refusées dans les réglages du navigateur.");
      } else {
        toast.error("Token FCM introuvable — vérifiez que l'app est installée sur l'écran d'accueil (iOS)");
      }
    } catch (e: any) {
      console.error("[push client] fatal", e);
      toast.error(`Erreur : ${e?.message || "inconnue"}`);
    } finally {
      setBusy(false);
    }
  }



  const isGranted = status === "granted";
  const isDenied = status === "denied";
  const isUnsupported = status === "unsupported";

  let icon = <Bell className="h-5 w-5 text-[#E8C96D]" />;
  if (isGranted) icon = <BellRing className="h-5 w-5 text-[#E8C96D]" />;
  if (isDenied || isUnsupported) icon = <BellOff className="h-5 w-5 text-white/40" />;

  return (
    <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(201,168,76,0.12)" }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">{t("client.push.enable_title")}</div>
          <div className="mt-0.5 text-xs text-white/60">{t("client.push.enable_desc")}</div>

          {iosNeedsInstall ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-100">
              <Smartphone className="h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Installation requise sur iPhone</div>
                <div className="mt-0.5 opacity-80">
                  Ouvrez ce site dans <b>Safari</b> → touchez <b>Partager</b> → <b>Sur l'écran d'accueil</b>.
                  Ensuite ouvrez l'app depuis l'icône pour activer les notifications.
                </div>
              </div>
            </div>
          ) : isUnsupported ? (
            <div className="mt-2 text-xs text-white/40">{t("client.push.unsupported")}</div>
          ) : isDenied ? (
            <div className="mt-2 text-xs text-red-300/80">{t("client.push.denied")}</div>
          ) : (
            <>
              {isGranted && (
                <div
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}
                >
                  <BellRing className="h-3 w-3" /> {t("client.push.enabled")}
                </div>
              )}
            <button
              type="button"
              onClick={enable}
              disabled={busy || status === "loading"}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-black transition active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #C9A84C 0%, #E8C96D 100%)" }}
            >
              {busy || status === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("client.push.activating")}
                </>
              ) : (
                <>
                  <Bell className="h-3.5 w-3.5" /> {isGranted ? "Réparer / réinscrire cet appareil" : t("client.push.enable_btn")}
                </>
              )}
            </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
