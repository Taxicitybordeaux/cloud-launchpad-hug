import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.jpeg";

export function ClientAuthHeader({ backLabel = "Retour à l'accueil" }: { backLabel?: string }) {
  return (
    <>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/60 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>

      <Link to="/">
        <img
          src={logo}
          alt="Taxi City Bordeaux"
          className="mb-6 h-16 w-16 rounded-xl object-contain shadow-2xl"
        />
      </Link>
    </>
  );
}
