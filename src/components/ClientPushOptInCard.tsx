import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useT } from "@/i18n/I18nProvider";

/**
 * Card shown on the client dashboard so VIP clients can opt into push
 * notifications (J-1 reminder + "driver on the way" ETA alerts).
 */
type ClientPushOptInCardProps = {
  clientAccountId?: string | null;
};

export function ClientPushOptInCard({ clientAccountId }: ClientPushOptInCardProps) {
  const t = useT();
  const { status, subscribe } = usePushNotifications({ clientAccountId });
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const ok = await subscribe("client", null, clientAccountId ?? null);
      if (ok) toast.success(t("client.push.toast_ok"));
      else toast.error(t("client.push.toast_fail"));
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

          {isUnsupported ? (
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
