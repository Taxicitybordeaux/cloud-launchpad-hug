// Contenu multilingue pour les 4 pages SEO locales (aéroport, gare, Arcachon, conventionné)
// Langues : fr, en, es, pt, it, ar
// FR = voix de José (première personne, artisan, ton humain)

import type { Lang } from "@/i18n/dict";

export type LandingKey = "airport" | "station" | "arcachon" | "cpam";

export type LandingContent = {
  title: string; // <title> / og:title / h1
  description: string; // meta description / og:description / intro
  intro: string; // paragraphe d'introduction
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

// --------- FR (voix de José, humain, pas IA) ----------
const FR: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Taxi aéroport de Bordeaux 24/7 : Réserver avec José",
    description:
      "Réserver un taxi aéroport de Bordeaux : suivi de vol, prix annoncé à la réservation, véhicule 4 personnes maximum. José vous attend, jour & nuit. 06 73 07 23 22.",
    intro:
      "Bonjour, moi c'est José.\nJe fais la navette entre Bordeaux et l'aéroport de Bordeaux : le matin, la nuit, les jours fériés.\nVous me donnez votre numéro de vol, je suis l'atterrissage sur mon téléphone et je suis là quand vous sortez.\nPas d'attente, pas de mauvaise surprise sur le prix.",
    sections: [
      {
        h: "Un retard ? Prévenez-moi tout de suite",
        p: "Vous me passez le numéro de vol au moment de la réservation.\nSi votre vol est retardé, avancé, ou qu'une escale décale tout, prévenez-moi immédiatement par SMS ou par téléphone au 06 73 07 23 22 : j'ajuste l'heure de prise en charge tout de suite.",
      },
      {
        h: "Le prix, vous le connaissez avant de monter",
        p: "Je vous annonce une estimation du tarif dès la réservation, que ce soit Bordeaux centre, Bassins à flot, Caudéran ou Chartrons, peu importe le point de départ.\nUn prix annoncé clairement à l'avance, pas de mauvaise surprise.",
      },
      {
        h: "Familles, bagages, matériel : ça rentre",
        p: "Dans la berline on peut mettre facilement 3 ou 4 valises et il y a la place pour les poussettes.\nSiège enfant sur demande (dites-le-moi la veille).\nLe véhicule accueille 4 personnes maximum, je n'ai pas de van.",
      },
    ],
    faq: [
      {
        q: "Combien coûte un taxi de Bordeaux centre à l'aéroport de Bordeaux ?",
        a: "En journée, comptez entre 30 et 45 € selon l'endroit exact d'où je viens vous chercher.\nLa nuit et les dimanches, le tarif est un peu au-dessus (tarif réglementé).\nJe vous confirme le prix précis au moment de la réservation, avant que vous confirmiez.",
      },
      {
        q: "Et si mon vol a du retard ?",
        a: "En cas de retard, prévenez-moi tout de suite par SMS ou par téléphone au 06 73 07 23 22, j'ajuste l'heure de prise en charge.\nLe temps normal d'attente après l'atterrissage (récupération bagages, douane) est compris.",
      },
      {
        q: "Vous prenez les réservations pour un vol à 5h du matin ?",
        a: "Oui, je fais beaucoup de départs matinaux et de retours de nuit.\nRéservez la veille ou même quelques jours avant, je bloque le créneau et je suis devant chez vous à l'heure convenue.",
      },
      {
        q: "Je peux payer par carte ?",
        a: "Oui, carte, sans contact, Apple Pay, Google Pay, ou espèces.\nJe fournis une facture si vous en avez besoin pour vos notes de frais.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  station: {
    title: "Taxi Bordeaux gare Saint-Jean : Réserver avec José 24/7",
    description:
      "Réserver un taxi à la gare Bordeaux Saint-Jean : José suit votre TGV, prise en charge au quai, véhicule 4 personnes maximum. 7j/7, 24h/24.",
    intro:
      "Je m'appelle José et je viens régulièrement chercher mes clients à la gare Saint-Jean.\nQue vous descendiez d'un TGV Paris, d'un Ouigo ou d'un Intercités, je suis au point de rendez-vous qu'on aura fixé ensemble, pas besoin de tourner en rond avec vos valises pour me trouver.",
    sections: [
      {
        h: "On se retrouve où vous voulez à la gare",
        p: "Dépose-minute côté Belcier, parvis principal côté ville, ou parking Effia : vous me dites où vous êtes le plus à l'aise et je suis là.\nJe vous envoie un SMS avec la plaque de la voiture quand j'arrive.",
      },
      {
        h: "Un retard ? Prévenez-moi tout de suite",
        p: "Retard SNCF, changement de voie de dernière minute, TGV qui arrive en avance : prévenez-moi immédiatement par SMS ou par téléphone au 06 73 07 23 22, j'ajuste l'heure de prise en charge.",
      },
      {
        h: "De la gare à votre vraie destination",
        p: "Un hôtel dans les Chartrons, la Cité du Vin, l'aéroport pour une correspondance, un rendez-vous à l'aéroport de Bordeaux, ou directement Arcachon, Saint-Émilion, Cap-Ferret.\nC'est direct, sans changement.",
      },
    ],
    faq: [
      {
        q: "Où précisément est-ce que je vous retrouve à Saint-Jean ?",
        a: "On fixe le point de rendez-vous à la réservation.\nLe plus simple pour vous : dépose-minute côté Belcier (moins de monde), ou parvis principal si vous préférez sortir côté centre-ville.\nJe vous confirme par SMS dès que je suis devant.",
      },
      {
        q: "Vous prenez un TGV de nuit ou très tôt le matin ?",
        a: "Bien sûr.\nJe travaille 7j/7 24h/24, les trains de nuit et les premiers TGV du matin font partie de mon quotidien.",
      },
      {
        q: "Si mon train a 30 min de retard, je paie l'attente ?",
        a: "Non, pour un retard SNCF standard c'est intégré : prévenez-moi par SMS ou par téléphone dès que possible et j'ajuste mon arrivée.\nSur une attente vraiment longue (plusieurs heures), on en discute au moment de la réservation.",
      },
      {
        q: "Vous pouvez me déposer à un adresse pro pour un rendez-vous ?",
        a: "Oui, avec facture si besoin.\nJe peux aussi vous attendre pour un retour à la gare, dites-le-moi à la réservation, je bloque le créneau retour.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  arcachon: {
    title: "Taxi Bordeaux Arcachon : Réserver pour Pyla & Cap-Ferret",
    description:
      "Réserver un taxi Bordeaux → Arcachon, Pyla, Cap-Ferret : trajet direct, prix annoncé à la réservation, véhicule 4 personnes maximum pour familles et bagages. 06 73 07 23 22.",
    intro:
      "Bordeaux ↔ Arcachon, je le fais souvent : pour des touristes qui veulent voir la Dune du Pyla, pour des familles qui vont à Cap-Ferret le week-end, pour nos locaux bordelais, pour des habitués qui prennent le TER trop lent avec les valises.",
    sections: [
      {
        h: "Porte-à-porte, sans correspondance",
        p: "Je viens vous chercher où vous êtes, hôtel dans le centre de Bordeaux, gare Saint-Jean, aéroport de Bordeaux, et je vous dépose là où vous voulez : Arcachon ville, Pyla-sur-Mer au pied de la Dune, Cap-Ferret, Andernos, Lège.\nSans changement de véhicule.",
      },
      {
        h: "Le prix, vous le connaissez avant de partir",
        p: "Je vous donne une estimation de prix dès la réservation.\nPas de mauvaise surprise même si on est coincés sur l'A63 un vendredi soir.\nBien plus tranquille pour partir en vacances qu'un taxi qui vous stresse à chaque bouchon.",
      },
      {
        h: "Le retour, on l'organise en même temps",
        p: "Si vous savez déjà quand vous rentrez, on bloque l'aller ET le retour au moment de la réservation.\nJe suis devant votre location à l'heure dite, prêt à repartir.\nÇa marche aussi pour les mariages, les week-ends sur le Bassin.",
      },
    ],
    faq: [
      {
        q: "Il faut combien de temps entre Bordeaux et Arcachon ?",
        a: "Autour d'une heure hors circulation.\nUn vendredi soir d'été ou un dimanche de retour de week-end, comptez 1h15 à 1h30.\nJe regarde le trafic avant de partir pour choisir le meilleur itinéraire.",
      },
      {
        q: "Combien pour aller à la Dune du Pyla depuis Bordeaux centre ?",
        a: "Je vous donne une estimation précise à la réservation, ça dépend du point de départ précis et de l'heure (jour ou nuit).\nVous connaissez le prix avant de confirmer, pas de surprise à l'arrivée.",
      },
      {
        q: "J'ai des valises et une planche de surf, ça passe ?",
        a: "Sans problème.\nLa voiture est spacieuse, on peut charger des valises, des poussettes, du matériel de plage.\nPour une planche longue, prévenez-moi la veille, je vérifie que tout rentre bien.",
      },
      {
        q: "Vous acceptez les groupes de 5-6 personnes ?",
        a: "Le véhicule est limité à 4 personnes maximum, je n'ai pas de van.\nPour un groupe plus grand, il faudra prévoir deux courses ou un autre moyen de transport.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  cpam: {
    title: "Taxi conventionné CPAM Bordeaux : Réserver, tiers payant, ALD",
    description:
      "Réserver un taxi conventionné Bordeaux : tiers payant, ALD 100 %, dialyse, chimio. Véhicule 4 personnes maximum. 06 73 07 23 22.",
    intro:
      "Je suis José, taxi conventionné par l'Assurance Maladie à Bordeaux.\nConcrètement : si votre médecin vous a fait un bon de transport, vous n'avez rien à avancer.\nJe m'occupe de la facturation avec la CPAM et votre mutuelle.\nJe fais beaucoup de dialyse, de chimio, de consultations à l'hôpital.",
    sections: [
      {
        h: "Le bon de transport, on s'occupe du reste",
        p: "Vous me montrez votre bon signé par votre médecin (le CERFA), votre carte Vitale, éventuellement votre attestation de mutuelle.\nC'est tout.\nJe facture directement l'Assurance Maladie, vous ne sortez pas votre carte bleue à la fin de la course.",
      },
      {
        h: "ALD : pris en charge à 100 %",
        p: "Si vous êtes en Affection Longue Durée, tous vos trajets liés à cette pathologie sont couverts à 100 %, quelle que soit la distance.\nMême chose pour un accident du travail ou un transport maternité qui rentre dans les critères.",
      },
      {
        h: "Rendez-vous récurrents : je suis votre chauffeur habituel",
        p: "Dialyse trois fois par semaine, chimio, radiothérapie, séances de kiné : je mets en place un planning fixe.\nToujours le même horaire, la même voiture, quelqu'un qui vous connaît.\nBeaucoup de mes patients apprécient de ne pas avoir à réexpliquer leur situation à chaque fois.",
      },
    ],
    faq: [
      {
        q: "Qu'est-ce qu'il me faut pour ne rien avancer ?",
        a: "Trois choses : le bon de transport signé par votre médecin (le CERFA), votre carte Vitale à jour, et votre attestation de mutuelle si vous en avez une.\nJe m'occupe du reste directement avec la CPAM.",
      },
      {
        q: "Je suis en ALD, c'est vraiment 100 % ?",
        a: "Oui, dès lors que le trajet est lié à votre affection longue durée.\nPas de plafond kilométrique, que ce soit un rendez-vous à Bordeaux ou à Bergerac pour un spécialiste, c'est pris en charge.",
      },
      {
        q: "Vous pouvez venir tous les lundis-mercredis-vendredis pour ma dialyse ?",
        a: "C'est exactement ce que je fais pour plusieurs patients.\nOn fixe un planning ensemble, j'arrive toujours à la même heure, je vous ramène après la séance.\nAppelez-moi au 06 73 07 23 22 pour qu'on mette ça en place.",
      },
      {
        q: "Vous transportez les personnes en fauteuil ?",
        a: "Je fais du transport assis conventionné.\nPour un fauteuil roulant qui doit rester déplié pendant le trajet, il faut un VSL ou une ambulance, dites-le-moi et je vous oriente vers un collègue équipé.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
};

// --------- EN ----------
const EN: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Bordeaux Airport Taxi : Book with José 24/7",
    description:
      "Book a Bordeaux airport taxi: live flight tracking, price quoted at booking, vehicle for up to 4 people. Available 24/7. Call +33 6 73 07 23 22.",
    intro:
      "Book your taxi for Bordeaux airport in seconds.\nWe track your flight in real time and adjust the pickup time: your driver is waiting on arrival, even if the flight is delayed or early.",
    sections: [
      {
        h: "Delayed flight? Let José know right away",
        p: "Share your flight number when booking. If your flight is delayed or early, text or call José straight away at +33 6 73 07 23 22 so he can adjust the pickup time.",
      },
      {
        h: "Price quoted upfront",
        p: "No surprises.\nYou get a price estimate for the Bordeaux airport fare before you get in.",
      },
      {
        h: "Luggage and families",
        p: "Spacious vehicle, child seat on request, up to 4 people with luggage.",
      },
    ],
    faq: [
      {
        q: "How much is a taxi from central Bordeaux to the airport?",
        a: "Around €30-€45 in daytime depending on the pickup point.\nThe exact fare is confirmed at booking.",
      },
      {
        q: "Will the taxi wait if my flight is delayed?",
        a: "If your flight is delayed, text or call José right away at +33 6 73 07 23 22 so he can adjust the pickup time.\nA reasonable wait after landing is included.",
      },
      {
        q: "Can I book in advance for an early-morning flight?",
        a: "Absolutely.\nWe take bookings 24/7, including night and pre-dawn pickups.",
      },
    ],
    ctaBook: CTA.en.book,
    ctaCall: CTA.en.call,
  },
  station: {
    title: "Bordeaux Saint-Jean Station Taxi : Book with José 24/7",
    description:
      "Book a taxi at Bordeaux Saint-Jean station: live TGV tracking, platform pickup, vehicle for up to 4 people. 24/7 service.",
    intro:
      "A taxi is waiting for you at Bordeaux Saint-Jean station, or picks you up on time for your TGV.\nWe track your train and adjust the pickup time automatically.",
    sections: [
      {
        h: "Pickup at Saint-Jean",
        p: "Meeting point agreed at booking: drop-off zone, forecourt, or car park.\nYour driver locates you and calls if needed.",
      },
      {
        h: "Delayed train? Let José know right away",
        p: "Delay, early arrival, platform change: text or call José right away at +33 6 73 07 23 22 so he can adjust the pickup time.",
      },
      {
        h: "To every destination",
        p: "From Saint-Jean to your hotel, Cité du Vin, Bordeaux airport, Arcachon, Saint-Émilion or the whole metropolitan area.",
      },
    ],
    faq: [
      {
        q: "Where does the taxi pick me up at Saint-Jean?",
        a: "At the meeting point agreed with you (main forecourt, drop-off or car park).\nWe notify you as soon as the driver arrives.",
      },
      {
        q: "Can I book for a night TGV?",
        a: "Yes, 24/7 service, including night trains and the first morning connections.",
      },
      {
        q: "Do you count waiting minutes if my train is late?",
        a: "Not for standard delays: just text or call José right away and he'll adjust his arrival.\nExtended waits may be billed at the regulated rate.",
      },
    ],
    ctaBook: CTA.en.book,
    ctaCall: CTA.en.call,
  },
  arcachon: {
    title: "Bordeaux → Arcachon Taxi : Direct to Pyla & Cap-Ferret",
    description:
      "Book a Bordeaux → Arcachon taxi (Pyla, Cap-Ferret, the Bay): direct trip, price quoted at booking, vehicle for up to 4 people with luggage.",
    intro:
      "Reach the Arcachon Bay by taxi from central Bordeaux, Bordeaux airport or Saint-Jean station.\nDirect trip, price known in advance, no transfer.",
    sections: [
      {
        h: "Door-to-door direct trip",
        p: "From your hotel, station or airport in Bordeaux, all the way to Arcachon town, the Dune du Pyla, Cap-Ferret or Andernos, with no transfer.",
      },
      {
        h: "Price quoted upfront",
        p: "Price estimate given at booking, no hidden surcharge.\nIdeal for families or tourists with luggage.",
      },
      {
        h: "Return trip organised",
        p: "Book outbound AND return in one go.\nWe collect you at the agreed time and place.",
      },
    ],
    faq: [
      {
        q: "How long is the Bordeaux → Arcachon taxi trip?",
        a: "About 55 to 75 minutes depending on traffic and the arrival point on the Bay.",
      },
      {
        q: "What price for a Bordeaux → Dune du Pyla taxi?",
        a: "A price estimate is given at booking based on the pickup point and time.",
      },
      {
        q: "Can I carry suitcases or beach gear?",
        a: "Yes, spacious vehicle for up to 4 people: luggage, strollers and beach gear accepted at no extra cost.",
      },
    ],
    ctaBook: CTA.en.book,
    ctaCall: CTA.en.call,
  },
  cpam: {
    title: "Approved Medical Taxi Bordeaux : Book direct billing, ALD 100%",
    description:
      "Book an approved medical taxi in Bordeaux: direct billing (tiers payant), ALD 100%, dialysis, chemo. Vehicle for up to 4 people.",
    intro:
      "Taxi approved by the French health insurance (CPAM) in Bordeaux.\nWith your medical transport prescription, the trip is billed directly, no upfront payment thanks to third-party billing.",
    sections: [
      {
        h: "CPAM coverage",
        p: "Bring your transport voucher signed by your doctor.\nWe handle billing directly with the health insurance.",
      },
      {
        h: "ALD: 100% covered",
        p: "Under Long-Term Illness status (ALD), trips linked to the condition are 100% covered, regardless of distance.",
      },
      {
        h: "Recurring appointments",
        p: "Dialysis, chemotherapy, radiotherapy, physiotherapy: we set up your regular trips with a fixed time and a familiar driver.",
      },
    ],
    faq: [
      {
        q: "What's needed to benefit from direct billing?",
        a: "Your transport prescription (CERFA voucher) signed by your doctor, your Vitale card, and your complementary insurance certificate if applicable.",
      },
      {
        q: "Am I fully covered under ALD?",
        a: "Yes, 100% by the health insurance for trips linked to your long-term condition, with no distance cap.",
      },
      {
        q: "Can I book recurring trips (dialysis, chemo)?",
        a: "Yes, we set up a fixed schedule for your regular sessions.\nContact us to organise your appointments.",
      },
    ],
    ctaBook: CTA.en.book,
    ctaCall: CTA.en.call,
  },
};

// --------- ES ----------
const ES: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Taxi Burdeos aeropuerto : Reservar taxi con José 24/7",
    description:
      "Reservar taxi Burdeos aeropuerto: seguimiento de vuelo, precio indicado al reservar, vehículo hasta 4 personas. 24/7. +33 6 73 07 23 22.",
    intro:
      "Reserve su taxi al aeropuerto de Burdeos en segundos.\nSeguimos su vuelo en tiempo real y ajustamos la hora de recogida: su conductor le espera a la salida, incluso con retraso o adelanto.",
    sections: [
      {
        h: "¿Vuelo con retraso? Avise a José enseguida",
        p: "Comuníquenos su número de vuelo al reservar.\nSi su vuelo se retrasa o se adelanta, avise a José de inmediato por SMS o llamada al +33 6 73 07 23 22 para que ajuste la hora de recogida.",
      },
      {
        h: "Precio indicado por adelantado",
        p: "Sin sorpresas.\nConoce una estimación del precio Burdeos ↔ Aeropuerto antes de subir.",
      },
      {
        h: "Equipaje y familias",
        p: "Vehículo espacioso, silla infantil bajo petición, hasta 4 personas con equipaje.",
      },
    ],
    faq: [
      {
        q: "¿Cuánto cuesta un taxi del centro de Burdeos al aeropuerto?",
        a: "Unos 30-45 € de día según el punto de salida.\nLa tarifa exacta se confirma al reservar.",
      },
      {
        q: "¿El taxi espera si mi vuelo se retrasa?",
        a: "Si su vuelo se retrasa, avise a José de inmediato por SMS o llamada al +33 6 73 07 23 22 para que ajuste la hora de recogida.\nUna espera razonable tras el aterrizaje está incluida.",
      },
      {
        q: "¿Puedo reservar por anticipado para un vuelo temprano?",
        a: "Por supuesto.\nAceptamos reservas 24/7, incluidas las recogidas nocturnas o al amanecer.",
      },
    ],
    ctaBook: CTA.es.book,
    ctaCall: CTA.es.call,
  },
  station: {
    title: "Taxi Burdeos estación Saint-Jean : Reservar taxi con José 24/7",
    description:
      "Reservar taxi en la estación Burdeos Saint-Jean: seguimiento TGV, recogida en el andén, vehículo hasta 4 personas. 24/7.",
    intro:
      "Un taxi le espera en la estación de Burdeos Saint-Jean, o le recoge para su TGV.\nSeguimos su tren y ajustamos la hora automáticamente.",
    sections: [
      {
        h: "Recogida en Saint-Jean",
        p: "Punto de encuentro acordado al reservar: zona de bajada, vestíbulo o aparcamiento.\nSu conductor le localiza y le llama si es necesario.",
      },
      {
        h: "¿Tren con retraso? Avise a José enseguida",
        p: "Retraso, adelanto, cambio de vía: avise a José por SMS o llamada al +33 6 73 07 23 22 para que ajuste la hora de recogida.",
      },
      {
        h: "A cualquier destino",
        p: "Desde Saint-Jean a su hotel, Cité du Vin, aeropuerto de Burdeos, Arcachon, Saint-Émilion o toda la metrópoli.",
      },
    ],
    faq: [
      {
        q: "¿Dónde me recoge el taxi en Saint-Jean?",
        a: "En el punto de encuentro acordado (vestíbulo, zona de bajada o aparcamiento).\nLe avisamos cuando llegue el conductor.",
      },
      {
        q: "¿Puedo reservar un TGV nocturno?",
        a: "Sí, servicio 24/7, incluidos trenes nocturnos y primeras conexiones matutinas.",
      },
      {
        q: "¿Cobran los minutos de espera si mi tren se retrasa?",
        a: "No para retrasos estándar: avísenos por SMS o llamada en cuanto lo sepa y ajustamos la llegada.\nUna espera prolongada puede facturarse según tarifa regulada.",
      },
    ],
    ctaBook: CTA.es.book,
    ctaCall: CTA.es.call,
  },
  arcachon: {
    title: "Taxi Burdeos → Arcachon : Reservar taxi Pyla & Cap-Ferret",
    description:
      "Reservar taxi Burdeos → Arcachon (Pyla, Cap-Ferret, Bahía): trayecto directo, precio indicado al reservar, vehículo hasta 4 personas con equipaje.",
    intro:
      "Llegue a la Bahía de Arcachon en taxi desde el centro de Burdeos, el aeropuerto de Burdeos o la estación Saint-Jean.\nTrayecto directo, precio conocido de antemano, sin transbordo.",
    sections: [
      {
        h: "Trayecto directo puerta a puerta",
        p: "Desde su hotel, estación o aeropuerto de Burdeos hasta Arcachon ciudad, la Duna del Pyla, Cap-Ferret o Andernos, sin transbordo.",
      },
      {
        h: "Precio indicado por adelantado",
        p: "Estimación de precio al reservar, sin recargos ocultos.\nIdeal para familias o turistas con equipaje.",
      },
      { h: "Vuelta organizada", p: "Reserve ida Y vuelta a la vez.\nLe recogemos a la hora y lugar acordados." },
    ],
    faq: [
      {
        q: "¿Cuánto tarda el trayecto Burdeos → Arcachon en taxi?",
        a: "Entre 55 y 75 minutos según el tráfico y el punto de llegada en la Bahía.",
      },
      {
        q: "¿Qué precio para un taxi Burdeos → Duna del Pyla?",
        a: "Se da una estimación al reservar según el punto de salida y el horario.",
      },
      {
        q: "¿Se pueden llevar maletas o material de playa?",
        a: "Sí, vehículo espacioso hasta 4 personas: equipaje, sillitas y material de playa admitidos sin suplemento.",
      },
    ],
    ctaBook: CTA.es.book,
    ctaCall: CTA.es.call,
  },
  cpam: {
    title: "Taxi concertado CPAM Burdeos : Reservar, facturación directa, ALD",
    description:
      "Reservar taxi concertado en Burdeos: facturación directa (tiers payant), ALD 100 %, diálisis, quimio. Vehículo hasta 4 personas.",
    intro:
      "Taxi concertado con la Seguridad Social francesa (CPAM) en Burdeos.\nCon su prescripción médica de transporte, el trayecto se factura directamente, sin adelantar dinero.",
    sections: [
      {
        h: "Cobertura CPAM",
        p: "Presente su bono de transporte firmado por su médico.\nNos encargamos de la facturación directamente.",
      },
      {
        h: "ALD: cobertura al 100 %",
        p: "En Enfermedad de Larga Duración, los trayectos relacionados están cubiertos al 100 %, sin límite de distancia.",
      },
      {
        h: "Citas recurrentes",
        p: "Diálisis, quimioterapia, radioterapia, fisioterapia: organizamos sus trayectos regulares con horario fijo y conductor habitual.",
      },
    ],
    faq: [
      {
        q: "¿Qué necesito para la facturación directa?",
        a: "Su prescripción médica (bono CERFA) firmada, su tarjeta Vitale y su mutua si procede.",
      },
      {
        q: "¿Estoy cubierto al 100 % en ALD?",
        a: "Sí, al 100 % por la Seguridad Social para los trayectos relacionados con su enfermedad, sin límite kilométrico.",
      },
      {
        q: "¿Puedo reservar trayectos recurrentes (diálisis, quimio)?",
        a: "Sí, establecemos un horario fijo para sus sesiones regulares.\nContáctenos para organizarlos.",
      },
    ],
    ctaBook: CTA.es.book,
    ctaCall: CTA.es.call,
  },
};

// --------- PT ----------
const PT: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Táxi Bordéus aeroporto : Reservar táxi com José 24/7",
    description:
      "Reservar táxi Bordéus aeroporto: seguimento de voo, preço indicado na reserva, veículo até 4 pessoas. 24/7. +33 6 73 07 23 22.",
    intro:
      "Reserve o seu táxi para o aeroporto de Bordéus em segundos.\nSeguimos o seu voo em tempo real e ajustamos a hora de recolha automaticamente.",
    sections: [
      {
        h: "Voo atrasado? Avise o José de imediato",
        p: "Indique o número do voo na reserva.\nSe o voo atrasar ou adiantar, avise o José de imediato por SMS ou telefone para o +33 6 73 07 23 22 para que ajuste a hora de recolha.",
      },
      {
        h: "Preço indicado antecipadamente",
        p: "Sem surpresas.\nConhece uma estimativa do preço Bordéus ↔ Aeroporto antes de entrar.",
      },
      { h: "Bagagem e famílias", p: "Veículo espaçoso, cadeira infantil sob pedido, até 4 pessoas com bagagem." },
    ],
    faq: [
      {
        q: "Quanto custa um táxi do centro de Bordéus ao aeroporto?",
        a: "Cerca de 30-45 € de dia consoante o ponto de partida.\nO preço exato é confirmado na reserva.",
      },
      {
        q: "O táxi espera se o meu voo atrasar?",
        a: "Se o voo atrasar, avise o José de imediato por SMS ou telefone para o +33 6 73 07 23 22 para que ajuste a hora de recolha.\nUma espera razoável após aterragem está incluída.",
      },
      {
        q: "Posso reservar com antecedência para um voo de madrugada?",
        a: "Sim, aceitamos reservas 24/7, incluindo recolhas noturnas ou de madrugada.",
      },
    ],
    ctaBook: CTA.pt.book,
    ctaCall: CTA.pt.call,
  },
  station: {
    title: "Táxi Bordéus estação Saint-Jean : Reservar táxi com José 24/7",
    description:
      "Reservar táxi na estação Bordéus Saint-Jean: seguimento TGV, recolha na plataforma, veículo até 4 pessoas. 24/7.",
    intro:
      "Um táxi espera-o na estação de Bordéus Saint-Jean, ou vem buscá-lo para o seu TGV.\nSeguimos o comboio e ajustamos o horário automaticamente.",
    sections: [
      {
        h: "Recolha em Saint-Jean",
        p: "Ponto de encontro combinado na reserva: zona de largada, átrio principal ou parque.",
      },
      {
        h: "Comboio atrasado? Avise o José de imediato",
        p: "Atraso, adiantamento, mudança de via: avise o José por SMS ou telefone para o +33 6 73 07 23 22 para que ajuste a hora de recolha.",
      },
      {
        h: "Para todos os destinos",
        p: "De Saint-Jean para o seu hotel, Cité du Vin, aeroporto de Bordéus, Arcachon, Saint-Émilion ou toda a metrópole.",
      },
    ],
    faq: [
      {
        q: "Onde o táxi me apanha na estação Saint-Jean?",
        a: "No ponto de encontro combinado.\nAvisamo-lo assim que o motorista chegar.",
      },
      {
        q: "Posso reservar para um TGV noturno?",
        a: "Sim, serviço 24/7, incluindo comboios noturnos e primeiras ligações da manhã.",
      },
      {
        q: "Cobram os minutos de espera se o meu comboio atrasar?",
        a: "Não para atrasos padrão: avise-nos por SMS ou telefone assim que souber e ajustamos a chegada.\nEsperas prolongadas podem ser faturadas à tarifa regulada.",
      },
    ],
    ctaBook: CTA.pt.book,
    ctaCall: CTA.pt.call,
  },
  arcachon: {
    title: "Táxi Bordéus → Arcachon : Reservar táxi Pyla & Cap-Ferret",
    description:
      "Reservar táxi Bordéus → Arcachon (Pyla, Cap-Ferret, Baía): trajeto direto, preço indicado na reserva, veículo até 4 pessoas com bagagem.",
    intro:
      "Chegue à Baía de Arcachon de táxi a partir do centro de Bordéus, do aeroporto de Bordéus ou da estação Saint-Jean.\nTrajeto direto, preço conhecido, sem transbordo.",
    sections: [
      {
        h: "Trajeto direto porta-a-porta",
        p: "Do seu hotel, estação ou aeroporto até Arcachon cidade, a Duna do Pyla, Cap-Ferret ou Andernos, sem transbordo.",
      },
      {
        h: "Preço indicado antecipadamente",
        p: "Estimativa de preço na reserva, sem taxas escondidas.\nIdeal para famílias ou turistas com bagagem.",
      },
      { h: "Regresso organizado", p: "Reserve ida E volta de uma vez.\nVamos buscá-lo à hora e local combinados." },
    ],
    faq: [
      {
        q: "Quanto tempo demora Bordéus → Arcachon de táxi?",
        a: "Cerca de 55 a 75 minutos consoante o tráfego e o ponto de chegada.",
      },
      {
        q: "Que preço para um táxi Bordéus → Duna do Pyla?",
        a: "É dada uma estimativa na reserva conforme o ponto de partida e o horário.",
      },
      {
        q: "Pode transportar malas ou material de praia?",
        a: "Sim, veículo espaçoso até 4 pessoas: bagagem, carrinhos e material de praia sem suplemento.",
      },
    ],
    ctaBook: CTA.pt.book,
    ctaCall: CTA.pt.call,
  },
  cpam: {
    title: "Táxi convencionado CPAM Bordéus : Reservar, faturação direta, ALD",
    description:
      "Reservar táxi convencionado em Bordéus: faturação direta (tiers payant), ALD 100%, diálise, quimio. Veículo até 4 pessoas.",
    intro:
      "Táxi convencionado com o seguro de saúde francês (CPAM) em Bordéus.\nCom a sua prescrição médica de transporte, o trajeto é faturado diretamente.",
    sections: [
      {
        h: "Cobertura CPAM",
        p: "Traga o seu voucher de transporte assinado pelo seu médico.\nTratamos da faturação diretamente.",
      },
      {
        h: "ALD: cobertura a 100 %",
        p: "Em Doença de Longa Duração, os trajetos ligados estão cobertos a 100 %, sem limite de distância.",
      },
      {
        h: "Consultas recorrentes",
        p: "Diálise, quimioterapia, radioterapia, fisioterapia: organizamos os trajetos regulares com horário fixo.",
      },
    ],
    faq: [
      {
        q: "O que preciso para a faturação direta?",
        a: "A sua prescrição médica (voucher CERFA) assinada, o seu cartão Vitale e o seu seguro complementar se aplicável.",
      },
      {
        q: "Estou coberto a 100 % em ALD?",
        a: "Sim, a 100 % pelo seguro de saúde para os trajetos ligados à sua doença, sem limite quilométrico.",
      },
      {
        q: "Posso reservar trajetos recorrentes (diálise, quimio)?",
        a: "Sim, estabelecemos um horário fixo para as sessões regulares.",
      },
    ],
    ctaBook: CTA.pt.book,
    ctaCall: CTA.pt.call,
  },
};

// --------- IT ----------
const IT: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Taxi Bordeaux aeroporto : Prenotare taxi con José 24/7",
    description:
      "Prenotare un taxi Bordeaux aeroporto: monitoraggio volo, prezzo indicato alla prenotazione, veicolo fino a 4 persone. 24/7. +33 6 73 07 23 22.",
    intro:
      "Prenoti il taxi per l'aeroporto di Bordeaux in pochi secondi.\nMonitoriamo il volo in tempo reale e adattiamo l'orario di ritiro automaticamente.",
    sections: [
      {
        h: "Volo in ritardo? Avvisi subito José",
        p: "Ci comunichi il numero di volo alla prenotazione.\nSe il volo è in ritardo o in anticipo, avvisi subito José via SMS o telefono al +33 6 73 07 23 22 in modo che possa adattare l'orario di ritiro.",
      },
      {
        h: "Prezzo indicato in anticipo",
        p: "Nessuna sorpresa.\nConosce una stima del prezzo Bordeaux ↔ Aeroporto prima di salire.",
      },
      { h: "Bagagli e famiglie", p: "Veicolo spazioso, seggiolino su richiesta, fino a 4 persone con bagagli." },
    ],
    faq: [
      {
        q: "Quanto costa un taxi dal centro di Bordeaux all'aeroporto?",
        a: "Circa 30-45 € di giorno secondo il punto di partenza.\nLa tariffa esatta è confermata alla prenotazione.",
      },
      {
        q: "Il taxi aspetta se il mio volo è in ritardo?",
        a: "Se il volo è in ritardo, avvisi subito José via SMS o telefono al +33 6 73 07 23 22 in modo che possa adattare l'orario.\nUn'attesa ragionevole dopo l'atterraggio è inclusa.",
      },
      {
        q: "Posso prenotare in anticipo per un volo mattutino?",
        a: "Certamente.\nAccettiamo prenotazioni 24/7, comprese le corse notturne o all'alba.",
      },
    ],
    ctaBook: CTA.it.book,
    ctaCall: CTA.it.call,
  },
  station: {
    title: "Taxi Bordeaux stazione Saint-Jean : Prenotare taxi con José 24/7",
    description:
      "Prenotare un taxi alla stazione Bordeaux Saint-Jean: monitoraggio TGV, ritiro sul binario, veicolo fino a 4 persone. 24/7.",
    intro:
      "Un taxi l'attende alla stazione di Bordeaux Saint-Jean, o viene a prenderla per il TGV.\nMonitoriamo il treno e adattiamo l'orario automaticamente.",
    sections: [
      {
        h: "Ritiro a Saint-Jean",
        p: "Punto d'incontro concordato: zona di sosta, atrio o parcheggio.\nL'autista la localizza e la chiama se necessario.",
      },
      {
        h: "Treno in ritardo? Avvisi subito José",
        p: "Ritardo, anticipo, cambio binario: avvisi José via SMS o telefono al +33 6 73 07 23 22 in modo che possa adattare l'orario di ritiro.",
      },
      {
        h: "Verso ogni destinazione",
        p: "Da Saint-Jean al suo hotel, Cité du Vin, aeroporto di Bordeaux, Arcachon, Saint-Émilion o tutta la metropoli.",
      },
    ],
    faq: [
      {
        q: "Dove il taxi mi ritira alla stazione Saint-Jean?",
        a: "Al punto d'incontro concordato.\nLa avvisiamo appena arriva l'autista.",
      },
      {
        q: "Posso prenotare per un TGV notturno?",
        a: "Sì, servizio 24/7, compresi treni notturni e primi collegamenti mattutini.",
      },
      {
        q: "Contate i minuti d'attesa se il mio treno è in ritardo?",
        a: "No per ritardi standard: ci avvisi via SMS o telefono appena possibile e adattiamo l'arrivo.\nUn'attesa prolungata può essere fatturata alla tariffa regolamentata.",
      },
    ],
    ctaBook: CTA.it.book,
    ctaCall: CTA.it.call,
  },
  arcachon: {
    title: "Taxi Bordeaux → Arcachon : Prenotare taxi Pyla & Cap-Ferret",
    description:
      "Prenotare un taxi Bordeaux → Arcachon (Pyla, Cap-Ferret, Baia): tragitto diretto, prezzo indicato alla prenotazione, veicolo fino a 4 persone con bagagli.",
    intro:
      "Raggiunga la Baia di Arcachon in taxi dal centro di Bordeaux, dall'aeroporto di Bordeaux o dalla stazione Saint-Jean.\nTragitto diretto, prezzo noto in anticipo.",
    sections: [
      {
        h: "Tragitto diretto porta a porta",
        p: "Dal suo hotel, stazione o aeroporto fino ad Arcachon città, Dune du Pyla, Cap-Ferret o Andernos, senza cambi.",
      },
      { h: "Prezzo indicato in anticipo", p: "Stima di prezzo alla prenotazione, senza costi nascosti." },
      {
        h: "Ritorno organizzato",
        p: "Prenoti andata E ritorno insieme.\nVeniamo a prenderla all'ora e nel luogo concordati.",
      },
    ],
    faq: [
      {
        q: "Quanto dura il tragitto Bordeaux → Arcachon in taxi?",
        a: "Circa 55-75 minuti secondo il traffico e il punto d'arrivo sulla Baia.",
      },
      {
        q: "Che prezzo per un taxi Bordeaux → Dune du Pyla?",
        a: "Viene data una stima alla prenotazione secondo il punto di partenza e l'orario.",
      },
      {
        q: "Posso trasportare valigie o attrezzatura da spiaggia?",
        a: "Sì, veicolo spazioso fino a 4 persone: bagagli, passeggini e attrezzatura da spiaggia senza supplemento.",
      },
    ],
    ctaBook: CTA.it.book,
    ctaCall: CTA.it.call,
  },
  cpam: {
    title: "Taxi convenzionato CPAM Bordeaux : Prenotare, fatturazione diretta, ALD",
    description:
      "Prenotare un taxi convenzionato a Bordeaux: fatturazione diretta (tiers payant), ALD 100%, dialisi, chemio. Veicolo fino a 4 persone.",
    intro:
      "Taxi convenzionato con l'assicurazione sanitaria francese (CPAM) a Bordeaux.\nCon la prescrizione medica di trasporto, la corsa è fatturata direttamente.",
    sections: [
      {
        h: "Copertura CPAM",
        p: "Porti il buono di trasporto firmato dal suo medico.\nCi occupiamo della fatturazione direttamente.",
      },
      {
        h: "ALD: copertura al 100 %",
        p: "In Malattia di Lunga Durata, i tragitti collegati sono coperti al 100 %, senza limiti di distanza.",
      },
      {
        h: "Appuntamenti ricorrenti",
        p: "Dialisi, chemioterapia, radioterapia, fisioterapia: organizziamo i tragitti regolari con orario fisso.",
      },
    ],
    faq: [
      {
        q: "Cosa serve per la fatturazione diretta?",
        a: "La prescrizione medica (buono CERFA) firmata, la tessera Vitale e l'assicurazione integrativa se applicabile.",
      },
      {
        q: "Sono coperto al 100 % in ALD?",
        a: "Sì, al 100 % dall'assicurazione sanitaria per i tragitti collegati alla malattia, senza limite chilometrico.",
      },
      {
        q: "Posso prenotare tragitti ricorrenti (dialisi, chemio)?",
        a: "Sì, stabiliamo un orario fisso per le sedute regolari.",
      },
    ],
    ctaBook: CTA.it.book,
    ctaCall: CTA.it.call,
  },
};

// --------- AR ----------
const AR: Record<LandingKey, LandingContent> = {
  airport: {
    title: "سيارة أجرة مطار بوردو : احجز تاكسي مع خوسيه 24/7",
    description:
      "احجز سيارة أجرة مطار بوردو: متابعة الرحلة، سعر يُذكر عند الحجز، مركبة حتى 4 أشخاص. 24/7. +33 6 73 07 23 22.",
    intro: "احجز سيارة أجرة إلى مطار بوردو في ثوان.\nنتابع رحلتك في الوقت الفعلي ونضبط موعد الاستلام تلقائيًا.",
    sections: [
      {
        h: "تأخرت رحلتك؟ أخبر خوسيه فورًا",
        p: "زودنا برقم الرحلة عند الحجز.\nإذا تأخرت رحلتك أو وصلت مبكرًا، أخبر خوسيه فورًا عبر رسالة نصية أو مكالمة هاتفية على 0033673072322 ليضبط موعد الاستلام.",
      },
      { h: "سعر يُذكر مسبقًا", p: "لا مفاجآت.\nتعرف تقدير السعر قبل الركوب." },
      { h: "أمتعة وعائلات", p: "مركبة واسعة، مقعد أطفال عند الطلب، حتى 4 أشخاص مع الأمتعة." },
    ],
    faq: [
      {
        q: "كم يكلف سيارة أجرة من وسط بوردو إلى المطار؟",
        a: "حوالي 30-45 يورو نهارًا حسب نقطة الانطلاق.\nيُؤكد السعر الدقيق عند الحجز.",
      },
      {
        q: "هل تنتظر السيارة إذا تأخرت رحلتي؟",
        a: "إذا تأخرت رحلتك، أخبر خوسيه فورًا عبر رسالة نصية أو مكالمة هاتفية على 0033673072322 ليضبط موعد الاستلام.\nانتظار معقول بعد الهبوط مشمول.",
      },
      { q: "هل يمكنني الحجز مسبقًا لرحلة مبكرة؟", a: "بالتأكيد.\nنقبل الحجوزات على مدار الساعة." },
    ],
    ctaBook: CTA.ar.book,
    ctaCall: CTA.ar.call,
  },
  station: {
    title: "سيارة أجرة بوردو محطة سان-جان : احجز تاكسي مع خوسيه 24/7",
    description: "احجز سيارة أجرة في محطة بوردو سان-جان: متابعة TGV، استلام على الرصيف، مركبة حتى 4 أشخاص. 24/7.",
    intro: "سيارة أجرة تنتظرك في محطة بوردو سان-جان، أو تأتي لاصطحابك لقطار TGV.\nنتابع قطارك ونضبط الموعد تلقائيًا.",
    sections: [
      { h: "الاستلام في سان-جان", p: "نقطة اللقاء متفق عليها عند الحجز." },
      {
        h: "القطار متأخر؟ أخبر خوسيه فورًا",
        p: "تأخير أو تقديم أو تغيير الرصيف: أخبر خوسيه عبر رسالة نصية أو مكالمة هاتفية على 0033673072322 ليضبط موعد الاستلام.",
      },
      { h: "إلى جميع الوجهات", p: "من سان-جان إلى فندقك، Cité du Vin، مطار بوردو، أركاشون، سانت-إميليون." },
    ],
    faq: [
      { q: "أين تلتقطني السيارة في محطة سان-جان؟", a: "في نقطة اللقاء المتفق عليها.\nنبلغك فور وصول السائق." },
      { q: "هل يمكنني الحجز لقطار ليلي؟", a: "نعم، خدمة 24/7 تشمل القطارات الليلية." },
      {
        q: "هل تحسبون دقائق الانتظار إذا تأخر القطار؟",
        a: "لا للتأخيرات العادية: أخبرنا فورًا عبر رسالة نصية أو مكالمة هاتفية ونضبط الموعد.",
      },
    ],
    ctaBook: CTA.ar.book,
    ctaCall: CTA.ar.call,
  },
  arcachon: {
    title: "سيارة أجرة بوردو ← أركاشون : احجز تاكسي بيلا وكاب-فيري",
    description:
      "احجز سيارة أجرة بوردو ← أركاشون (بيلا، كاب-فيري، الخليج): رحلة مباشرة، سعر يُذكر عند الحجز، مركبة حتى 4 أشخاص للعائلات والحقائب.",
    intro:
      "اذهب إلى خليج أركاشون بسيارة أجرة من وسط بوردو أو مطار بوردو أو محطة سان-جان.\nرحلة مباشرة، سعر معروف مسبقًا.",
    sections: [
      {
        h: "رحلة مباشرة من الباب إلى الباب",
        p: "من فندقك أو المحطة أو المطار إلى مدينة أركاشون، كثبان بيلا، كاب-فيري أو أنديرنوس، بدون تحويل.",
      },
      { h: "سعر يُذكر مسبقًا", p: "سعر تقديري عند الحجز، بدون رسوم خفية." },
      { h: "عودة منظمة", p: "احجز الذهاب والإياب معًا.\nنستقبلك في الوقت والمكان المتفق عليهما." },
    ],
    faq: [
      { q: "كم تستغرق رحلة بوردو ← أركاشون بالسيارة؟", a: "حوالي 55 إلى 75 دقيقة حسب حركة المرور." },
      { q: "ما سعر سيارة أجرة بوردو ← كثبان بيلا؟", a: "يُعطى سعر تقديري عند الحجز حسب نقطة الانطلاق والوقت." },
      { q: "هل يمكن نقل الحقائب أو معدات الشاطئ؟", a: "نعم، مركبة واسعة حتى 4 أشخاص بدون رسوم إضافية." },
    ],
    ctaBook: CTA.ar.book,
    ctaCall: CTA.ar.call,
  },
  cpam: {
    title: "سيارة أجرة معتمدة CPAM بوردو : احجز، فوترة مباشرة، ALD 100%",
    description:
      "احجز سيارة أجرة معتمدة في بوردو: فوترة مباشرة (tiers payant)، ALD 100%، غسيل كلى، كيماوي. مركبة حتى 4 أشخاص.",
    intro:
      "سيارة أجرة معتمدة من التأمين الصحي الفرنسي (CPAM) في بوردو.\nمع وصفة النقل الطبية، تُفوتر الرحلة مباشرة، بدون دفع مسبق.",
    sections: [
      { h: "تغطية CPAM", p: "أحضر قسيمة النقل الموقعة من طبيبك.\nنتولى الفوترة مباشرة." },
      { h: "ALD: تغطية 100 %", p: "في المرض طويل الأمد، الرحلات المرتبطة مغطاة 100 %، بدون حد للمسافة." },
      {
        h: "مواعيد متكررة",
        p: "غسيل الكلى، العلاج الكيميائي، الإشعاعي، العلاج الطبيعي: ننظم رحلاتك المنتظمة بجدول ثابت.",
      },
    ],
    faq: [
      {
        q: "ما الذي أحتاجه للفوترة المباشرة؟",
        a: "وصفة النقل الطبية (قسيمة CERFA) موقعة، بطاقة Vitale، وتأمين تكميلي إن وجد.",
      },
      { q: "هل أنا مغطى 100 % في ALD؟", a: "نعم، 100 % من التأمين الصحي للرحلات المرتبطة بمرضك، بدون حد للكيلومترات." },
      { q: "هل يمكنني حجز رحلات متكررة (غسيل، كيماوي)؟", a: "نعم، نضع جدولاً ثابتاً للجلسات المنتظمة." },
    ],
    ctaBook: CTA.ar.book,
    ctaCall: CTA.ar.call,
  },
};

const ALL: Record<Lang, Record<LandingKey, LandingContent>> = {
  fr: FR,
  en: EN,
  es: ES,
  pt: PT,
  it: IT,
  ar: AR,
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
    fr: "Taxi aéroport de Bordeaux",
    en: "Bordeaux airport taxi",
    es: "Taxi aeropuerto de Burdeos",
    pt: "Táxi aeroporto de Bordéus",
    it: "Taxi aeroporto di Bordeaux",
    ar: "سيارة أجرة مطار بوردو",
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
