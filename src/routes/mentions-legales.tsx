import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Taxi City Bordeaux" },
      {
        name: "description",
        content:
          "Mentions légales de Taxi City Bordeaux : éditeur du site, hébergement, propriété intellectuelle et contact.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Informations légales</p>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Mentions légales</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR")}
      </p>

      <section className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed sm:text-base">
        <div>
          <h2 className="font-display text-xl font-semibold">Éditeur du site</h2>
          <p className="mt-2 text-muted-foreground">
            Le site <strong>taxicitybordeaux.fr</strong> est édité par&nbsp;:
          </p>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            <li><strong>Taxi City Bordeaux</strong> — Artisan taxi indépendant</li>
            <li>Adresse&nbsp;: Bordeaux, Gironde (33), France</li>
            <li>Téléphone&nbsp;: <a href="tel:0673072322" className="text-primary hover:underline">06 73 07 23 22</a></li>
            <li>Email&nbsp;: <a href="mailto:taxi.city033@gmail.com" className="text-primary hover:underline">taxi.city033@gmail.com</a></li>
            <li>Numéro ADS / Carte professionnelle&nbsp;: disponible sur demande</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Directeur de la publication</h2>
          <p className="mt-2 text-muted-foreground">Le responsable de la publication est l'exploitant de Taxi City Bordeaux.</p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Hébergement</h2>
          <p className="mt-2 text-muted-foreground">
            Le site est hébergé par <strong>Cloudflare, Inc.</strong> — 101 Townsend Street, San Francisco, CA 94107, USA.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Propriété intellectuelle</h2>
          <p className="mt-2 text-muted-foreground">
            L'ensemble des contenus présents sur ce site (textes, images, logos, graphismes, code source) est protégé
            par le droit d'auteur. Toute reproduction, représentation, modification ou exploitation, totale ou partielle,
            sans autorisation écrite préalable, est interdite.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Responsabilité</h2>
          <p className="mt-2 text-muted-foreground">
            Les informations diffusées (tarifs, disponibilités, estimations) sont indicatives. Le compteur taxi
            homologué fait foi pour la facturation finale conformément à la réglementation en vigueur (arrêté préfectoral
            de la Gironde).
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Pour toute question relative au site ou à nos services, vous pouvez nous joindre via la page{" "}
            <Link to="/contact" className="text-primary hover:underline">Contact</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
