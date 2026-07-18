// Contenu multilingue pour les 4 pages SEO locales (aéroport, gare, Arcachon, conventionné)
// Langues : fr, en, es, pt, it, ar
// FR = voix de José (première personne, artisan, ton humain)

import type { Lang } from "@/i18n/dict";

export type LandingKey = "airport" | "station" | "arcachon" | "cpam";

export type LandingContent = {
  title: string;      // <title> / og:title / h1
  description: string; // meta description / og:description / intro
  intro: string;      // paragraphe d'introduction
  sections: { h: string; p: string }[];
  ctaBook: string;
  ctaCall: string;
  faq: { q: string; a: string }[];
};

// Traductions courtes des libellés CTA/FAQ commune
const CTA: Record<Lang, { book: string; call: string; faqTitle: string }> = {
  fr: { book: "Réserver ma course", call: "Appeler José", faqTitle: "Questions fréquentes" },
  en: { book: "Book my ride", call: "Call José", faqTitle: "Frequently asked questions" },
  es: { book: "Reservar mi trayecto", call: "Llamar a José", faqTitle: "Preguntas frecuentes" },
  pt: { book: "Reservar a minha viagem", call: "Ligar ao José", faqTitle: "Perguntas frequentes" },
  it: { book: "Prenota la corsa", call: "Chiama José", faqTitle: "Domande frequenti" },
  ar: { book: "احجز رحلتي", call: "اتصل بخوسيه", faqTitle: "الأسئلة الشائعة" },
};

// --------- FR (voix de José — humain, pas IA) ----------
const FR: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Taxi Bordeaux aéroport Mérignac 24/7 — Réserver | VTC 7 places",
    description:
      "Réserver un taxi Bordeaux aéroport Mérignac : suivi de vol, forfait annoncé, VTC Bordeaux ou taxi 7 places sur demande. José vous attend, jour & nuit — 06 73 07 23 22.",
    intro:
      "Bonjour, moi c'est José. Ça fait des années que je fais la navette entre Bordeaux et l'aéroport de Mérignac — le matin, la nuit, les jours fériés. Vous me donnez votre numéro de vol, je suis l'atterrissage sur mon téléphone et je suis là quand vous sortez. Pas d'attente, pas de mauvaise surprise sur le prix.",
    sections: [
      {
        h: "Je suis votre vol, vous n'y pensez plus",
        p: "Un retard, un vol un peu en avance, une escale qui décale tout ? Vous me passez le numéro de vol au moment de la réservation, je regarde en temps réel et j'ajuste l'heure de prise en charge. Vous n'avez pas à m'appeler depuis l'avion, je suis déjà en route.",
      },
      {
        h: "Le prix, vous le connaissez avant de monter",
        p: "Je vous annonce le tarif dès la réservation — Bordeaux centre, Bassins à flot, Caudéran, Chartrons, peu importe le point de départ. C'est un forfait clair, pas de compteur qui tourne quand on est bloqué au feu.",
      },
      {
        h: "Familles, bagages, matériel — ça rentre",
        p: "La berline avale facilement 3 ou 4 valises et il y a la place pour les poussettes. Siège enfant sur demande (dites-le-moi la veille). Si vous êtes un groupe, je peux basculer sur un van 7 places sans souci.",
      },
    ],
    faq: [
      {
        q: "Combien coûte un taxi de Bordeaux centre à Mérignac ?",
        a: "En journée, comptez entre 30 et 45 € selon l'endroit exact d'où je viens vous chercher. La nuit et les dimanches, le tarif est un peu au-dessus (tarif réglementé). Je vous confirme le prix précis au moment de la réservation, avant que vous confirmiez.",
      },
      {
        q: "Et si mon vol a du retard ?",
        a: "Je suis votre vol en direct — vous n'avez rien à faire. Si vous atterrissez avec 1h de retard, je serai là 1h plus tard. Le temps normal d'attente après l'atterrissage (récupération bagages, douane) est compris.",
      },
      {
        q: "Vous prenez les réservations pour un vol à 5h du matin ?",
        a: "Oui, je fais beaucoup de départs matinaux et de retours de nuit. Réservez la veille ou même quelques jours avant, je bloque le créneau et je suis devant chez vous à l'heure convenue.",
      },
      {
        q: "Je peux payer par carte ?",
        a: "Oui — carte, sans contact, Apple Pay, Google Pay, ou espèces. Je fournis une facture si vous en avez besoin pour vos notes de frais.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  station: {
    title: "Taxi Bordeaux gare Saint-Jean — Réserver taxi ou VTC 7 places",
    description:
      "Réserver un taxi à la gare Bordeaux Saint-Jean : José suit votre TGV, prise en charge au quai, VTC Bordeaux ou taxi 7 places sur demande. 7j/7, 24h/24.",
    intro:
      "Je m'appelle José et je fais régulièrement Saint-Jean. Que vous descendiez d'un TGV Paris, d'un Ouigo ou d'un Intercités, je suis au point de rendez-vous qu'on aura fixé ensemble — pas besoin de tourner en rond avec vos valises pour me trouver.",
    sections: [
      {
        h: "On se retrouve où vous voulez à la gare",
        p: "Dépose-minute côté Belcier, parvis principal côté ville, ou parking Effia — vous me dites où vous êtes le plus à l'aise et je suis là. Je vous envoie un SMS avec la plaque de la voiture quand j'arrive.",
      },
      {
        h: "Je regarde votre train arriver",
        p: "Retard SNCF, changement de voie de dernière minute, TGV qui arrive un peu en avance : je vois tout ça en temps réel. Vous n'avez pas à m'appeler pour me prévenir.",
      },
      {
        h: "De la gare à votre vraie destination",
        p: "Un hôtel dans les Chartrons, la Cité du Vin, l'aéroport pour une correspondance, un rendez-vous à Mérignac, ou directement Arcachon, Saint-Émilion, Cap-Ferret — c'est direct, sans changement.",
      },
    ],
    faq: [
      {
        q: "Où précisément est-ce que je vous retrouve à Saint-Jean ?",
        a: "On fixe le point de rendez-vous à la réservation. Le plus simple pour vous : dépose-minute côté Belcier (moins de monde), ou parvis principal si vous préférez sortir côté centre-ville. Je vous confirme par SMS dès que je suis devant.",
      },
      {
        q: "Vous prenez un TGV de nuit ou très tôt le matin ?",
        a: "Bien sûr. Je travaille 7j/7 24h/24 — les trains de nuit et les premiers TGV du matin font partie de mon quotidien.",
      },
      {
        q: "Si mon train a 30 min de retard, je paie l'attente ?",
        a: "Non, pour un retard SNCF standard c'est intégré — je suis le train, j'ajuste mon arrivée. Sur une attente vraiment longue (plusieurs heures), on en discute au moment de la réservation.",
      },
      {
        q: "Vous pouvez me déposer à un adresse pro pour un rendez-vous ?",
        a: "Oui, avec facture si besoin. Je peux aussi vous attendre pour un retour à la gare — dites-le-moi à la réservation, je bloque le créneau retour.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  arcachon: {
    title: "Taxi Bordeaux Arcachon — Réserver taxi 7 places, Pyla & Cap-Ferret",
    description:
      "Réserver un taxi Bordeaux → Arcachon, Pyla, Cap-Ferret : trajet direct, forfait annoncé, VTC Bordeaux ou taxi 7 places pour familles et bagages. 06 73 07 23 22.",
    intro:
      "Bordeaux ↔ Arcachon, je le fais souvent — pour des touristes qui veulent voir la Dune du Pyla, pour des familles qui vont à Cap-Ferret le week-end, pour des habitués qui prennent le TER trop lent avec les valises. C'est un trajet que je connais par cœur.",
    sections: [
      {
        h: "Porte-à-porte, sans correspondance",
        p: "Je viens vous chercher où vous êtes — hôtel dans le centre de Bordeaux, gare Saint-Jean, aéroport de Mérignac — et je vous dépose là où vous voulez : Arcachon ville, Pyla-sur-Mer au pied de la Dune, Cap-Ferret, Andernos, Lège. Sans changement de véhicule.",
      },
      {
        h: "Le prix, c'est un forfait annoncé",
        p: "Je vous donne le prix ferme à la réservation. Pas de compteur qui monte parce qu'on est coincés sur l'A63 un vendredi soir. Bien plus tranquille pour partir en vacances qu'un taxi qui vous stresse à chaque bouchon.",
      },
      {
        h: "Le retour, on l'organise en même temps",
        p: "Si vous savez déjà quand vous rentrez, on bloque l'aller ET le retour au moment de la réservation. Je suis devant votre location à l'heure dite, prêt à repartir. Ça marche aussi pour les mariages, les week-ends sur le Bassin.",
      },
    ],
    faq: [
      {
        q: "Il faut combien de temps entre Bordeaux et Arcachon ?",
        a: "Autour d'une heure hors circulation. Un vendredi soir d'été ou un dimanche de retour de week-end, comptez 1h15 à 1h30. Je regarde le trafic avant de partir pour choisir le meilleur itinéraire.",
      },
      {
        q: "Combien pour aller à la Dune du Pyla depuis Bordeaux centre ?",
        a: "Je vous donne le forfait exact à la réservation — ça dépend du point de départ précis et de l'heure (jour ou nuit). Vous connaissez le prix avant de confirmer, pas de surprise à l'arrivée.",
      },
      {
        q: "J'ai des valises et une planche de surf, ça passe ?",
        a: "Sans problème. La voiture est spacieuse, on peut charger des valises, des poussettes, du matériel de plage. Pour une planche longue, prévenez-moi la veille, je vérifie que tout rentre bien.",
      },
      {
        q: "Vous acceptez les groupes de 5-6 personnes ?",
        a: "Oui, avec un van 7 places sur demande. Prévenez-moi à la réservation pour que je vienne avec le bon véhicule.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  cpam: {
    title: "Taxi conventionné CPAM Bordeaux — Réserver, tiers payant, ALD",
    description:
      "Réserver un taxi conventionné Bordeaux : tiers payant, ALD 100 %, dialyse, chimio. Aussi VTC Bordeaux et taxi 7 places sur demande — 06 73 07 23 22.",
    intro:
      "Je suis José, taxi conventionné par l'Assurance Maladie à Bordeaux. Concrètement : si votre médecin vous a fait un bon de transport, vous n'avez rien à avancer. Je m'occupe de la facturation avec la CPAM et votre mutuelle. Je fais beaucoup de dialyse, de chimio, de consultations à Pellegrin, Haut-Lévêque et Saint-André.",
    sections: [
      {
        h: "Le bon de transport, on s'occupe du reste",
        p: "Vous me montrez votre bon signé par votre médecin (le CERFA), votre carte Vitale, éventuellement votre attestation de mutuelle. C'est tout. Je facture directement l'Assurance Maladie — vous ne sortez pas votre carte bleue à la fin de la course.",
      },
      {
        h: "ALD : pris en charge à 100 %",
        p: "Si vous êtes en Affection Longue Durée, tous vos trajets liés à cette pathologie sont couverts à 100 %, quelle que soit la distance. Même chose pour un accident du travail ou un transport maternité qui rentre dans les critères.",
      },
      {
        h: "Rendez-vous récurrents — je suis votre chauffeur habituel",
        p: "Dialyse trois fois par semaine, chimio, radiothérapie, séances de kiné : je mets en place un planning fixe. Toujours le même horaire, la même voiture, quelqu'un qui vous connaît. Beaucoup de mes patients apprécient de ne pas avoir à réexpliquer leur situation à chaque fois.",
      },
    ],
    faq: [
      {
        q: "Qu'est-ce qu'il me faut pour ne rien avancer ?",
        a: "Trois choses : le bon de transport signé par votre médecin (le CERFA), votre carte Vitale à jour, et votre attestation de mutuelle si vous en avez une. Je m'occupe du reste directement avec la CPAM.",
      },
      {
        q: "Je suis en ALD, c'est vraiment 100 % ?",
        a: "Oui, dès lors que le trajet est lié à votre affection longue durée. Pas de plafond kilométrique — que ce soit un rendez-vous à Bordeaux ou à Bergerac pour un spécialiste, c'est pris en charge.",
      },
      {
        q: "Vous pouvez venir tous les lundis-mercredis-vendredis pour ma dialyse ?",
        a: "C'est exactement ce que je fais pour plusieurs patients. On fixe un planning ensemble, j'arrive toujours à la même heure, je vous ramène après la séance. Appelez-moi au 06 73 07 23 22 pour qu'on mette ça en place.",
      },
      {
        q: "Vous transportez les personnes en fauteuil ?",
        a: "Je fais du transport assis conventionné. Pour un fauteuil roulant qui doit rester déplié pendant le trajet, il faut un VSL ou une ambulance — dites-le-moi et je vous oriente vers un collègue équipé.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
};

// --------- EN ----------
const EN: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Bordeaux Mérignac Airport Taxi — Book taxi or 7-seater VTC",
    description:
      "Book a Bordeaux Mérignac airport taxi: live flight tracking, flat fare, Bordeaux VTC or 7-seater taxi on request. Available 24/7 — call +33 6 73 07 23 22.",
    intro:
      "Book your taxi for Bordeaux-Mérignac airport in seconds. We track your flight in real time and adjust the pickup time — your driver is waiting on arrival, even if the flight is delayed or early.",
    sections: [
      { h: "Automatic flight tracking", p: "Share your flight number: the pickup time adjusts to the actual landing time at no extra cost." },
      { h: "Fixed price announced upfront", p: "No surprises. You know the Bordeaux ↔ Mérignac airport fare before you get in." },
      { h: "Luggage, families, groups", p: "Spacious vehicle, child seat on request, up to 7 seats for luggage and your loved ones." },
    ],
    faq: [
      { q: "How much is a taxi from central Bordeaux to Mérignac airport?", a: "Around €30–€45 in daytime depending on the pickup point. The exact fare is confirmed at booking." },
      { q: "Will the taxi wait if my flight is delayed?", a: "Yes. We track your flight live and adjust the schedule — a reasonable wait after landing is included." },
      { q: "Can I book in advance for an early-morning flight?", a: "Absolutely. We take bookings 24/7, including night and pre-dawn pickups." },
    ],
    ctaBook: CTA.en.book, ctaCall: CTA.en.call,
  },
  station: {
    title: "Bordeaux Saint-Jean Station Taxi — Book taxi or 7-seater VTC 24/7",
    description:
      "Book a taxi at Bordeaux Saint-Jean station: live TGV tracking, platform pickup, Bordeaux VTC or 7-seater taxi on request. 24/7 service.",
    intro:
      "A taxi is waiting for you at Bordeaux Saint-Jean station, or picks you up on time for your TGV. We track your train and adjust the pickup time automatically.",
    sections: [
      { h: "Pickup at Saint-Jean", p: "Meeting point agreed at booking: drop-off zone, forecourt, or car park. Your driver locates you and calls if needed." },
      { h: "Live TGV tracking", p: "Delay, early arrival, platform change: the schedule adjusts automatically. Nothing to do on your side." },
      { h: "To every destination", p: "From Saint-Jean to your hotel, Cité du Vin, Mérignac airport, Arcachon, Saint-Émilion or the whole metropolitan area." },
    ],
    faq: [
      { q: "Where does the taxi pick me up at Saint-Jean?", a: "At the meeting point agreed with you (main forecourt, drop-off or car park). We notify you as soon as the driver arrives." },
      { q: "Can I book for a night TGV?", a: "Yes, 24/7 service — including night trains and the first morning connections." },
      { q: "Do you count waiting minutes if my train is late?", a: "Not for standard delays: we track the train and adjust. Extended waits may be billed at the regulated rate." },
    ],
    ctaBook: CTA.en.book, ctaCall: CTA.en.call,
  },
  arcachon: {
    title: "Bordeaux → Arcachon Taxi — Book 7-seater taxi to Pyla & Cap-Ferret",
    description:
      "Book a Bordeaux → Arcachon taxi (Pyla, Cap-Ferret, the Bay): direct trip, flat fare, Bordeaux VTC or 7-seater taxi for families and luggage.",
    intro:
      "Reach the Arcachon Bay by taxi from central Bordeaux, Mérignac airport or Saint-Jean station. Direct trip, price known in advance, no transfer.",
    sections: [
      { h: "Door-to-door direct trip", p: "From your hotel, station or airport in Bordeaux, all the way to Arcachon town, the Dune du Pyla, Cap-Ferret or Andernos — no transfer." },
      { h: "Flat fare", p: "Price announced at booking, no hidden surcharge. Ideal for families, groups or tourists with luggage." },
      { h: "Return trip organised", p: "Book outbound AND return in one go. We collect you at the agreed time and place." },
    ],
    faq: [
      { q: "How long is the Bordeaux → Arcachon taxi trip?", a: "About 55 to 75 minutes depending on traffic and the arrival point on the Bay." },
      { q: "What price for a Bordeaux → Dune du Pyla taxi?", a: "The flat fare is confirmed at booking based on the pickup point and time." },
      { q: "Can I carry suitcases or beach gear?", a: "Yes, spacious vehicle up to 7 seats — luggage, strollers and beach gear accepted at no extra cost." },
    ],
    ctaBook: CTA.en.book, ctaCall: CTA.en.call,
  },
  cpam: {
    title: "Approved Medical Taxi Bordeaux — Book direct billing, ALD 100%",
    description:
      "Book an approved medical taxi in Bordeaux: direct billing (tiers payant), ALD 100%, dialysis, chemo. Bordeaux VTC and 7-seater taxi also on request.",
    intro:
      "Taxi approved by the French health insurance (CPAM) in Bordeaux. With your medical transport prescription, the trip is billed directly — no upfront payment thanks to third-party billing.",
    sections: [
      { h: "CPAM coverage", p: "Bring your transport voucher signed by your doctor. We handle billing directly with the health insurance." },
      { h: "ALD: 100% covered", p: "Under Long-Term Illness status (ALD), trips linked to the condition are 100% covered, regardless of distance." },
      { h: "Recurring appointments", p: "Dialysis, chemotherapy, radiotherapy, physiotherapy: we set up your regular trips with a fixed time and a familiar driver." },
    ],
    faq: [
      { q: "What's needed to benefit from direct billing?", a: "Your transport prescription (CERFA voucher) signed by your doctor, your Vitale card, and your complementary insurance certificate if applicable." },
      { q: "Am I fully covered under ALD?", a: "Yes, 100% by the health insurance for trips linked to your long-term condition, with no distance cap." },
      { q: "Can I book recurring trips (dialysis, chemo)?", a: "Yes, we set up a fixed schedule for your regular sessions. Contact us to organise your appointments." },
    ],
    ctaBook: CTA.en.book, ctaCall: CTA.en.call,
  },
};

// --------- ES ----------
const ES: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Taxi Burdeos aeropuerto Mérignac — Reservar taxi o VTC 7 plazas",
    description: "Reservar taxi Burdeos aeropuerto Mérignac: seguimiento de vuelo, tarifa fija, VTC Burdeos o taxi 7 plazas bajo petición. 24/7 — +33 6 73 07 23 22.",
    intro: "Reserve su taxi al aeropuerto de Burdeos-Mérignac en segundos. Seguimos su vuelo en tiempo real y ajustamos la hora de recogida: su conductor le espera a la salida, incluso con retraso o adelanto.",
    sections: [
      { h: "Seguimiento de vuelo automático", p: "Comuníquenos su número de vuelo: la hora de recogida se ajusta al aterrizaje real, sin coste adicional." },
      { h: "Tarifa fija anunciada por adelantado", p: "Sin sorpresas. Conoce el precio Burdeos ↔ Aeropuerto Mérignac antes de subir." },
      { h: "Equipaje, familias, grupos", p: "Vehículo espacioso, silla infantil bajo petición, hasta 7 plazas para equipaje y familia." },
    ],
    faq: [
      { q: "¿Cuánto cuesta un taxi del centro de Burdeos al aeropuerto?", a: "Unos 30–45 € de día según el punto de salida. La tarifa exacta se confirma al reservar." },
      { q: "¿El taxi espera si mi vuelo se retrasa?", a: "Sí. Seguimos su vuelo en directo y ajustamos el horario — una espera razonable tras el aterrizaje está incluida." },
      { q: "¿Puedo reservar por anticipado para un vuelo temprano?", a: "Por supuesto. Aceptamos reservas 24/7, incluidas las recogidas nocturnas o al amanecer." },
    ],
    ctaBook: CTA.es.book, ctaCall: CTA.es.call,
  },
  station: {
    title: "Taxi Estación Burdeos Saint-Jean — Reserva online 24/7",
    description: "Taxi a la estación Burdeos Saint-Jean: seguimiento de tren, recogida inmediata o reservada, precios claros. Disponible todos los días.",
    intro: "Un taxi le espera en la estación de Burdeos Saint-Jean, o le recoge para su TGV. Seguimos su tren y ajustamos la hora automáticamente.",
    sections: [
      { h: "Recogida en Saint-Jean", p: "Punto de encuentro acordado al reservar: zona de bajada, vestíbulo o aparcamiento. Su conductor le localiza y le llama si es necesario." },
      { h: "Seguimiento TGV en tiempo real", p: "Retraso, adelanto, cambio de vía: el horario se ajusta solo." },
      { h: "A cualquier destino", p: "Desde Saint-Jean a su hotel, Cité du Vin, aeropuerto Mérignac, Arcachon, Saint-Émilion o toda la metrópoli." },
    ],
    faq: [
      { q: "¿Dónde me recoge el taxi en Saint-Jean?", a: "En el punto de encuentro acordado (vestíbulo, zona de bajada o aparcamiento). Le avisamos cuando llegue el conductor." },
      { q: "¿Puedo reservar un TGV nocturno?", a: "Sí, servicio 24/7 — incluidos trenes nocturnos y primeras conexiones matutinas." },
      { q: "¿Cobran los minutos de espera si mi tren se retrasa?", a: "No para retrasos estándar: seguimos el tren y ajustamos. Una espera prolongada puede facturarse según tarifa regulada." },
    ],
    ctaBook: CTA.es.book, ctaCall: CTA.es.call,
  },
  arcachon: {
    title: "Taxi Burdeos → Arcachon — Traslado directo, precio claro",
    description: "Taxi de Burdeos a Arcachon (Bahía, Cap-Ferret, Pyla): trayecto directo, reserva anticipada, tarifa anunciada, vehículo cómodo para equipaje y familia.",
    intro: "Llegue a la Bahía de Arcachon en taxi desde el centro de Burdeos, el aeropuerto Mérignac o la estación Saint-Jean. Trayecto directo, precio conocido de antemano, sin transbordo.",
    sections: [
      { h: "Trayecto directo puerta a puerta", p: "Desde su hotel, estación o aeropuerto de Burdeos hasta Arcachon ciudad, la Duna del Pyla, Cap-Ferret o Andernos — sin transbordo." },
      { h: "Tarifa cerrada", p: "Precio anunciado al reservar, sin recargos ocultos. Ideal para familias, grupos o turistas con equipaje." },
      { h: "Vuelta organizada", p: "Reserve ida Y vuelta a la vez. Le recogemos a la hora y lugar acordados." },
    ],
    faq: [
      { q: "¿Cuánto tarda el trayecto Burdeos → Arcachon en taxi?", a: "Entre 55 y 75 minutos según el tráfico y el punto de llegada en la Bahía." },
      { q: "¿Qué precio para un taxi Burdeos → Duna del Pyla?", a: "La tarifa fija se confirma al reservar según el punto de salida y el horario." },
      { q: "¿Se pueden llevar maletas o material de playa?", a: "Sí, vehículo espacioso hasta 7 plazas — equipaje, sillitas y material de playa admitidos sin suplemento." },
    ],
    ctaBook: CTA.es.book, ctaCall: CTA.es.call,
  },
  cpam: {
    title: "Taxi Médico Concertado Burdeos — Facturación directa, ALD",
    description: "Taxi concertado con la Seguridad Social francesa en Burdeos: transporte médico sentado, facturación directa, ALD, diálisis, quimioterapia.",
    intro: "Taxi concertado con la Seguridad Social francesa (CPAM) en Burdeos. Con su prescripción médica de transporte, el trayecto se factura directamente — sin adelantar dinero.",
    sections: [
      { h: "Cobertura CPAM", p: "Presente su bono de transporte firmado por su médico. Nos encargamos de la facturación directamente." },
      { h: "ALD: cobertura al 100 %", p: "En Enfermedad de Larga Duración, los trayectos relacionados están cubiertos al 100 %, sin límite de distancia." },
      { h: "Citas recurrentes", p: "Diálisis, quimioterapia, radioterapia, fisioterapia: organizamos sus trayectos regulares con horario fijo y conductor habitual." },
    ],
    faq: [
      { q: "¿Qué necesito para la facturación directa?", a: "Su prescripción médica (bono CERFA) firmada, su tarjeta Vitale y su mutua si procede." },
      { q: "¿Estoy cubierto al 100 % en ALD?", a: "Sí, al 100 % por la Seguridad Social para los trayectos relacionados con su enfermedad, sin límite kilométrico." },
      { q: "¿Puedo reservar trayectos recurrentes (diálisis, quimio)?", a: "Sí, establecemos un horario fijo para sus sesiones regulares. Contáctenos para organizarlos." },
    ],
    ctaBook: CTA.es.book, ctaCall: CTA.es.call,
  },
};

// --------- PT ----------
const PT: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Táxi Aeroporto Bordéus-Mérignac — Serviço 24/7",
    description: "Táxi de e para o aeroporto Bordéus-Mérignac: seguimento de voo em tempo real, tarifa fixa transparente, veículo confortável, 7 dias por semana.",
    intro: "Reserve o seu táxi para o aeroporto de Bordéus-Mérignac em segundos. Seguimos o seu voo em tempo real e ajustamos a hora de recolha automaticamente.",
    sections: [
      { h: "Seguimento de voo automático", p: "Indique o número do voo: a hora de recolha ajusta-se à aterragem real, sem custo extra." },
      { h: "Tarifa fixa anunciada", p: "Sem surpresas. Conhece o preço Bordéus ↔ Aeroporto Mérignac antes de entrar." },
      { h: "Bagagem, famílias, grupos", p: "Veículo espaçoso, cadeira infantil sob pedido, até 7 lugares." },
    ],
    faq: [
      { q: "Quanto custa um táxi do centro de Bordéus ao aeroporto?", a: "Cerca de 30–45 € de dia consoante o ponto de partida. O preço exato é confirmado na reserva." },
      { q: "O táxi espera se o meu voo atrasar?", a: "Sim. Seguimos o voo em direto e ajustamos o horário — uma espera razoável após aterragem está incluída." },
      { q: "Posso reservar com antecedência para um voo de madrugada?", a: "Sim, aceitamos reservas 24/7, incluindo recolhas noturnas ou de madrugada." },
    ],
    ctaBook: CTA.pt.book, ctaCall: CTA.pt.call,
  },
  station: {
    title: "Táxi Estação Bordéus Saint-Jean — Reserva online 24/7",
    description: "Táxi para a estação Bordéus Saint-Jean: seguimento de comboio, recolha imediata ou reservada, preços claros.",
    intro: "Um táxi espera-o na estação de Bordéus Saint-Jean, ou vem buscá-lo para o seu TGV. Seguimos o comboio e ajustamos o horário automaticamente.",
    sections: [
      { h: "Recolha em Saint-Jean", p: "Ponto de encontro combinado na reserva: zona de largada, átrio principal ou parque." },
      { h: "Seguimento TGV em tempo real", p: "Atraso, adiantamento, mudança de via: o horário ajusta-se sozinho." },
      { h: "Para todos os destinos", p: "De Saint-Jean para o seu hotel, Cité du Vin, aeroporto Mérignac, Arcachon, Saint-Émilion ou toda a metrópole." },
    ],
    faq: [
      { q: "Onde o táxi me apanha na estação Saint-Jean?", a: "No ponto de encontro combinado. Avisamo-lo assim que o motorista chegar." },
      { q: "Posso reservar para um TGV noturno?", a: "Sim, serviço 24/7 — incluindo comboios noturnos e primeiras ligações da manhã." },
      { q: "Cobram os minutos de espera se o meu comboio atrasar?", a: "Não para atrasos padrão: seguimos o comboio e ajustamos. Esperas prolongadas podem ser faturadas à tarifa regulada." },
    ],
    ctaBook: CTA.pt.book, ctaCall: CTA.pt.call,
  },
  arcachon: {
    title: "Táxi Bordéus → Arcachon — Transferência direta, preço claro",
    description: "Táxi de Bordéus para Arcachon (Baía, Cap-Ferret, Pyla): trajeto direto, reserva antecipada, tarifa anunciada.",
    intro: "Chegue à Baía de Arcachon de táxi a partir do centro de Bordéus, do aeroporto Mérignac ou da estação Saint-Jean. Trajeto direto, preço conhecido, sem transbordo.",
    sections: [
      { h: "Trajeto direto porta-a-porta", p: "Do seu hotel, estação ou aeroporto até Arcachon cidade, a Duna do Pyla, Cap-Ferret ou Andernos — sem transbordo." },
      { h: "Tarifa fixa", p: "Preço anunciado na reserva, sem taxas escondidas. Ideal para famílias, grupos ou turistas com bagagem." },
      { h: "Regresso organizado", p: "Reserve ida E volta de uma vez. Vamos buscá-lo à hora e local combinados." },
    ],
    faq: [
      { q: "Quanto tempo demora Bordéus → Arcachon de táxi?", a: "Cerca de 55 a 75 minutos consoante o tráfego e o ponto de chegada." },
      { q: "Que preço para um táxi Bordéus → Duna do Pyla?", a: "A tarifa fixa é confirmada na reserva conforme o ponto de partida e o horário." },
      { q: "Pode transportar malas ou material de praia?", a: "Sim, veículo espaçoso até 7 lugares — bagagem, carrinhos e material de praia sem suplemento." },
    ],
    ctaBook: CTA.pt.book, ctaCall: CTA.pt.call,
  },
  cpam: {
    title: "Táxi Médico Convencionado Bordéus — Faturação direta, ALD",
    description: "Táxi convencionado com o seguro de saúde francês em Bordéus: transporte médico sentado, faturação direta, ALD, diálise, quimioterapia.",
    intro: "Táxi convencionado com o seguro de saúde francês (CPAM) em Bordéus. Com a sua prescrição médica de transporte, o trajeto é faturado diretamente.",
    sections: [
      { h: "Cobertura CPAM", p: "Traga o seu voucher de transporte assinado pelo seu médico. Tratamos da faturação diretamente." },
      { h: "ALD: cobertura a 100 %", p: "Em Doença de Longa Duração, os trajetos ligados estão cobertos a 100 %, sem limite de distância." },
      { h: "Consultas recorrentes", p: "Diálise, quimioterapia, radioterapia, fisioterapia: organizamos os trajetos regulares com horário fixo." },
    ],
    faq: [
      { q: "O que preciso para a faturação direta?", a: "A sua prescrição médica (voucher CERFA) assinada, o seu cartão Vitale e o seu seguro complementar se aplicável." },
      { q: "Estou coberto a 100 % em ALD?", a: "Sim, a 100 % pelo seguro de saúde para os trajetos ligados à sua doença, sem limite quilométrico." },
      { q: "Posso reservar trajetos recorrentes (diálise, quimio)?", a: "Sim, estabelecemos um horário fixo para as sessões regulares." },
    ],
    ctaBook: CTA.pt.book, ctaCall: CTA.pt.call,
  },
};

// --------- IT ----------
const IT: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Taxi Aeroporto Bordeaux-Mérignac — Servizio 24/7",
    description: "Taxi da e per l'aeroporto Bordeaux-Mérignac: monitoraggio volo in tempo reale, tariffa fissa trasparente, veicolo confortevole, 7 giorni su 7.",
    intro: "Prenoti il taxi per l'aeroporto di Bordeaux-Mérignac in pochi secondi. Monitoriamo il volo in tempo reale e adattiamo l'orario di ritiro automaticamente.",
    sections: [
      { h: "Monitoraggio volo automatico", p: "Ci comunichi il numero di volo: l'orario di ritiro si adatta all'atterraggio reale, senza costi aggiuntivi." },
      { h: "Tariffa fissa annunciata", p: "Nessuna sorpresa. Conosce il prezzo Bordeaux ↔ Aeroporto Mérignac prima di salire." },
      { h: "Bagagli, famiglie, gruppi", p: "Veicolo spazioso, seggiolino su richiesta, fino a 7 posti." },
    ],
    faq: [
      { q: "Quanto costa un taxi dal centro di Bordeaux all'aeroporto?", a: "Circa 30–45 € di giorno secondo il punto di partenza. La tariffa esatta è confermata alla prenotazione." },
      { q: "Il taxi aspetta se il mio volo è in ritardo?", a: "Sì. Monitoriamo il volo in diretta e adattiamo l'orario — un'attesa ragionevole dopo l'atterraggio è inclusa." },
      { q: "Posso prenotare in anticipo per un volo mattutino?", a: "Certamente. Accettiamo prenotazioni 24/7, comprese le corse notturne o all'alba." },
    ],
    ctaBook: CTA.it.book, ctaCall: CTA.it.call,
  },
  station: {
    title: "Taxi Stazione Bordeaux Saint-Jean — Prenotazione 24/7",
    description: "Taxi per la stazione Bordeaux Saint-Jean: monitoraggio treno, ritiro immediato o prenotato, prezzi chiari.",
    intro: "Un taxi l'attende alla stazione di Bordeaux Saint-Jean, o viene a prenderla per il TGV. Monitoriamo il treno e adattiamo l'orario automaticamente.",
    sections: [
      { h: "Ritiro a Saint-Jean", p: "Punto d'incontro concordato: zona di sosta, atrio o parcheggio. L'autista la localizza e la chiama se necessario." },
      { h: "Monitoraggio TGV in tempo reale", p: "Ritardo, anticipo, cambio binario: l'orario si adatta da solo." },
      { h: "Verso ogni destinazione", p: "Da Saint-Jean al suo hotel, Cité du Vin, aeroporto Mérignac, Arcachon, Saint-Émilion o tutta la metropoli." },
    ],
    faq: [
      { q: "Dove il taxi mi ritira alla stazione Saint-Jean?", a: "Al punto d'incontro concordato. La avvisiamo appena arriva l'autista." },
      { q: "Posso prenotare per un TGV notturno?", a: "Sì, servizio 24/7 — compresi treni notturni e primi collegamenti mattutini." },
      { q: "Contate i minuti d'attesa se il mio treno è in ritardo?", a: "No per ritardi standard: monitoriamo il treno e adattiamo. Un'attesa prolungata può essere fatturata alla tariffa regolamentata." },
    ],
    ctaBook: CTA.it.book, ctaCall: CTA.it.call,
  },
  arcachon: {
    title: "Taxi Bordeaux → Arcachon — Trasferimento diretto, prezzo chiaro",
    description: "Taxi da Bordeaux ad Arcachon (Baia, Cap-Ferret, Pyla): tragitto diretto, prenotazione anticipata, tariffa annunciata.",
    intro: "Raggiunga la Baia di Arcachon in taxi dal centro di Bordeaux, dall'aeroporto Mérignac o dalla stazione Saint-Jean. Tragitto diretto, prezzo noto in anticipo.",
    sections: [
      { h: "Tragitto diretto porta a porta", p: "Dal suo hotel, stazione o aeroporto fino ad Arcachon città, Dune du Pyla, Cap-Ferret o Andernos — senza cambi." },
      { h: "Tariffa forfettaria", p: "Prezzo annunciato alla prenotazione, senza costi nascosti." },
      { h: "Ritorno organizzato", p: "Prenoti andata E ritorno insieme. Veniamo a prenderla all'ora e nel luogo concordati." },
    ],
    faq: [
      { q: "Quanto dura il tragitto Bordeaux → Arcachon in taxi?", a: "Circa 55–75 minuti secondo il traffico e il punto d'arrivo sulla Baia." },
      { q: "Che prezzo per un taxi Bordeaux → Dune du Pyla?", a: "La tariffa forfettaria è confermata alla prenotazione secondo il punto di partenza e l'orario." },
      { q: "Posso trasportare valigie o attrezzatura da spiaggia?", a: "Sì, veicolo spazioso fino a 7 posti — bagagli, passeggini e attrezzatura da spiaggia senza supplemento." },
    ],
    ctaBook: CTA.it.book, ctaCall: CTA.it.call,
  },
  cpam: {
    title: "Taxi Medico Convenzionato Bordeaux — Fatturazione diretta, ALD",
    description: "Taxi convenzionato con l'assicurazione sanitaria francese a Bordeaux: trasporto medico seduto, fatturazione diretta, ALD, dialisi, chemioterapia.",
    intro: "Taxi convenzionato con l'assicurazione sanitaria francese (CPAM) a Bordeaux. Con la prescrizione medica di trasporto, la corsa è fatturata direttamente.",
    sections: [
      { h: "Copertura CPAM", p: "Porti il buono di trasporto firmato dal suo medico. Ci occupiamo della fatturazione direttamente." },
      { h: "ALD: copertura al 100 %", p: "In Malattia di Lunga Durata, i tragitti collegati sono coperti al 100 %, senza limiti di distanza." },
      { h: "Appuntamenti ricorrenti", p: "Dialisi, chemioterapia, radioterapia, fisioterapia: organizziamo i tragitti regolari con orario fisso." },
    ],
    faq: [
      { q: "Cosa serve per la fatturazione diretta?", a: "La prescrizione medica (buono CERFA) firmata, la tessera Vitale e l'assicurazione integrativa se applicabile." },
      { q: "Sono coperto al 100 % in ALD?", a: "Sì, al 100 % dall'assicurazione sanitaria per i tragitti collegati alla malattia, senza limite chilometrico." },
      { q: "Posso prenotare tragitti ricorrenti (dialisi, chemio)?", a: "Sì, stabiliamo un orario fisso per le sedute regolari." },
    ],
    ctaBook: CTA.it.book, ctaCall: CTA.it.call,
  },
};

// --------- AR ----------
const AR: Record<LandingKey, LandingContent> = {
  airport: {
    title: "سيارة أجرة مطار بوردو-ميرينياك — خدمة 24/7",
    description: "سيارة أجرة من وإلى مطار بوردو-ميرينياك: متابعة الرحلة في الوقت الفعلي، سعر ثابت شفاف، مركبة مريحة، 7 أيام في الأسبوع.",
    intro: "احجز سيارة أجرة إلى مطار بوردو-ميرينياك في ثوان. نتابع رحلتك في الوقت الفعلي ونضبط موعد الاستلام تلقائيًا.",
    sections: [
      { h: "متابعة تلقائية للرحلة", p: "زودنا برقم الرحلة: يتم ضبط موعد الاستلام حسب الهبوط الفعلي بدون تكلفة إضافية." },
      { h: "سعر ثابت معلن مسبقًا", p: "لا مفاجآت. تعرف السعر قبل الركوب." },
      { h: "أمتعة وعائلات ومجموعات", p: "مركبة واسعة، مقعد أطفال عند الطلب، حتى 7 مقاعد." },
    ],
    faq: [
      { q: "كم يكلف سيارة أجرة من وسط بوردو إلى المطار؟", a: "حوالي 30–45 يورو نهارًا حسب نقطة الانطلاق. يُؤكد السعر الدقيق عند الحجز." },
      { q: "هل تنتظر السيارة إذا تأخرت رحلتي؟", a: "نعم. نتابع رحلتك مباشرة ونضبط الجدول — انتظار معقول بعد الهبوط مشمول." },
      { q: "هل يمكنني الحجز مسبقًا لرحلة مبكرة؟", a: "بالتأكيد. نقبل الحجوزات على مدار الساعة." },
    ],
    ctaBook: CTA.ar.book, ctaCall: CTA.ar.call,
  },
  station: {
    title: "سيارة أجرة محطة بوردو سان-جان — حجز عبر الإنترنت 24/7",
    description: "سيارة أجرة إلى محطة بوردو سان-جان: متابعة القطار، استلام فوري أو محجوز، أسعار واضحة.",
    intro: "سيارة أجرة تنتظرك في محطة بوردو سان-جان، أو تأتي لاصطحابك لقطار TGV. نتابع قطارك ونضبط الموعد تلقائيًا.",
    sections: [
      { h: "الاستلام في سان-جان", p: "نقطة اللقاء متفق عليها عند الحجز." },
      { h: "متابعة TGV مباشرة", p: "التأخير أو التقديم أو تغيير الرصيف: يتم ضبط الجدول تلقائيًا." },
      { h: "إلى جميع الوجهات", p: "من سان-جان إلى فندقك، Cité du Vin، مطار ميرينياك، أركاشون، سانت-إميليون." },
    ],
    faq: [
      { q: "أين تلتقطني السيارة في محطة سان-جان؟", a: "في نقطة اللقاء المتفق عليها. نبلغك فور وصول السائق." },
      { q: "هل يمكنني الحجز لقطار ليلي؟", a: "نعم، خدمة 24/7 — تشمل القطارات الليلية." },
      { q: "هل تحسبون دقائق الانتظار إذا تأخر القطار؟", a: "لا للتأخيرات العادية: نتابع القطار ونضبط الموعد." },
    ],
    ctaBook: CTA.ar.book, ctaCall: CTA.ar.call,
  },
  arcachon: {
    title: "سيارة أجرة بوردو ← أركاشون — نقل مباشر، سعر واضح",
    description: "سيارة أجرة من بوردو إلى أركاشون (الخليج، كاب-فيري، بيلا): رحلة مباشرة، حجز مسبق، سعر معلن.",
    intro: "اذهب إلى خليج أركاشون بسيارة أجرة من وسط بوردو أو مطار ميرينياك أو محطة سان-جان. رحلة مباشرة، سعر معروف مسبقًا.",
    sections: [
      { h: "رحلة مباشرة من الباب إلى الباب", p: "من فندقك أو المحطة أو المطار إلى مدينة أركاشون، كثبان بيلا، كاب-فيري أو أنديرنوس — بدون تحويل." },
      { h: "سعر مقطوع", p: "سعر معلن عند الحجز، بدون رسوم خفية." },
      { h: "عودة منظمة", p: "احجز الذهاب والإياب معًا. نستقبلك في الوقت والمكان المتفق عليهما." },
    ],
    faq: [
      { q: "كم تستغرق رحلة بوردو ← أركاشون بالسيارة؟", a: "حوالي 55 إلى 75 دقيقة حسب حركة المرور." },
      { q: "ما سعر سيارة أجرة بوردو ← كثبان بيلا؟", a: "يتم تأكيد السعر المقطوع عند الحجز." },
      { q: "هل يمكن نقل الحقائب أو معدات الشاطئ؟", a: "نعم، مركبة واسعة حتى 7 مقاعد بدون رسوم إضافية." },
    ],
    ctaBook: CTA.ar.book, ctaCall: CTA.ar.call,
  },
  cpam: {
    title: "سيارة أجرة طبية معتمدة بوردو — فوترة مباشرة، ALD",
    description: "سيارة أجرة معتمدة من التأمين الصحي الفرنسي في بوردو: نقل طبي جالس، فوترة مباشرة، ALD، غسيل كلى، علاج كيميائي.",
    intro: "سيارة أجرة معتمدة من التأمين الصحي الفرنسي (CPAM) في بوردو. مع وصفة النقل الطبية، تُفوتر الرحلة مباشرة — بدون دفع مسبق.",
    sections: [
      { h: "تغطية CPAM", p: "أحضر قسيمة النقل الموقعة من طبيبك. نتولى الفوترة مباشرة." },
      { h: "ALD: تغطية 100 %", p: "في المرض طويل الأمد، الرحلات المرتبطة مغطاة 100 %، بدون حد للمسافة." },
      { h: "مواعيد متكررة", p: "غسيل الكلى، العلاج الكيميائي، الإشعاعي، العلاج الطبيعي: ننظم رحلاتك المنتظمة بجدول ثابت." },
    ],
    faq: [
      { q: "ما الذي أحتاجه للفوترة المباشرة؟", a: "وصفة النقل الطبية (قسيمة CERFA) موقعة، بطاقة Vitale، وتأمين تكميلي إن وجد." },
      { q: "هل أنا مغطى 100 % في ALD؟", a: "نعم، 100 % من التأمين الصحي للرحلات المرتبطة بمرضك، بدون حد للكيلومترات." },
      { q: "هل يمكنني حجز رحلات متكررة (غسيل، كيماوي)؟", a: "نعم، نضع جدولاً ثابتاً للجلسات المنتظمة." },
    ],
    ctaBook: CTA.ar.book, ctaCall: CTA.ar.call,
  },
};

const ALL: Record<Lang, Record<LandingKey, LandingContent>> = {
  fr: FR, en: EN, es: ES, pt: PT, it: IT, ar: AR,
};

export function getLanding(lang: Lang, key: LandingKey): LandingContent {
  return ALL[lang]?.[key] ?? FR[key];
}

export function getFaqTitle(lang: Lang): string {
  return CTA[lang]?.faqTitle ?? CTA.fr.faqTitle;
}

// Libellés pour la section "voir aussi" / cross-links (traduits)
export const RELATED_LABEL: Record<Lang, string> = {
  fr: "À lire aussi",
  en: "Read also",
  es: "Ver también",
  pt: "Ver também",
  it: "Vedi anche",
  ar: "اقرأ أيضًا",
};

export const LANDING_LABEL: Record<LandingKey, Record<Lang, string>> = {
  airport: {
    fr: "Taxi aéroport Mérignac",
    en: "Mérignac airport taxi",
    es: "Taxi aeropuerto Mérignac",
    pt: "Táxi aeroporto Mérignac",
    it: "Taxi aeroporto Mérignac",
    ar: "سيارة أجرة مطار ميرينياك",
  },
  station: {
    fr: "Taxi gare Saint-Jean",
    en: "Saint-Jean station taxi",
    es: "Taxi estación Saint-Jean",
    pt: "Táxi estação Saint-Jean",
    it: "Taxi stazione Saint-Jean",
    ar: "سيارة أجرة محطة سان-جان",
  },
  arcachon: {
    fr: "Taxi Bordeaux → Arcachon",
    en: "Bordeaux → Arcachon taxi",
    es: "Taxi Burdeos → Arcachon",
    pt: "Táxi Bordéus → Arcachon",
    it: "Taxi Bordeaux → Arcachon",
    ar: "سيارة أجرة بوردو ← أركاشون",
  },
  cpam: {
    fr: "Taxi conventionné CPAM",
    en: "CPAM approved medical taxi",
    es: "Taxi concertado CPAM",
    pt: "Táxi convencionado CPAM",
    it: "Taxi convenzionato CPAM",
    ar: "سيارة أجرة معتمدة CPAM",
  },
};

export const LANDING_PATH: Record<LandingKey, string> = {
  airport: "/taxi-aeroport-bordeaux-merignac",
  station: "/taxi-gare-saint-jean-bordeaux",
  arcachon: "/taxi-bordeaux-arcachon",
  cpam: "/taxi-conventionne-bordeaux",
};
