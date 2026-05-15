import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Taxi City Bordeaux" },
      {
        name: "description",
        content:
          "Politique de confidentialité Taxi City Bordeaux : données collectées, finalités, durée de conservation et droits RGPD.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: ConfidentialitePage,
});

function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">RGPD</p>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour&nbsp;: {new Date().toLocaleDateString("fr-FR")}
      </p>

      <section className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed sm:text-base">
        <div>
          <h2 className="font-display text-xl font-semibold">Responsable du traitement</h2>
          <p className="mt-2 text-muted-foreground">
            <strong>Taxi City Bordeaux</strong> — Bordeaux, Gironde (33), France.<br />
            Contact&nbsp;: <a href="mailto:taxi.city033@gmail.com" className="text-primary hover:underline">taxi.city033@gmail.com</a> ·{" "}
            <a href="tel:0673072322" className="text-primary hover:underline">06 73 07 23 22</a>
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Données collectées</h2>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            <li><strong>Réservation</strong>&nbsp;: nom, prénom, téléphone, email, adresses de départ et d'arrivée, date et heure.</li>
            <li><strong>Contact</strong>&nbsp;: nom, email, téléphone (facultatif), message.</li>
            <li><strong>Suivi GPS</strong>&nbsp;: position du véhicule en temps réel pendant la course (visible uniquement par le client concerné).</li>
            <li><strong>Mesure d'audience</strong>&nbsp;: visites anonymes (identifiant de session local, pas de cookies tiers).</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Finalités</h2>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            <li>Traiter votre demande de réservation et vous contacter.</li>
            <li>Assurer le suivi du véhicule en temps réel pendant votre trajet.</li>
            <li>Améliorer la qualité du service (statistiques agrégées).</li>
            <li>Respecter nos obligations légales (facturation, comptabilité).</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Base légale</h2>
          <p className="mt-2 text-muted-foreground">
            Exécution du contrat de transport (article 6.1.b RGPD), consentement pour le suivi GPS et la mesure
            d'audience, et obligation légale pour la conservation comptable.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Durée de conservation</h2>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            <li>Réservations actives&nbsp;: 12 mois.</li>
            <li>Données comptables&nbsp;: 10 ans (obligation légale).</li>
            <li>Position GPS&nbsp;: supprimée à la fin de la course.</li>
            <li>Messages de contact&nbsp;: 24 mois.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Destinataires</h2>
          <p className="mt-2 text-muted-foreground">
            Vos données ne sont jamais revendues. Elles sont accessibles uniquement à l'exploitant de Taxi City Bordeaux
            et à nos prestataires techniques (hébergeur, base de données) liés par contrat de sous-traitance conforme RGPD.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Vos droits</h2>
          <p className="mt-2 text-muted-foreground">Vous disposez des droits suivants&nbsp;:</p>
          <ul className="mt-2 list-disc pl-5 text-muted-foreground">
            <li>Droit d'accès, de rectification et d'effacement de vos données.</li>
            <li>Droit d'opposition et de limitation du traitement.</li>
            <li>Droit à la portabilité.</li>
            <li>Droit d'introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noreferrer" className="text-primary hover:underline">CNIL</a>.</li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            Pour exercer vos droits&nbsp;:{" "}
            <a href="mailto:taxi.city033@gmail.com" className="text-primary hover:underline">taxi.city033@gmail.com</a>.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Cookies</h2>
          <p className="mt-2 text-muted-foreground">
            Le site n'utilise <strong>aucun cookie publicitaire ni traceur tiers</strong>. Seul un identifiant de session
            anonyme est stocké localement dans votre navigateur pour les statistiques agrégées de fréquentation.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Pour toute question, contactez-nous via la page{" "}
            <Link to="/contact" className="text-primary hover:underline">Contact</Link> ou par email.
          </p>
        </div>
      </section>
    </div>
  );
}
