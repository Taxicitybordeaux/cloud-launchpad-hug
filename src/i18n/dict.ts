export const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

type Dict = Record<string, string>;

const fr: Dict = {
  // Common / nav / header
  "nav.home": "Accueil",
  "nav.services": "Services",
  "nav.tarifs": "Tarifs",
  "nav.about": "À propos",
  "nav.contact": "Contact",
  "nav.book": "Réserver",
  "nav.book_long": "Réserver une course",
  "common.available_247": "Disponible 7j/7 — 24h/24",
  "common.lang_label": "Langue",

  // Home — hero
  "home.hero.badge": "Disponible 7j/7 — 24h/24",
  "home.hero.title.before": "Votre taxi à",
  "home.hero.title.city": "Bordeaux",
  "home.hero.title.after": ", ponctuel et confortable.",
  "home.hero.subtitle":
    "Trajets professionnels ou personnels, courses immédiates ou réservées : nous vous emmenons partout en Gironde et en France, de jour comme de nuit, dans un véhicule soigné.",
  "home.hero.need_taxi": "J'ai besoin d'un taxi…",
  "home.hero.book_now": "Réserver une course",
  "home.hero.tag1": "Réservation rapide",
  "home.hero.tag2": "Conventionné CPAM",
  "home.hero.tag3": "Tarifs transparents",

  // Home — destinations
  "home.dest.eyebrow": "Destinations",
  "home.dest.title": "Là où l'on vous emmène",
  "home.dest.intro":
    "Quelques itinéraires que nos clients réservent au quotidien — l'arrivée en douceur, c'est notre métier.",
  "home.dest.gare.title": "Gare Bordeaux Saint-Jean",
  "home.dest.gare.sub": "Accueil quai d'arrivée, aide aux bagages.",
  "home.dest.airport.title": "Aéroport Mérignac",
  "home.dest.airport.sub": "Suivi des vols, attente offerte 15 min.",
  "home.dest.vine.title": "Châteaux & vignobles",
  "home.dest.vine.sub": "Médoc, Saint-Émilion, Sauternes — à la journée.",
  "home.dest.cta": "Réserver",

  // Home — why us
  "home.why.eyebrow": "Pourquoi nous",
  "home.why.title": "Un service simple, humain, fiable.",
  "home.why.desc":
    "Taxi City Bordeaux, c'est un chauffeur de proximité, un véhicule entretenu et l'envie de bien faire. Pas de surprise sur la facture, pas d'attente interminable — on confirme, on arrive, on vous dépose.",
  "home.why.years": "années d'expérience",
  "home.why.f1.t": "Ponctualité garantie",
  "home.why.f1.d": "Suivi de vol et de train, marge anti-retard.",
  "home.why.f2.t": "Tarifs clairs",
  "home.why.f2.d": "Devis sur demande, paiement CB & espèces.",
  "home.why.f3.t": "Conventionné CPAM",
  "home.why.f3.d": "Transports de santé pris en charge.",

  // Home — services
  "home.services.eyebrow": "Nos prestations",
  "home.services.title": "Pour tous vos déplacements",
  "home.services.see_all": "Voir tous les services",
  "svc.airport.title": "Aéroport Mérignac",
  "svc.airport.desc": "Transferts depuis et vers l'aéroport, jour et nuit.",
  "svc.train.title": "Gare Saint-Jean",
  "svc.train.desc": "Prise en charge à l'arrivée, accueil personnalisé.",
  "svc.business.title": "Déplacements business",
  "svc.business.desc": "Discrétion et ponctualité pour vos rendez-vous.",
  "svc.wedding.title": "Mariages & événements",
  "svc.wedding.desc": "Véhicule soigné pour vos plus beaux moments.",
  "svc.cpam.title": "Conventionné CPAM",
  "svc.cpam.desc": "Transports de santé pris en charge.",
  "svc.long.title": "Longues distances",
  "svc.long.desc": "Trajets toutes distances en France sur devis.",

  // Home — testimonials
  "home.test.eyebrow": "Ils nous ont fait confiance",
  "home.test.title": "Ce qu'en disent nos clients",
  "home.test.t1":
    "Chauffeur très ponctuel, voiture impeccable. J'ai été déposée à Mérignac en toute tranquillité, je recommande.",
  "home.test.t2":
    "Réservation simple, prix annoncé respecté. Parfait pour mes déplacements professionnels à la semaine.",
  "home.test.t3":
    "Pris en charge à la gare avec mes enfants, le chauffeur a été d'une grande gentillesse. On rappellera.",

  // Home — FAQ
  "home.faq.eyebrow": "Vos questions",
  "home.faq.title": "On vous répond franchement",
  "home.faq.intro":
    "Quelques réponses aux questions qu'on nous pose le plus souvent. Si vous ne trouvez pas, un coup de fil suffit.",
  "faq.q1": "Êtes-vous conventionné CPAM ?",
  "faq.a1":
    "Oui, nous sommes conventionnés avec la CPAM pour les transports de santé (consultations, dialyses, hospitalisations…). Pensez à demander à votre médecin la prescription médicale de transport, et nous nous occupons du reste — vous n'avancez pas les frais dans la plupart des cas.",
  "faq.q2": "Que se passe-t-il si mon vol a du retard à Mérignac ?",
  "faq.a2":
    "On suit votre vol en temps réel. Si l'avion arrive en avance ou en retard, on ajuste l'heure de prise en charge. La première demi-heure d'attente après l'atterrissage est offerte — on ne facture jamais un retard qui n'est pas le vôtre.",
  "faq.q3": "Comment annuler ou modifier ma réservation ?",
  "faq.a3":
    "Un simple appel ou message WhatsApp suffit. L'annulation est gratuite jusqu'à 2 heures avant la course. Pour une modification (horaire, adresse, nombre de passagers), prévenez-nous dès que possible — on s'arrange.",
  "faq.q4": "Quels moyens de paiement acceptez-vous ?",
  "faq.a4":
    "Carte bancaire (sans contact, Apple Pay, Google Pay), espèces, et virement pour les comptes professionnels. Une facture est remise systématiquement à la fin de la course, sur demande pour vos notes de frais.",
  "faq.q5": "Faut-il réserver à l'avance ?",
  "faq.a5":
    "Pas obligatoire — on prend aussi les courses immédiates si on est disponible. Pour un train tôt le matin, un vol ou un rendez-vous important, mieux vaut réserver la veille pour être tranquille.",
  "faq.q6": "Combien de bagages puis-je emporter ?",
  "faq.a6":
    "Une berline confortable accepte facilement 3 à 4 valises et 4 passagers. Pour un groupe, du matériel encombrant ou un vélo, prévenez-nous à la réservation, on adapte le véhicule.",

  // Home — final CTA
  "home.cta.title": "Prêt à réserver votre course ?",
  "home.cta.desc":
    "Confirmation rapide, chauffeur professionnel et prix transparent — appelez-nous ou réservez en ligne.",
  "home.cta.online": "Réserver en ligne",

  // Services page
  "services.eyebrow": "Nos prestations",
  "services.title": "Un service taxi pour chaque besoin",
  "services.intro":
    "À Bordeaux, en Gironde et partout en France — un seul interlocuteur, un service haut de gamme.",
  "services.cta": "Demander un devis / Réserver",
  "services.b1": "7j/7 – 24h/24",
  "services.b2": "Jusqu'à 4 passagers",
  "services.b3": "Chauffeur professionnel",
  "svcp.airport.title": "Transferts Aéroport Mérignac",
  "svcp.airport.desc":
    "Prise en charge ponctuelle pour vos vols, suivi en temps réel des horaires, accueil avec pancarte sur demande.",
  "svcp.airport.p1": "Suivi des vols",
  "svcp.airport.p2": "Accueil personnalisé",
  "svcp.airport.p3": "Aller-retour possible",
  "svcp.train.title": "Gare Saint-Jean & gares TGV",
  "svcp.train.desc":
    "Transferts depuis ou vers la gare de Bordeaux Saint-Jean et toutes les gares de la région.",
  "svcp.train.p1": "Accueil en gare",
  "svcp.train.p2": "Aide aux bagages",
  "svcp.train.p3": "Disponible 24h/24",
  "svcp.business.title": "Déplacements professionnels",
  "svcp.business.desc":
    "Service discret et premium pour vos rendez-vous, séminaires et déplacements d'affaires.",
  "svcp.business.p1": "Facturation entreprise",
  "svcp.business.p2": "Wifi à bord",
  "svcp.business.p3": "Discrétion garantie",
  "svcp.wedding.title": "Mariages & événements",
  "svcp.wedding.desc":
    "Véhicule soigné pour accompagner vos plus beaux moments avec élégance.",
  "svcp.wedding.p1": "Véhicule décoré sur demande",
  "svcp.wedding.p2": "Tarif forfait",
  "svcp.wedding.p3": "Chauffeur en costume",
  "svcp.cpam.title": "Transport conventionné CPAM",
  "svcp.cpam.desc":
    "Transport assis professionnalisé pris en charge par l'Assurance Maladie.",
  "svcp.cpam.p1": "Tiers payant",
  "svcp.cpam.p2": "Bon de transport accepté",
  "svcp.cpam.p3": "Hôpitaux & cliniques",
  "svcp.long.title": "Longues distances",
  "svcp.long.desc":
    "Trajets toutes distances en France et en Europe, sur devis personnalisé.",
  "svcp.long.p1": "Devis gratuit",
  "svcp.long.p2": "Tarif au kilomètre",
  "svcp.long.p3": "Confort longue durée",

  // Tarifs page
  "tarifs.eyebrow": "Tarifs",
  "tarifs.title": "Des prix transparents",
  "tarifs.intro":
    "Tarifs indicatifs basés sur la réglementation préfectorale. Un devis précis vous est confirmé à la réservation.",
  "tarifs.col.from": "Départ",
  "tarifs.col.to": "Arrivée",
  "tarifs.col.day": "Tarif jour",
  "tarifs.col.night": "Tarif nuit / dim",
  "tarifs.note":
    "Tarifs nuit appliqués de 19h à 7h, dimanches et jours fériés. Forfaits aéroport / gare possibles selon les zones.",
  "tarifs.cpam.title": "🏥 Conventionné CPAM",
  "tarifs.cpam.desc":
    "Sur présentation d'un bon de transport, prise en charge directe par l'Assurance Maladie. Pas d'avance de frais (tiers payant).",
  "tarifs.event.title": "📅 Forfaits événements",
  "tarifs.event.desc":
    "Mariages, séminaires, soirées : tarifs forfaitaires sur devis personnalisé. Contactez-nous.",
  "tarifs.cta": "Demander un devis exact",
  "city.bdx_centre": "Bordeaux centre",
  "city.cenon": "Cenon / Floirac",
  "city.merignac": "Mérignac",
  "city.bdx": "Bordeaux",
  "city.airport": "Aéroport Mérignac",
  "city.gare": "Gare Saint-Jean",
  "city.arcachon": "Arcachon",
  "city.stemilion": "Saint-Émilion",

  // About page
  "about.eyebrow": "Notre histoire",
  "about.title": "À propos de Taxi City Bordeaux",
  "about.p1.brand": "Taxi City Bordeaux",
  "about.p1":
    "est une entreprise de taxi indépendante basée à Cenon, à proximité immédiate de Bordeaux. Nous avons à cœur de proposer un service à la hauteur de l'élégance bordelaise : ponctualité, confort et discrétion.",
  "about.p2":
    "Que vous soyez un particulier qui rejoint l'aéroport, un professionnel en déplacement, ou un patient nécessitant un transport médical conventionné, nous adaptons notre prestation à votre besoin.",
  "about.p3":
    "Notre véhicule récent, climatisé et soigneusement entretenu, vous garantit un trajet agréable, en toutes circonstances.",
  "about.b1.t": "Chauffeur professionnel",
  "about.b1.d":
    "Carte professionnelle de taxi, formation continue, parfaite connaissance de Bordeaux et de la Gironde.",
  "about.b2.t": "Disponible 7j/7",
  "about.b2.d": "De jour comme de nuit, week-ends et jours fériés inclus.",
  "about.b3.t": "Bordeaux & Gironde",
  "about.b3.d":
    "Station officielle à Bordeaux. Toute la métropole, l'aéroport, les gares et toute la France sur réservation.",
  "about.b4.t": "Conventionné CPAM",
  "about.b4.d":
    "Transport assis professionnalisé pris en charge par l'Assurance Maladie.",
  "about.cta": "Réserver une course",

  // Contact page
  "contact.eyebrow": "Contact",
  "contact.title": "Nous contacter",
  "contact.intro":
    "Disponible 7j/7 — un appel suffit, ou envoyez-nous un message.",
  "contact.phone": "Téléphone",
  "contact.phone.sub": "Réponse immédiate",
  "contact.wa.title": "WhatsApp",
  "contact.wa.line": "Discutons sur WhatsApp",
  "contact.wa.sub": "Idéal pour envoyer une adresse",
  "contact.email": "Email",
  "contact.email.sub": "Devis & demandes spéciales",
  "contact.address": "Adresse",
  "contact.address.area": "Interventions dans toute la Gironde.",
  "contact.form.eyebrow": "Formulaire",
  "contact.form.title": "Envoyez-nous un message",
  "contact.form.intro":
    "Pour un devis, une question ou une demande particulière — nous vous répondons dans les plus brefs délais.",
  "contact.form.name": "Nom complet *",
  "contact.form.email": "Email *",
  "contact.form.phone": "Téléphone (facultatif)",
  "contact.form.subject": "Sujet (facultatif)",
  "contact.form.subject.ph": "Ex : Devis trajet Bordeaux → Paris",
  "contact.form.message": "Message *",
  "contact.form.message.ph": "Détaillez votre demande…",
  "contact.form.send": "Envoyer le message",
  "contact.form.sending": "Envoi…",
  "contact.form.error":
    "Une erreur est survenue. Merci de nous appeler directement au 06 73 07 23 22.",
  "contact.form.success.title": "Message envoyé !",
  "contact.form.success.desc":
    "Merci de nous avoir contactés. Nous vous répondons rapidement par email.",
  "contact.form.success.again": "Envoyer un autre message",
  "contact.form.note":
    "Pour une course, utilisez plutôt le formulaire de réservation.",
  "contact.err.name": "Nom requis",
  "contact.err.email": "Email invalide",
  "contact.err.message": "Message trop court (10 caractères min)",
  "contact.err.phone": "Numéro invalide",

  // Reservation page
  "res.eyebrow": "Réservation en ligne",
  "res.title": "Réservez votre taxi",
  "res.intro": "Remplissez le formulaire — nous vous rappelons pour confirmer.",
  "res.f.name": "Nom complet *",
  "res.f.phone": "Téléphone *",
  "res.f.email": "Email (facultatif)",
  "res.f.trip": "Type de trajet *",
  "res.f.trip.one": "Aller simple",
  "res.f.trip.round": "Aller / retour",
  "res.f.pickup": "Date et heure de prise en charge *",
  "res.f.return": "Date et heure de retour *",
  "res.f.from": "Adresse de départ *",
  "res.f.from.ph": "Ex : 12 cours de l'Intendance, Bordeaux",
  "res.f.to": "Adresse d'arrivée *",
  "res.f.to.ph": "Ex : Aéroport Mérignac",
  "res.f.passengers": "Passagers",
  "res.f.luggage": "Bagages",
  "res.f.kind": "Type de course",
  "res.f.kind.standard": "Standard",
  "res.f.kind.airport": "Aéroport",
  "res.f.kind.train": "Gare",
  "res.f.kind.cpam": "Conventionné CPAM",
  "res.f.kind.wedding": "Mariage / événement",
  "res.f.kind.business": "Business",
  "res.f.kind.long": "Longue distance",
  "res.f.needs": "Besoins spécifiques",
  "res.f.needs.cpam": "CPAM / médical",
  "res.f.needs.cpam.hint": "Transport conventionné",
  "res.f.needs.bags": "Assistance bagages",
  "res.f.needs.bags.hint": "Aide à la prise en charge",
  "res.f.needs.child": "Siège enfant",
  "res.f.needs.child.hint": "Préciser l'âge en message",
  "res.f.message": "Message (facultatif)",
  "res.f.message.ph": "Numéro de vol, âge des enfants, précisions…",
  "res.send": "Envoyer ma demande",
  "res.sending": "Envoi…",
  "res.note":
    "Pour une course immédiate, appelez-nous directement au 06 73 07 23 22",
  "res.err.global":
    "Erreur lors de l'envoi. Merci de nous appeler au 06 73 07 23 22.",
  "res.err.phone": "Numéro de téléphone invalide",
  "res.err.name": "Nom requis",
  "res.err.pickup": "Date/heure requise",
  "res.err.future": "La date doit être dans le futur",
  "res.err.from": "Adresse de départ requise",
  "res.err.to": "Adresse d'arrivée requise",
  "res.err.return": "Date de retour postérieure à l'aller",

  // Confirmation page
  "conf.cancelled.title": "Réservation annulée",
  "conf.cancelled.desc": "Cette réservation a bien été annulée.",
  "conf.ok.title": "Demande enregistrée !",
  "conf.ok.desc":
    "Nous vous rappelons rapidement pour confirmer votre course.",
  "conf.ref.label": "N° de réservation",
  "conf.ref.note": "À conserver pour toute modification ou annulation.",
  "conf.summary": "Récapitulatif",
  "conf.row.pickup": "Prise en charge",
  "conf.row.from": "Départ",
  "conf.row.to": "Arrivée",
  "conf.row.phone": "Téléphone",
  "conf.passengers": "passager(s)",
  "conf.luggage": "bagage(s)",
  "conf.wa": "Confirmer sur WhatsApp",
  "conf.modify.title": "Modifier ou annuler",
  "conf.modify.desc":
    "Pour modifier votre demande, contactez-nous par téléphone ou WhatsApp avec votre numéro de réservation.",
  "conf.cancel": "Annuler ma réservation",
  "conf.cancel.confirm": "Confirmer l'annulation",
  "conf.cancel.keep": "Garder ma réservation",
  "conf.back": "← Retour à l'accueil",
  "conf.notfound.title": "Réservation introuvable",
  "conf.notfound.desc":
    "Le lien semble invalide ou la réservation a été supprimée.",
  "conf.notfound.cta": "Faire une nouvelle réservation",

  // WhatsApp float
  "wa.float.send": "Envoyer ma demande",
  "wa.float.label": "WhatsApp",
  "wa.default":
    "Bonjour, je souhaite réserver un taxi avec Taxi City Bordeaux. Pouvez-vous me confirmer la disponibilité ? Merci.",
};

const en: Dict = {
  "nav.home": "Home",
  "nav.services": "Services",
  "nav.tarifs": "Pricing",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.book": "Book",
  "nav.book_long": "Book a ride",
  "common.available_247": "Available 24/7",
  "common.lang_label": "Language",

  "home.hero.badge": "Available 24/7",
  "home.hero.title.before": "Your taxi in",
  "home.hero.title.city": "Bordeaux",
  "home.hero.title.after": ", on time and comfortable.",
  "home.hero.subtitle":
    "Business or personal trips, immediate or scheduled rides: we drive you anywhere in Gironde and across France, day and night, in a well-maintained car.",
  "home.hero.need_taxi": "I need a taxi…",
  "home.hero.book_now": "Book a ride",
  "home.hero.tag1": "Quick booking",
  "home.hero.tag2": "CPAM-certified medical rides",
  "home.hero.tag3": "Transparent pricing",

  "home.dest.eyebrow": "Destinations",
  "home.dest.title": "Where we drive you",
  "home.dest.intro":
    "A few routes our customers book every day — a smooth arrival is what we do best.",
  "home.dest.gare.title": "Bordeaux Saint-Jean station",
  "home.dest.gare.sub": "Platform meet & greet, luggage assistance.",
  "home.dest.airport.title": "Mérignac airport",
  "home.dest.airport.sub": "Flight tracking, 15-min free wait.",
  "home.dest.vine.title": "Châteaux & vineyards",
  "home.dest.vine.sub": "Médoc, Saint-Émilion, Sauternes — full day trips.",
  "home.dest.cta": "Book",

  "home.why.eyebrow": "Why choose us",
  "home.why.title": "A simple, human and reliable service.",
  "home.why.desc":
    "Taxi City Bordeaux means a local driver, a well-kept car and a real care for the job. No surprise on the bill, no endless wait — we confirm, we arrive, we drive you.",
  "home.why.years": "years of experience",
  "home.why.f1.t": "Guaranteed punctuality",
  "home.why.f1.d": "Flight & train tracking, anti-delay buffer.",
  "home.why.f2.t": "Clear pricing",
  "home.why.f2.d": "Quote on request, card & cash payment.",
  "home.why.f3.t": "CPAM-certified medical rides",
  "home.why.f3.d": "Health transports covered.",

  "home.services.eyebrow": "Our services",
  "home.services.title": "For every kind of trip",
  "home.services.see_all": "See all services",
  "svc.airport.title": "Mérignac airport",
  "svc.airport.desc": "Transfers to and from the airport, day & night.",
  "svc.train.title": "Saint-Jean station",
  "svc.train.desc": "Pick-up on arrival, personal greeting.",
  "svc.business.title": "Business travel",
  "svc.business.desc": "Discretion and punctuality for your meetings.",
  "svc.wedding.title": "Weddings & events",
  "svc.wedding.desc": "An elegant car for your special moments.",
  "svc.cpam.title": "CPAM medical transport",
  "svc.cpam.desc": "Health transports covered by the French health system.",
  "svc.long.title": "Long distance",
  "svc.long.desc": "Any-distance trips across France, on quote.",

  "home.test.eyebrow": "They trusted us",
  "home.test.title": "What our clients say",
  "home.test.t1":
    "Very punctual driver, spotless car. Dropped off at Mérignac with no stress, highly recommend.",
  "home.test.t2":
    "Easy booking, exact price as quoted. Perfect for my weekly business trips.",
  "home.test.t3":
    "Picked up at the station with my kids, the driver was so kind. We'll book again.",

  "home.faq.eyebrow": "Your questions",
  "home.faq.title": "Honest answers",
  "home.faq.intro":
    "A few answers to the questions we get most often. If you can't find yours, just give us a call.",
  "faq.q1": "Are you CPAM-certified for medical transport?",
  "faq.a1":
    "Yes, we are certified by the CPAM for health transport (consultations, dialysis, hospital stays…). Just ask your doctor for the medical transport prescription, and we take care of the rest — in most cases you don't pay anything upfront.",
  "faq.q2": "What if my flight at Mérignac is delayed?",
  "faq.a2":
    "We track your flight in real time. If your plane lands early or late, we adjust the pick-up time. The first half hour of waiting after landing is free — we never charge for a delay that isn't yours.",
  "faq.q3": "How can I cancel or change my booking?",
  "faq.a3":
    "A simple call or WhatsApp message is enough. Cancellation is free up to 2 hours before the ride. For a change (time, address, passengers), let us know as soon as possible — we'll arrange it.",
  "faq.q4": "Which payment methods do you accept?",
  "faq.a4":
    "Card (contactless, Apple Pay, Google Pay), cash, and bank transfer for company accounts. A receipt is always provided at the end of the ride, on request for expense reports.",
  "faq.q5": "Do I need to book in advance?",
  "faq.a5":
    "Not mandatory — we also take immediate rides if we're available. For an early train, a flight or an important meeting, it's safer to book the day before.",
  "faq.q6": "How much luggage can I bring?",
  "faq.a6":
    "A comfortable sedan easily fits 3 to 4 suitcases and 4 passengers. For a group, bulky items or a bicycle, let us know when booking and we'll adapt the vehicle.",

  "home.cta.title": "Ready to book your ride?",
  "home.cta.desc":
    "Quick confirmation, professional driver and transparent price — call us or book online.",
  "home.cta.online": "Book online",

  "services.eyebrow": "Our services",
  "services.title": "A taxi service for every need",
  "services.intro":
    "In Bordeaux, across Gironde and all over France — one contact, premium service.",
  "services.cta": "Get a quote / Book",
  "services.b1": "24/7",
  "services.b2": "Up to 4 passengers",
  "services.b3": "Professional driver",
  "svcp.airport.title": "Mérignac airport transfers",
  "svcp.airport.desc":
    "On-time pick-up for your flights, real-time tracking, name-board greeting on request.",
  "svcp.airport.p1": "Flight tracking",
  "svcp.airport.p2": "Personal greeting",
  "svcp.airport.p3": "Round-trip available",
  "svcp.train.title": "Saint-Jean & TGV stations",
  "svcp.train.desc":
    "Transfers to or from Bordeaux Saint-Jean and any station in the region.",
  "svcp.train.p1": "Station meet & greet",
  "svcp.train.p2": "Luggage help",
  "svcp.train.p3": "Available 24/7",
  "svcp.business.title": "Business travel",
  "svcp.business.desc":
    "Discreet, premium service for meetings, seminars and business trips.",
  "svcp.business.p1": "Company invoicing",
  "svcp.business.p2": "Onboard Wi-Fi",
  "svcp.business.p3": "Guaranteed discretion",
  "svcp.wedding.title": "Weddings & events",
  "svcp.wedding.desc":
    "An elegant, well-kept car to accompany your finest moments.",
  "svcp.wedding.p1": "Decorated car on request",
  "svcp.wedding.p2": "Flat-rate pricing",
  "svcp.wedding.p3": "Driver in suit",
  "svcp.cpam.title": "CPAM medical transport",
  "svcp.cpam.desc":
    "Seated professional transport covered by the French health insurance.",
  "svcp.cpam.p1": "Direct billing",
  "svcp.cpam.p2": "Transport voucher accepted",
  "svcp.cpam.p3": "Hospitals & clinics",
  "svcp.long.title": "Long distance",
  "svcp.long.desc": "Any-distance trips across France and Europe, on quote.",
  "svcp.long.p1": "Free quote",
  "svcp.long.p2": "Per-kilometer rate",
  "svcp.long.p3": "Long-haul comfort",

  "tarifs.eyebrow": "Pricing",
  "tarifs.title": "Transparent prices",
  "tarifs.intro":
    "Indicative prices based on the prefectoral regulations. An exact quote is confirmed at booking.",
  "tarifs.col.from": "From",
  "tarifs.col.to": "To",
  "tarifs.col.day": "Day rate",
  "tarifs.col.night": "Night / Sun. rate",
  "tarifs.note":
    "Night rates apply 7pm–7am, Sundays and bank holidays. Airport / station flat rates available depending on the area.",
  "tarifs.cpam.title": "🏥 CPAM medical transport",
  "tarifs.cpam.desc":
    "With a medical transport voucher, direct billing to the French health insurance. No upfront payment.",
  "tarifs.event.title": "📅 Event packages",
  "tarifs.event.desc":
    "Weddings, seminars, evenings: flat-rate pricing on personal quote. Contact us.",
  "tarifs.cta": "Get an exact quote",
  "city.bdx_centre": "Bordeaux center",
  "city.cenon": "Cenon / Floirac",
  "city.merignac": "Mérignac",
  "city.bdx": "Bordeaux",
  "city.airport": "Mérignac airport",
  "city.gare": "Saint-Jean station",
  "city.arcachon": "Arcachon",
  "city.stemilion": "Saint-Émilion",

  "about.eyebrow": "Our story",
  "about.title": "About Taxi City Bordeaux",
  "about.p1.brand": "Taxi City Bordeaux",
  "about.p1":
    "is an independent taxi business based in Cenon, right next to Bordeaux. We aim to deliver a service worthy of Bordeaux's elegance: punctuality, comfort and discretion.",
  "about.p2":
    "Whether you're a private customer heading to the airport, a professional on the move, or a patient needing medical transport, we adapt our service to your need.",
  "about.p3":
    "Our recent, air-conditioned and carefully maintained car guarantees a pleasant ride in any situation.",
  "about.b1.t": "Professional driver",
  "about.b1.d":
    "Official taxi card, ongoing training, deep knowledge of Bordeaux and Gironde.",
  "about.b2.t": "Available 24/7",
  "about.b2.d": "Day and night, weekends and bank holidays included.",
  "about.b3.t": "Bordeaux & Gironde",
  "about.b3.d":
    "Official station in Bordeaux. Whole metropolitan area, airport, stations and all France on booking.",
  "about.b4.t": "CPAM medical transport",
  "about.b4.d":
    "Seated professional transport covered by the French health insurance.",
  "about.cta": "Book a ride",

  "contact.eyebrow": "Contact",
  "contact.title": "Get in touch",
  "contact.intro":
    "Available 24/7 — one call is enough, or send us a message.",
  "contact.phone": "Phone",
  "contact.phone.sub": "Immediate answer",
  "contact.wa.title": "WhatsApp",
  "contact.wa.line": "Chat on WhatsApp",
  "contact.wa.sub": "Great for sharing an address",
  "contact.email": "Email",
  "contact.email.sub": "Quotes & special requests",
  "contact.address": "Address",
  "contact.address.area": "We operate across the whole Gironde area.",
  "contact.form.eyebrow": "Form",
  "contact.form.title": "Send us a message",
  "contact.form.intro":
    "For a quote, a question or a special request — we reply as soon as possible.",
  "contact.form.name": "Full name *",
  "contact.form.email": "Email *",
  "contact.form.phone": "Phone (optional)",
  "contact.form.subject": "Subject (optional)",
  "contact.form.subject.ph": "Ex: Quote Bordeaux → Paris",
  "contact.form.message": "Message *",
  "contact.form.message.ph": "Tell us about your request…",
  "contact.form.send": "Send message",
  "contact.form.sending": "Sending…",
  "contact.form.error":
    "An error occurred. Please call us directly at +33 6 73 07 23 22.",
  "contact.form.success.title": "Message sent!",
  "contact.form.success.desc":
    "Thanks for reaching out. We'll get back to you by email shortly.",
  "contact.form.success.again": "Send another message",
  "contact.form.note":
    "For a ride, please use the booking form instead.",
  "contact.err.name": "Name required",
  "contact.err.email": "Invalid email",
  "contact.err.message": "Message too short (10 characters min)",
  "contact.err.phone": "Invalid phone number",

  "res.eyebrow": "Online booking",
  "res.title": "Book your taxi",
  "res.intro": "Fill the form — we call you back to confirm.",
  "res.f.name": "Full name *",
  "res.f.phone": "Phone *",
  "res.f.email": "Email (optional)",
  "res.f.trip": "Trip type *",
  "res.f.trip.one": "One way",
  "res.f.trip.round": "Round trip",
  "res.f.pickup": "Pick-up date and time *",
  "res.f.return": "Return date and time *",
  "res.f.from": "Pick-up address *",
  "res.f.from.ph": "Ex: 12 cours de l'Intendance, Bordeaux",
  "res.f.to": "Drop-off address *",
  "res.f.to.ph": "Ex: Mérignac airport",
  "res.f.passengers": "Passengers",
  "res.f.luggage": "Luggage",
  "res.f.kind": "Service type",
  "res.f.kind.standard": "Standard",
  "res.f.kind.airport": "Airport",
  "res.f.kind.train": "Station",
  "res.f.kind.cpam": "CPAM medical",
  "res.f.kind.wedding": "Wedding / event",
  "res.f.kind.business": "Business",
  "res.f.kind.long": "Long distance",
  "res.f.needs": "Special needs",
  "res.f.needs.cpam": "CPAM / medical",
  "res.f.needs.cpam.hint": "Covered transport",
  "res.f.needs.bags": "Luggage help",
  "res.f.needs.bags.hint": "Help loading bags",
  "res.f.needs.child": "Child seat",
  "res.f.needs.child.hint": "State child age in message",
  "res.f.message": "Message (optional)",
  "res.f.message.ph": "Flight number, kids' age, details…",
  "res.send": "Send my request",
  "res.sending": "Sending…",
  "res.note":
    "For an immediate ride, call us directly at +33 6 73 07 23 22",
  "res.err.global":
    "Sending failed. Please call us at +33 6 73 07 23 22.",
  "res.err.phone": "Invalid phone number",
  "res.err.name": "Name required",
  "res.err.pickup": "Date/time required",
  "res.err.future": "Date must be in the future",
  "res.err.from": "Pick-up address required",
  "res.err.to": "Drop-off address required",
  "res.err.return": "Return date must be after pick-up",

  "conf.cancelled.title": "Booking cancelled",
  "conf.cancelled.desc": "This booking has been cancelled.",
  "conf.ok.title": "Request received!",
  "conf.ok.desc": "We'll call you back shortly to confirm your ride.",
  "conf.ref.label": "Booking number",
  "conf.ref.note": "Keep it for any change or cancellation.",
  "conf.summary": "Summary",
  "conf.row.pickup": "Pick-up",
  "conf.row.from": "From",
  "conf.row.to": "To",
  "conf.row.phone": "Phone",
  "conf.passengers": "passenger(s)",
  "conf.luggage": "luggage piece(s)",
  "conf.wa": "Confirm on WhatsApp",
  "conf.modify.title": "Change or cancel",
  "conf.modify.desc":
    "To change your request, contact us by phone or WhatsApp with your booking number.",
  "conf.cancel": "Cancel my booking",
  "conf.cancel.confirm": "Confirm cancellation",
  "conf.cancel.keep": "Keep my booking",
  "conf.back": "← Back to home",
  "conf.notfound.title": "Booking not found",
  "conf.notfound.desc":
    "The link looks invalid or the booking was deleted.",
  "conf.notfound.cta": "Make a new booking",

  "wa.float.send": "Send my request",
  "wa.float.label": "WhatsApp",
  "wa.default":
    "Hello, I'd like to book a taxi with Taxi City Bordeaux. Could you confirm availability? Thanks.",
};

const es: Dict = {
  "nav.home": "Inicio",
  "nav.services": "Servicios",
  "nav.tarifs": "Tarifas",
  "nav.about": "Nosotros",
  "nav.contact": "Contacto",
  "nav.book": "Reservar",
  "nav.book_long": "Reservar un viaje",
  "common.available_247": "Disponible 24/7",
  "common.lang_label": "Idioma",

  "home.hero.badge": "Disponible 24/7",
  "home.hero.title.before": "Su taxi en",
  "home.hero.title.city": "Burdeos",
  "home.hero.title.after": ", puntual y confortable.",
  "home.hero.subtitle":
    "Viajes profesionales o personales, carreras inmediatas o reservadas: le llevamos por toda la Gironda y Francia, de día y de noche, en un vehículo cuidado.",
  "home.hero.need_taxi": "Necesito un taxi…",
  "home.hero.book_now": "Reservar un viaje",
  "home.hero.tag1": "Reserva rápida",
  "home.hero.tag2": "Concertado CPAM",
  "home.hero.tag3": "Tarifas transparentes",

  "home.dest.eyebrow": "Destinos",
  "home.dest.title": "A donde le llevamos",
  "home.dest.intro":
    "Algunos trayectos que nuestros clientes reservan a diario — la llegada con calma es nuestro oficio.",
  "home.dest.gare.title": "Estación Bordeaux Saint-Jean",
  "home.dest.gare.sub": "Recibimiento en el andén, ayuda con el equipaje.",
  "home.dest.airport.title": "Aeropuerto de Mérignac",
  "home.dest.airport.sub": "Seguimiento de vuelos, espera 15 min gratis.",
  "home.dest.vine.title": "Castillos y viñedos",
  "home.dest.vine.sub": "Médoc, Saint-Émilion, Sauternes — por jornada.",
  "home.dest.cta": "Reservar",

  "home.why.eyebrow": "Por qué nosotros",
  "home.why.title": "Un servicio sencillo, humano y fiable.",
  "home.why.desc":
    "Taxi City Bordeaux es un chófer cercano, un vehículo cuidado y ganas de hacerlo bien. Sin sorpresas en la factura, sin esperas eternas — confirmamos, llegamos y le acercamos a su destino.",
  "home.why.years": "años de experiencia",
  "home.why.f1.t": "Puntualidad garantizada",
  "home.why.f1.d": "Seguimiento de vuelos y trenes, margen anti-retraso.",
  "home.why.f2.t": "Tarifas claras",
  "home.why.f2.d": "Presupuesto a petición, pago con tarjeta y efectivo.",
  "home.why.f3.t": "Concertado CPAM",
  "home.why.f3.d": "Transportes médicos cubiertos.",

  "home.services.eyebrow": "Nuestros servicios",
  "home.services.title": "Para todos sus desplazamientos",
  "home.services.see_all": "Ver todos los servicios",
  "svc.airport.title": "Aeropuerto de Mérignac",
  "svc.airport.desc": "Traslados desde y hacia el aeropuerto, día y noche.",
  "svc.train.title": "Estación Saint-Jean",
  "svc.train.desc": "Recogida a la llegada, recibimiento personal.",
  "svc.business.title": "Viajes de negocios",
  "svc.business.desc": "Discreción y puntualidad para sus reuniones.",
  "svc.wedding.title": "Bodas y eventos",
  "svc.wedding.desc": "Vehículo cuidado para sus mejores momentos.",
  "svc.cpam.title": "Transporte médico CPAM",
  "svc.cpam.desc": "Transportes sanitarios cubiertos.",
  "svc.long.title": "Larga distancia",
  "svc.long.desc": "Trayectos a cualquier distancia en Francia, con presupuesto.",

  "home.test.eyebrow": "Confiaron en nosotros",
  "home.test.title": "Lo que dicen nuestros clientes",
  "home.test.t1":
    "Chófer muy puntual, coche impecable. Llegué a Mérignac sin estrés, lo recomiendo.",
  "home.test.t2":
    "Reserva sencilla, precio anunciado respetado. Perfecto para mis viajes de negocio semanales.",
  "home.test.t3":
    "Nos recogió en la estación con mis hijos, el chófer fue muy amable. Volveremos a llamar.",

  "home.faq.eyebrow": "Sus preguntas",
  "home.faq.title": "Respondemos con franqueza",
  "home.faq.intro":
    "Algunas respuestas a las preguntas más frecuentes. Si no encuentra la suya, basta con una llamada.",
  "faq.q1": "¿Está concertado con la CPAM?",
  "faq.a1":
    "Sí, estamos concertados con la CPAM para transportes médicos (consultas, diálisis, hospitalizaciones…). Pida a su médico la prescripción de transporte y nos encargamos del resto — en la mayoría de los casos no adelanta nada.",
  "faq.q2": "¿Y si mi vuelo se retrasa en Mérignac?",
  "faq.a2":
    "Seguimos su vuelo en tiempo real. Si el avión llega antes o después, ajustamos la hora de recogida. La primera media hora de espera tras el aterrizaje es gratis.",
  "faq.q3": "¿Cómo cancelo o modifico mi reserva?",
  "faq.a3":
    "Una llamada o WhatsApp es suficiente. La cancelación es gratuita hasta 2 horas antes. Para cualquier cambio (hora, dirección, pasajeros), avísenos cuanto antes.",
  "faq.q4": "¿Qué métodos de pago aceptan?",
  "faq.a4":
    "Tarjeta (contactless, Apple Pay, Google Pay), efectivo, y transferencia para cuentas profesionales. Factura al final de la carrera bajo petición.",
  "faq.q5": "¿Hay que reservar con antelación?",
  "faq.a5":
    "No es obligatorio — también atendemos carreras inmediatas si estamos disponibles. Para un tren temprano o un vuelo, mejor reservar la víspera.",
  "faq.q6": "¿Cuánto equipaje puedo llevar?",
  "faq.a6":
    "Una berlina cómoda admite 3 o 4 maletas y 4 pasajeros. Para grupos, material voluminoso o bicicleta, avísenos al reservar.",

  "home.cta.title": "¿Listo para reservar su carrera?",
  "home.cta.desc":
    "Confirmación rápida, chófer profesional y precio transparente — llámenos o reserve en línea.",
  "home.cta.online": "Reservar en línea",

  "services.eyebrow": "Nuestros servicios",
  "services.title": "Un servicio de taxi para cada necesidad",
  "services.intro":
    "En Burdeos, en la Gironda y en toda Francia — un único interlocutor, servicio premium.",
  "services.cta": "Pedir presupuesto / Reservar",
  "services.b1": "24/7",
  "services.b2": "Hasta 4 pasajeros",
  "services.b3": "Chófer profesional",
  "svcp.airport.title": "Traslados al aeropuerto de Mérignac",
  "svcp.airport.desc":
    "Recogida puntual para sus vuelos, seguimiento en tiempo real, recibimiento con cartel a petición.",
  "svcp.airport.p1": "Seguimiento de vuelos",
  "svcp.airport.p2": "Recibimiento personal",
  "svcp.airport.p3": "Ida y vuelta posible",
  "svcp.train.title": "Estación Saint-Jean y estaciones TGV",
  "svcp.train.desc":
    "Traslados desde o hacia Bordeaux Saint-Jean y todas las estaciones de la región.",
  "svcp.train.p1": "Recibimiento en estación",
  "svcp.train.p2": "Ayuda con el equipaje",
  "svcp.train.p3": "Disponible 24/7",
  "svcp.business.title": "Viajes profesionales",
  "svcp.business.desc":
    "Servicio discreto y premium para reuniones, seminarios y desplazamientos de negocio.",
  "svcp.business.p1": "Facturación a empresa",
  "svcp.business.p2": "Wifi a bordo",
  "svcp.business.p3": "Discreción garantizada",
  "svcp.wedding.title": "Bodas y eventos",
  "svcp.wedding.desc":
    "Un vehículo cuidado para acompañar sus mejores momentos.",
  "svcp.wedding.p1": "Vehículo decorado a petición",
  "svcp.wedding.p2": "Tarifa cerrada",
  "svcp.wedding.p3": "Chófer con traje",
  "svcp.cpam.title": "Transporte médico CPAM",
  "svcp.cpam.desc":
    "Transporte sentado profesional cubierto por la Seguridad Social francesa.",
  "svcp.cpam.p1": "Pago directo",
  "svcp.cpam.p2": "Bono de transporte aceptado",
  "svcp.cpam.p3": "Hospitales y clínicas",
  "svcp.long.title": "Larga distancia",
  "svcp.long.desc":
    "Trayectos a cualquier distancia en Francia y Europa, con presupuesto.",
  "svcp.long.p1": "Presupuesto gratuito",
  "svcp.long.p2": "Tarifa por kilómetro",
  "svcp.long.p3": "Confort larga duración",

  "tarifs.eyebrow": "Tarifas",
  "tarifs.title": "Precios transparentes",
  "tarifs.intro":
    "Tarifas indicativas según la regulación prefectoral. Un presupuesto exacto se confirma al reservar.",
  "tarifs.col.from": "Origen",
  "tarifs.col.to": "Destino",
  "tarifs.col.day": "Tarifa día",
  "tarifs.col.night": "Tarifa noche / dom",
  "tarifs.note":
    "Tarifa nocturna de 19 h a 7 h, domingos y festivos. Tarifas cerradas aeropuerto / estación según zona.",
  "tarifs.cpam.title": "🏥 Concertado CPAM",
  "tarifs.cpam.desc":
    "Con bono de transporte, pago directo a la Seguridad Social francesa. Sin adelanto.",
  "tarifs.event.title": "📅 Tarifas eventos",
  "tarifs.event.desc":
    "Bodas, seminarios, veladas: tarifas cerradas con presupuesto personal. Contáctenos.",
  "tarifs.cta": "Pedir presupuesto exacto",
  "city.bdx_centre": "Burdeos centro",
  "city.cenon": "Cenon / Floirac",
  "city.merignac": "Mérignac",
  "city.bdx": "Burdeos",
  "city.airport": "Aeropuerto de Mérignac",
  "city.gare": "Estación Saint-Jean",
  "city.arcachon": "Arcachon",
  "city.stemilion": "Saint-Émilion",

  "about.eyebrow": "Nuestra historia",
  "about.title": "Sobre Taxi City Bordeaux",
  "about.p1.brand": "Taxi City Bordeaux",
  "about.p1":
    "es una empresa de taxi independiente con base en Cenon, junto a Burdeos. Buscamos un servicio a la altura de la elegancia bordelesa: puntualidad, confort y discreción.",
  "about.p2":
    "Tanto si es un particular que va al aeropuerto, un profesional en viaje o un paciente que necesita transporte médico, adaptamos el servicio a su necesidad.",
  "about.p3":
    "Nuestro vehículo reciente, climatizado y cuidado, garantiza un trayecto agradable en toda circunstancia.",
  "about.b1.t": "Chófer profesional",
  "about.b1.d":
    "Tarjeta profesional de taxi, formación continua, perfecto conocimiento de Burdeos y la Gironda.",
  "about.b2.t": "Disponible 24/7",
  "about.b2.d": "Día y noche, fines de semana y festivos incluidos.",
  "about.b3.t": "Burdeos y Gironda",
  "about.b3.d":
    "Parada oficial en Burdeos. Toda la metrópoli, el aeropuerto, las estaciones y toda Francia con reserva.",
  "about.b4.t": "Concertado CPAM",
  "about.b4.d":
    "Transporte sentado profesional cubierto por la Seguridad Social francesa.",
  "about.cta": "Reservar un viaje",

  "contact.eyebrow": "Contacto",
  "contact.title": "Contáctenos",
  "contact.intro":
    "Disponible 24/7 — basta una llamada, o envíenos un mensaje.",
  "contact.phone": "Teléfono",
  "contact.phone.sub": "Respuesta inmediata",
  "contact.wa.title": "WhatsApp",
  "contact.wa.line": "Hablemos por WhatsApp",
  "contact.wa.sub": "Ideal para enviar una dirección",
  "contact.email": "Email",
  "contact.email.sub": "Presupuestos y solicitudes especiales",
  "contact.address": "Dirección",
  "contact.address.area": "Trabajamos en toda la Gironda.",
  "contact.form.eyebrow": "Formulario",
  "contact.form.title": "Envíenos un mensaje",
  "contact.form.intro":
    "Para un presupuesto, una pregunta o una petición especial — respondemos lo antes posible.",
  "contact.form.name": "Nombre completo *",
  "contact.form.email": "Email *",
  "contact.form.phone": "Teléfono (opcional)",
  "contact.form.subject": "Asunto (opcional)",
  "contact.form.subject.ph": "Ej: Presupuesto Burdeos → París",
  "contact.form.message": "Mensaje *",
  "contact.form.message.ph": "Detalle su solicitud…",
  "contact.form.send": "Enviar mensaje",
  "contact.form.sending": "Enviando…",
  "contact.form.error":
    "Ha ocurrido un error. Llámenos directamente al +33 6 73 07 23 22.",
  "contact.form.success.title": "¡Mensaje enviado!",
  "contact.form.success.desc":
    "Gracias por contactarnos. Le respondemos pronto por email.",
  "contact.form.success.again": "Enviar otro mensaje",
  "contact.form.note":
    "Para un viaje, utilice mejor el formulario de reserva.",
  "contact.err.name": "Nombre obligatorio",
  "contact.err.email": "Email no válido",
  "contact.err.message": "Mensaje demasiado corto (mín. 10 caracteres)",
  "contact.err.phone": "Número no válido",

  "res.eyebrow": "Reserva en línea",
  "res.title": "Reserve su taxi",
  "res.intro": "Rellene el formulario — le llamamos para confirmar.",
  "res.f.name": "Nombre completo *",
  "res.f.phone": "Teléfono *",
  "res.f.email": "Email (opcional)",
  "res.f.trip": "Tipo de trayecto *",
  "res.f.trip.one": "Solo ida",
  "res.f.trip.round": "Ida y vuelta",
  "res.f.pickup": "Fecha y hora de recogida *",
  "res.f.return": "Fecha y hora de regreso *",
  "res.f.from": "Dirección de recogida *",
  "res.f.from.ph": "Ej: 12 cours de l'Intendance, Burdeos",
  "res.f.to": "Dirección de destino *",
  "res.f.to.ph": "Ej: Aeropuerto de Mérignac",
  "res.f.passengers": "Pasajeros",
  "res.f.luggage": "Equipaje",
  "res.f.kind": "Tipo de servicio",
  "res.f.kind.standard": "Estándar",
  "res.f.kind.airport": "Aeropuerto",
  "res.f.kind.train": "Estación",
  "res.f.kind.cpam": "CPAM médico",
  "res.f.kind.wedding": "Boda / evento",
  "res.f.kind.business": "Negocios",
  "res.f.kind.long": "Larga distancia",
  "res.f.needs": "Necesidades especiales",
  "res.f.needs.cpam": "CPAM / médico",
  "res.f.needs.cpam.hint": "Transporte concertado",
  "res.f.needs.bags": "Ayuda con equipaje",
  "res.f.needs.bags.hint": "Asistencia para cargar",
  "res.f.needs.child": "Silla infantil",
  "res.f.needs.child.hint": "Indique la edad en el mensaje",
  "res.f.message": "Mensaje (opcional)",
  "res.f.message.ph": "Número de vuelo, edad de los niños, detalles…",
  "res.send": "Enviar mi solicitud",
  "res.sending": "Enviando…",
  "res.note":
    "Para un viaje inmediato, llámenos directamente al +33 6 73 07 23 22",
  "res.err.global":
    "Error de envío. Llámenos al +33 6 73 07 23 22.",
  "res.err.phone": "Número de teléfono no válido",
  "res.err.name": "Nombre obligatorio",
  "res.err.pickup": "Fecha/hora obligatoria",
  "res.err.future": "La fecha debe ser futura",
  "res.err.from": "Dirección de recogida obligatoria",
  "res.err.to": "Dirección de destino obligatoria",
  "res.err.return": "La fecha de regreso debe ser posterior a la ida",

  "conf.cancelled.title": "Reserva cancelada",
  "conf.cancelled.desc": "Esta reserva ha sido cancelada.",
  "conf.ok.title": "¡Solicitud registrada!",
  "conf.ok.desc": "Le llamamos pronto para confirmar su carrera.",
  "conf.ref.label": "N.º de reserva",
  "conf.ref.note": "Conserve para cualquier cambio o cancelación.",
  "conf.summary": "Resumen",
  "conf.row.pickup": "Recogida",
  "conf.row.from": "Origen",
  "conf.row.to": "Destino",
  "conf.row.phone": "Teléfono",
  "conf.passengers": "pasajero(s)",
  "conf.luggage": "maleta(s)",
  "conf.wa": "Confirmar por WhatsApp",
  "conf.modify.title": "Modificar o cancelar",
  "conf.modify.desc":
    "Para modificar su solicitud, contáctenos por teléfono o WhatsApp con su número de reserva.",
  "conf.cancel": "Cancelar mi reserva",
  "conf.cancel.confirm": "Confirmar la cancelación",
  "conf.cancel.keep": "Mantener mi reserva",
  "conf.back": "← Volver al inicio",
  "conf.notfound.title": "Reserva no encontrada",
  "conf.notfound.desc":
    "El enlace parece no válido o la reserva fue eliminada.",
  "conf.notfound.cta": "Hacer una nueva reserva",

  "wa.float.send": "Enviar mi solicitud",
  "wa.float.label": "WhatsApp",
  "wa.default":
    "Hola, quisiera reservar un taxi con Taxi City Bordeaux. ¿Podría confirmarme la disponibilidad? Gracias.",
};

const de: Dict = {
  "nav.home": "Startseite",
  "nav.services": "Leistungen",
  "nav.tarifs": "Preise",
  "nav.about": "Über uns",
  "nav.contact": "Kontakt",
  "nav.book": "Buchen",
  "nav.book_long": "Fahrt buchen",
  "common.available_247": "24/7 verfügbar",
  "common.lang_label": "Sprache",

  "home.hero.badge": "24/7 verfügbar",
  "home.hero.title.before": "Ihr Taxi in",
  "home.hero.title.city": "Bordeaux",
  "home.hero.title.after": ", pünktlich und komfortabel.",
  "home.hero.subtitle":
    "Geschäftlich oder privat, sofort oder vorbestellt: Wir fahren Sie überall in der Gironde und in Frankreich, Tag und Nacht, in einem gepflegten Fahrzeug.",
  "home.hero.need_taxi": "Ich brauche ein Taxi…",
  "home.hero.book_now": "Fahrt buchen",
  "home.hero.tag1": "Schnelle Buchung",
  "home.hero.tag2": "CPAM-Krankenfahrten",
  "home.hero.tag3": "Transparente Preise",

  "home.dest.eyebrow": "Ziele",
  "home.dest.title": "Wohin wir Sie bringen",
  "home.dest.intro":
    "Einige Strecken, die unsere Kunden täglich buchen — entspannt ankommen ist unser Beruf.",
  "home.dest.gare.title": "Bahnhof Bordeaux Saint-Jean",
  "home.dest.gare.sub": "Empfang am Gleis, Hilfe mit dem Gepäck.",
  "home.dest.airport.title": "Flughafen Mérignac",
  "home.dest.airport.sub": "Flugverfolgung, 15 Min. Wartezeit kostenlos.",
  "home.dest.vine.title": "Schlösser & Weingüter",
  "home.dest.vine.sub": "Médoc, Saint-Émilion, Sauternes — Tagestouren.",
  "home.dest.cta": "Buchen",

  "home.why.eyebrow": "Warum wir",
  "home.why.title": "Ein einfacher, menschlicher und zuverlässiger Service.",
  "home.why.desc":
    "Taxi City Bordeaux, das ist ein Fahrer aus der Region, ein gepflegtes Fahrzeug und der Anspruch, es richtig zu machen. Keine Überraschungen auf der Rechnung, keine endlose Wartezeit — wir bestätigen, kommen an und bringen Sie zum Ziel.",
  "home.why.years": "Jahre Erfahrung",
  "home.why.f1.t": "Garantierte Pünktlichkeit",
  "home.why.f1.d": "Flug- und Zugverfolgung, Verspätungspuffer.",
  "home.why.f2.t": "Klare Preise",
  "home.why.f2.d": "Angebot auf Anfrage, Karte & Bargeld.",
  "home.why.f3.t": "CPAM-Krankenfahrten",
  "home.why.f3.d": "Krankenfahrten werden übernommen.",

  "home.services.eyebrow": "Unsere Leistungen",
  "home.services.title": "Für jede Fahrt",
  "home.services.see_all": "Alle Leistungen ansehen",
  "svc.airport.title": "Flughafen Mérignac",
  "svc.airport.desc": "Transfers von und zum Flughafen, Tag und Nacht.",
  "svc.train.title": "Bahnhof Saint-Jean",
  "svc.train.desc": "Abholung bei Ankunft, persönlicher Empfang.",
  "svc.business.title": "Geschäftsfahrten",
  "svc.business.desc": "Diskretion und Pünktlichkeit für Ihre Termine.",
  "svc.wedding.title": "Hochzeiten & Events",
  "svc.wedding.desc": "Gepflegtes Fahrzeug für Ihre besten Momente.",
  "svc.cpam.title": "CPAM-Krankenfahrten",
  "svc.cpam.desc": "Krankenfahrten werden übernommen.",
  "svc.long.title": "Langstrecke",
  "svc.long.desc": "Fahrten jeder Distanz in Frankreich auf Anfrage.",

  "home.test.eyebrow": "Sie haben uns vertraut",
  "home.test.title": "Was unsere Kunden sagen",
  "home.test.t1":
    "Sehr pünktlicher Fahrer, makelloses Auto. Stressfrei in Mérignac angekommen, sehr empfehlenswert.",
  "home.test.t2":
    "Einfache Buchung, Preis wie angekündigt. Perfekt für meine wöchentlichen Geschäftsreisen.",
  "home.test.t3":
    "Mit den Kindern am Bahnhof abgeholt, sehr freundlicher Fahrer. Wir buchen wieder.",

  "home.faq.eyebrow": "Ihre Fragen",
  "home.faq.title": "Wir antworten ehrlich",
  "home.faq.intro":
    "Einige Antworten auf die häufigsten Fragen. Wenn Sie Ihre nicht finden, ein kurzer Anruf genügt.",
  "faq.q1": "Sind Sie für CPAM-Krankenfahrten zugelassen?",
  "faq.a1":
    "Ja, wir sind für Krankenfahrten der CPAM zugelassen (Untersuchungen, Dialyse, Krankenhaus…). Lassen Sie sich von Ihrem Arzt das Krankenfahrtenrezept ausstellen, den Rest erledigen wir — meist müssen Sie nichts vorstrecken.",
  "faq.q2": "Was passiert, wenn mein Flug in Mérignac Verspätung hat?",
  "faq.a2":
    "Wir verfolgen Ihren Flug in Echtzeit. Bei früherer oder späterer Landung passen wir die Abholzeit an. Die erste halbe Stunde Wartezeit nach der Landung ist kostenlos.",
  "faq.q3": "Wie kann ich meine Buchung ändern oder stornieren?",
  "faq.a3":
    "Ein kurzer Anruf oder eine WhatsApp-Nachricht genügt. Stornierung kostenlos bis 2 Stunden vor der Fahrt. Für Änderungen (Zeit, Adresse, Personen) bitte so früh wie möglich Bescheid geben.",
  "faq.q4": "Welche Zahlungsmittel akzeptieren Sie?",
  "faq.a4":
    "Karte (kontaktlos, Apple Pay, Google Pay), Bargeld und Überweisung für Geschäftskonten. Quittung am Ende der Fahrt, auf Wunsch Rechnung für Reisekosten.",
  "faq.q5": "Muss ich im Voraus buchen?",
  "faq.a5":
    "Nicht zwingend — wir nehmen auch Sofortfahrten, wenn wir verfügbar sind. Für einen frühen Zug oder Flug besser am Vortag buchen.",
  "faq.q6": "Wie viel Gepäck kann ich mitnehmen?",
  "faq.a6":
    "Eine komfortable Limousine fasst leicht 3–4 Koffer und 4 Personen. Für Gruppen, sperrige Sachen oder ein Fahrrad bitte bei der Buchung mitteilen.",

  "home.cta.title": "Bereit, Ihre Fahrt zu buchen?",
  "home.cta.desc":
    "Schnelle Bestätigung, professioneller Fahrer und transparenter Preis — rufen Sie uns an oder buchen Sie online.",
  "home.cta.online": "Online buchen",

  "services.eyebrow": "Unsere Leistungen",
  "services.title": "Ein Taxiservice für jeden Bedarf",
  "services.intro":
    "In Bordeaux, in der Gironde und in ganz Frankreich — ein Ansprechpartner, Premium-Service.",
  "services.cta": "Angebot anfragen / Buchen",
  "services.b1": "24/7",
  "services.b2": "Bis zu 4 Personen",
  "services.b3": "Professioneller Fahrer",
  "svcp.airport.title": "Transfers Flughafen Mérignac",
  "svcp.airport.desc":
    "Pünktliche Abholung für Ihre Flüge, Echtzeit-Tracking, Empfang mit Schild auf Wunsch.",
  "svcp.airport.p1": "Flugverfolgung",
  "svcp.airport.p2": "Persönlicher Empfang",
  "svcp.airport.p3": "Hin- und Rückfahrt möglich",
  "svcp.train.title": "Bahnhof Saint-Jean & TGV-Bahnhöfe",
  "svcp.train.desc":
    "Transfers von oder zum Bahnhof Bordeaux Saint-Jean und allen Bahnhöfen der Region.",
  "svcp.train.p1": "Empfang am Bahnhof",
  "svcp.train.p2": "Hilfe mit dem Gepäck",
  "svcp.train.p3": "24/7 verfügbar",
  "svcp.business.title": "Geschäftsfahrten",
  "svcp.business.desc":
    "Diskreter Premium-Service für Termine, Tagungen und Geschäftsreisen.",
  "svcp.business.p1": "Firmenrechnung",
  "svcp.business.p2": "WLAN an Bord",
  "svcp.business.p3": "Diskretion garantiert",
  "svcp.wedding.title": "Hochzeiten & Events",
  "svcp.wedding.desc":
    "Ein gepflegtes, elegantes Fahrzeug für Ihre schönsten Momente.",
  "svcp.wedding.p1": "Dekoriertes Fahrzeug auf Wunsch",
  "svcp.wedding.p2": "Pauschalpreis",
  "svcp.wedding.p3": "Fahrer im Anzug",
  "svcp.cpam.title": "CPAM-Krankenfahrten",
  "svcp.cpam.desc":
    "Sitzender professioneller Krankentransport, von der französischen Krankenkasse übernommen.",
  "svcp.cpam.p1": "Direktabrechnung",
  "svcp.cpam.p2": "Transportschein akzeptiert",
  "svcp.cpam.p3": "Kliniken & Krankenhäuser",
  "svcp.long.title": "Langstrecke",
  "svcp.long.desc":
    "Fahrten jeder Distanz in Frankreich und Europa, auf Anfrage.",
  "svcp.long.p1": "Kostenloses Angebot",
  "svcp.long.p2": "Kilometerpreis",
  "svcp.long.p3": "Komfort über lange Distanzen",

  "tarifs.eyebrow": "Preise",
  "tarifs.title": "Transparente Preise",
  "tarifs.intro":
    "Richtpreise nach den Vorgaben der Präfektur. Ein genaues Angebot wird bei der Buchung bestätigt.",
  "tarifs.col.from": "Start",
  "tarifs.col.to": "Ziel",
  "tarifs.col.day": "Tagestarif",
  "tarifs.col.night": "Nacht / So.",
  "tarifs.note":
    "Nachttarif von 19 bis 7 Uhr, Sonn- und Feiertagen. Pauschalen für Flughafen / Bahnhof je nach Zone.",
  "tarifs.cpam.title": "🏥 CPAM-Krankenfahrten",
  "tarifs.cpam.desc":
    "Mit Transportschein direkte Abrechnung mit der französischen Krankenkasse. Keine Vorauszahlung.",
  "tarifs.event.title": "📅 Eventpauschalen",
  "tarifs.event.desc":
    "Hochzeiten, Tagungen, Abende: Pauschalen auf persönliches Angebot. Kontaktieren Sie uns.",
  "tarifs.cta": "Genaues Angebot anfragen",
  "city.bdx_centre": "Bordeaux Zentrum",
  "city.cenon": "Cenon / Floirac",
  "city.merignac": "Mérignac",
  "city.bdx": "Bordeaux",
  "city.airport": "Flughafen Mérignac",
  "city.gare": "Bahnhof Saint-Jean",
  "city.arcachon": "Arcachon",
  "city.stemilion": "Saint-Émilion",

  "about.eyebrow": "Unsere Geschichte",
  "about.title": "Über Taxi City Bordeaux",
  "about.p1.brand": "Taxi City Bordeaux",
  "about.p1":
    "ist ein unabhängiges Taxiunternehmen mit Sitz in Cenon, direkt bei Bordeaux. Wir möchten einen Service bieten, der Bordeauxs Eleganz gerecht wird: Pünktlichkeit, Komfort und Diskretion.",
  "about.p2":
    "Ob Privatperson auf dem Weg zum Flughafen, Geschäftsreisender oder Patient mit Krankenfahrt — wir passen unseren Service an Ihren Bedarf an.",
  "about.p3":
    "Unser neueres, klimatisiertes und sorgfältig gewartetes Fahrzeug garantiert eine angenehme Fahrt unter allen Umständen.",
  "about.b1.t": "Professioneller Fahrer",
  "about.b1.d":
    "Offizieller Taxischein, kontinuierliche Weiterbildung, beste Ortskenntnis von Bordeaux und der Gironde.",
  "about.b2.t": "24/7 verfügbar",
  "about.b2.d": "Tag und Nacht, Wochenenden und Feiertage inklusive.",
  "about.b3.t": "Bordeaux & Gironde",
  "about.b3.d":
    "Offizieller Standplatz in Bordeaux. Gesamter Großraum, Flughafen, Bahnhöfe und ganz Frankreich auf Buchung.",
  "about.b4.t": "CPAM-Krankenfahrten",
  "about.b4.d":
    "Sitzender professioneller Krankentransport, von der französischen Krankenkasse übernommen.",
  "about.cta": "Fahrt buchen",

  "contact.eyebrow": "Kontakt",
  "contact.title": "Kontaktieren Sie uns",
  "contact.intro":
    "24/7 erreichbar — ein Anruf genügt, oder schicken Sie uns eine Nachricht.",
  "contact.phone": "Telefon",
  "contact.phone.sub": "Sofortige Antwort",
  "contact.wa.title": "WhatsApp",
  "contact.wa.line": "Schreiben Sie uns auf WhatsApp",
  "contact.wa.sub": "Ideal, um eine Adresse zu senden",
  "contact.email": "E-Mail",
  "contact.email.sub": "Angebote & besondere Anfragen",
  "contact.address": "Adresse",
  "contact.address.area": "Wir fahren in der gesamten Gironde.",
  "contact.form.eyebrow": "Formular",
  "contact.form.title": "Senden Sie uns eine Nachricht",
  "contact.form.intro":
    "Für ein Angebot, eine Frage oder einen besonderen Wunsch — wir antworten so schnell wie möglich.",
  "contact.form.name": "Vollständiger Name *",
  "contact.form.email": "E-Mail *",
  "contact.form.phone": "Telefon (optional)",
  "contact.form.subject": "Betreff (optional)",
  "contact.form.subject.ph": "Z. B.: Angebot Bordeaux → Paris",
  "contact.form.message": "Nachricht *",
  "contact.form.message.ph": "Beschreiben Sie Ihre Anfrage…",
  "contact.form.send": "Nachricht senden",
  "contact.form.sending": "Senden…",
  "contact.form.error":
    "Ein Fehler ist aufgetreten. Bitte rufen Sie uns direkt an: +33 6 73 07 23 22.",
  "contact.form.success.title": "Nachricht gesendet!",
  "contact.form.success.desc":
    "Vielen Dank für Ihre Anfrage. Wir antworten in Kürze per E-Mail.",
  "contact.form.success.again": "Weitere Nachricht senden",
  "contact.form.note":
    "Für eine Fahrt nutzen Sie bitte das Buchungsformular.",
  "contact.err.name": "Name erforderlich",
  "contact.err.email": "Ungültige E-Mail",
  "contact.err.message": "Nachricht zu kurz (mind. 10 Zeichen)",
  "contact.err.phone": "Ungültige Nummer",

  "res.eyebrow": "Online-Buchung",
  "res.title": "Buchen Sie Ihr Taxi",
  "res.intro": "Formular ausfüllen — wir rufen zur Bestätigung zurück.",
  "res.f.name": "Vollständiger Name *",
  "res.f.phone": "Telefon *",
  "res.f.email": "E-Mail (optional)",
  "res.f.trip": "Fahrtart *",
  "res.f.trip.one": "Einfache Fahrt",
  "res.f.trip.round": "Hin- und Rückfahrt",
  "res.f.pickup": "Abholdatum und -uhrzeit *",
  "res.f.return": "Rückdatum und -uhrzeit *",
  "res.f.from": "Abholadresse *",
  "res.f.from.ph": "Z. B.: 12 cours de l'Intendance, Bordeaux",
  "res.f.to": "Zieladresse *",
  "res.f.to.ph": "Z. B.: Flughafen Mérignac",
  "res.f.passengers": "Personen",
  "res.f.luggage": "Gepäck",
  "res.f.kind": "Service-Art",
  "res.f.kind.standard": "Standard",
  "res.f.kind.airport": "Flughafen",
  "res.f.kind.train": "Bahnhof",
  "res.f.kind.cpam": "CPAM medizinisch",
  "res.f.kind.wedding": "Hochzeit / Event",
  "res.f.kind.business": "Geschäftlich",
  "res.f.kind.long": "Langstrecke",
  "res.f.needs": "Besondere Wünsche",
  "res.f.needs.cpam": "CPAM / medizinisch",
  "res.f.needs.cpam.hint": "Krankenfahrt",
  "res.f.needs.bags": "Gepäckhilfe",
  "res.f.needs.bags.hint": "Hilfe beim Verladen",
  "res.f.needs.child": "Kindersitz",
  "res.f.needs.child.hint": "Alter im Nachrichtfeld angeben",
  "res.f.message": "Nachricht (optional)",
  "res.f.message.ph": "Flugnummer, Alter der Kinder, Details…",
  "res.send": "Anfrage senden",
  "res.sending": "Senden…",
  "res.note":
    "Für eine Sofortfahrt rufen Sie uns direkt an: +33 6 73 07 23 22",
  "res.err.global":
    "Senden fehlgeschlagen. Bitte rufen Sie uns an: +33 6 73 07 23 22.",
  "res.err.phone": "Ungültige Telefonnummer",
  "res.err.name": "Name erforderlich",
  "res.err.pickup": "Datum/Uhrzeit erforderlich",
  "res.err.future": "Datum muss in der Zukunft liegen",
  "res.err.from": "Abholadresse erforderlich",
  "res.err.to": "Zieladresse erforderlich",
  "res.err.return": "Rückkehrdatum muss nach der Hinfahrt liegen",

  "conf.cancelled.title": "Buchung storniert",
  "conf.cancelled.desc": "Diese Buchung wurde storniert.",
  "conf.ok.title": "Anfrage eingegangen!",
  "conf.ok.desc": "Wir rufen in Kürze zur Bestätigung zurück.",
  "conf.ref.label": "Buchungsnummer",
  "conf.ref.note": "Für Änderung oder Stornierung aufbewahren.",
  "conf.summary": "Übersicht",
  "conf.row.pickup": "Abholung",
  "conf.row.from": "Start",
  "conf.row.to": "Ziel",
  "conf.row.phone": "Telefon",
  "conf.passengers": "Person(en)",
  "conf.luggage": "Gepäckstück(e)",
  "conf.wa": "Auf WhatsApp bestätigen",
  "conf.modify.title": "Ändern oder stornieren",
  "conf.modify.desc":
    "Für Änderungen kontaktieren Sie uns per Telefon oder WhatsApp mit Ihrer Buchungsnummer.",
  "conf.cancel": "Buchung stornieren",
  "conf.cancel.confirm": "Stornierung bestätigen",
  "conf.cancel.keep": "Buchung behalten",
  "conf.back": "← Zurück zur Startseite",
  "conf.notfound.title": "Buchung nicht gefunden",
  "conf.notfound.desc":
    "Der Link scheint ungültig oder die Buchung wurde gelöscht.",
  "conf.notfound.cta": "Neue Buchung machen",

  "wa.float.send": "Anfrage senden",
  "wa.float.label": "WhatsApp",
  "wa.default":
    "Hallo, ich möchte ein Taxi bei Taxi City Bordeaux buchen. Können Sie mir die Verfügbarkeit bestätigen? Danke.",
};

export const DICTS: Record<Lang, Dict> = { fr, en, es, de };
