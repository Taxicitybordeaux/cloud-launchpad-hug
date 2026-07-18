// Contenu multilingue pour les 4 pages SEO locales (aéroport, gare, Arcachon, conventionné)
// Langues : fr, en, es, pt, it, ar

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

// --------- FR (source) ----------
const FR: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Taxi Aéroport Bordeaux-Mérignac — Prise en charge 24h/24",
    description:
      "Taxi vers ou depuis l'aéroport Bordeaux-Mérignac : suivi de vol en temps réel, tarif transparent, véhicule confortable, disponible 7j/7.",
    intro:
      "Réservez votre taxi pour l'aéroport de Bordeaux-Mérignac en quelques secondes. Nous suivons votre vol en temps réel et adaptons l'heure de prise en charge : votre chauffeur est là à votre sortie, même en cas de retard ou d'arrivée anticipée.",
    sections: [
      {
        h: "Suivi de vol automatique",
        p: "Communiquez-nous votre numéro de vol : l'heure de prise en charge s'ajuste automatiquement à l'atterrissage réel, sans surcoût.",
      },
      {
        h: "Tarif fixe annoncé à l'avance",
        p: "Pas de mauvaise surprise. Vous connaissez le prix de la course Bordeaux ↔ Aéroport Mérignac avant de monter à bord.",
      },
      {
        h: "Bagages, familles, groupes",
        p: "Véhicule spacieux, siège enfant sur demande, jusqu'à 7 places pour vos bagages et vos proches.",
      },
    ],
    faq: [
      {
        q: "Combien coûte un taxi de Bordeaux centre à l'aéroport de Mérignac ?",
        a: "Comptez environ 30 à 45 € en journée selon le point de départ. Le tarif exact est confirmé lors de votre réservation.",
      },
      {
        q: "Le taxi attend-il si mon vol est retardé ?",
        a: "Oui. Nous suivons votre vol en temps réel et ajustons l'horaire — le temps d'attente raisonnable après atterrissage est inclus.",
      },
      {
        q: "Puis-je réserver à l'avance pour un vol tôt le matin ?",
        a: "Absolument. Nous acceptons les réservations 24h/24, y compris pour les prises en charge nocturnes ou aux premières heures.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  station: {
    title: "Taxi Gare Saint-Jean Bordeaux — Réservation en ligne 24h/24",
    description:
      "Taxi pour la gare Saint-Jean de Bordeaux : suivi de train, prise en charge immédiate ou réservée, tarif clair. Disponible tous les jours.",
    intro:
      "Un taxi vous attend à la gare de Bordeaux Saint-Jean, ou vient vous chercher pour votre TGV. Nous suivons votre train et adaptons l'heure de prise en charge automatiquement.",
    sections: [
      {
        h: "Prise en charge à Saint-Jean",
        p: "Point de rendez-vous convenu à la réservation : dépose-minute, parvis, ou parking. Votre chauffeur vous localise et vous appelle si besoin.",
      },
      {
        h: "Suivi TGV en temps réel",
        p: "Retard, avance, changement de voie : l'horaire est ajusté automatiquement. Vous n'avez rien à faire.",
      },
      {
        h: "Vers toutes les destinations",
        p: "Depuis Saint-Jean vers votre hôtel, la Cité du Vin, Mérignac aéroport, Arcachon, Saint-Émilion ou toute la Métropole.",
      },
    ],
    faq: [
      {
        q: "Où le taxi me récupère-t-il à la gare Saint-Jean ?",
        a: "Au point de rendez-vous convenu (parvis principal, dépose-minute ou parking selon vos préférences). Nous vous prévenons dès l'arrivée du chauffeur.",
      },
      {
        q: "Puis-je réserver pour un TGV de nuit ?",
        a: "Oui, service 7j/7 24h/24 — y compris pour les trains de nuit et les premières liaisons du matin.",
      },
      {
        q: "Comptez-vous les minutes d'attente si mon train a du retard ?",
        a: "Non pour les retards standards : nous suivons votre train et adaptons l'horaire. Une attente prolongée peut être facturée au tarif réglementé.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  arcachon: {
    title: "Taxi Bordeaux → Arcachon — Transfert direct, tarif clair",
    description:
      "Taxi de Bordeaux vers Arcachon (Bassin, Cap-Ferret, Pyla) : trajet direct, réservation à l'avance, tarif annoncé, véhicule confortable pour bagages et famille.",
    intro:
      "Rejoignez le Bassin d'Arcachon en taxi depuis Bordeaux centre, l'aéroport de Mérignac ou la gare Saint-Jean. Trajet direct, prix connu d'avance, sans changement.",
    sections: [
      {
        h: "Trajet direct porte-à-porte",
        p: "De votre hôtel, gare ou aéroport de Bordeaux, jusqu'à Arcachon ville, la Dune du Pyla, le Cap-Ferret ou Andernos — sans transfert.",
      },
      {
        h: "Tarif forfaitaire",
        p: "Prix annoncé à la réservation, sans surcharge cachée. Idéal pour les familles, les groupes ou les touristes avec bagages.",
      },
      {
        h: "Retour organisé",
        p: "Réservez l'aller ET le retour en une seule fois. Nous vous récupérons à l'heure et au lieu convenus.",
      },
    ],
    faq: [
      {
        q: "Combien de temps de trajet Bordeaux → Arcachon en taxi ?",
        a: "Environ 55 à 75 minutes selon la circulation et le point d'arrivée sur le Bassin.",
      },
      {
        q: "Quel prix pour un taxi Bordeaux → Dune du Pyla ?",
        a: "Le tarif forfaitaire est confirmé lors de votre réservation en fonction du point de départ et de l'horaire.",
      },
      {
        q: "Peut-on transporter des valises ou du matériel de plage ?",
        a: "Oui, véhicule spacieux jusqu'à 7 places, bagages, poussettes et matériel de plage acceptés sans supplément.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
  cpam: {
    title: "Taxi Conventionné CPAM Bordeaux — Tiers Payant, ALD, Dialyse",
    description:
      "Taxi conventionné Assurance Maladie à Bordeaux : transport médical assis, tiers payant CPAM, ALD, dialyse, chimiothérapie, consultations hospitalières.",
    intro:
      "Taxi conventionné par l'Assurance Maladie à Bordeaux. Sur présentation de votre prescription médicale de transport, la course est prise en charge directement — sans avance de frais grâce au tiers payant.",
    sections: [
      {
        h: "Prise en charge CPAM",
        p: "Munissez-vous de votre bon de transport signé par votre médecin. Nous nous chargeons de la facturation directement auprès de l'Assurance Maladie.",
      },
      {
        h: "ALD : prise en charge à 100 %",
        p: "En Affection Longue Durée (ALD), vos trajets liés à la pathologie sont pris en charge à 100 %, quelle que soit la distance.",
      },
      {
        h: "Rendez-vous récurrents",
        p: "Dialyse, chimiothérapie, radiothérapie, kinésithérapie : nous organisons vos trajets réguliers avec un horaire fixe et un chauffeur habitué.",
      },
    ],
    faq: [
      {
        q: "Que faut-il pour bénéficier du tiers payant ?",
        a: "Votre prescription médicale de transport (bon de transport CERFA) signée par votre médecin, votre carte Vitale et votre attestation de mutuelle si nécessaire.",
      },
      {
        q: "Suis-je pris en charge à 100 % en ALD ?",
        a: "Oui, à 100 % par l'Assurance Maladie pour les trajets liés à votre affection longue durée, sans plafond kilométrique.",
      },
      {
        q: "Puis-je réserver des trajets récurrents (dialyse, chimio) ?",
        a: "Oui, nous mettons en place un planning fixe pour vos séances régulières. Contactez-nous pour organiser vos rendez-vous.",
      },
    ],
    ctaBook: CTA.fr.book,
    ctaCall: CTA.fr.call,
  },
};

// --------- EN ----------
const EN: Record<LandingKey, LandingContent> = {
  airport: {
    title: "Bordeaux-Mérignac Airport Taxi — 24/7 pickup",
    description:
      "Taxi to or from Bordeaux-Mérignac Airport: real-time flight tracking, transparent flat rate, comfortable vehicle, available 7 days a week.",
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
    title: "Taxi Bordeaux Saint-Jean Station — Online booking 24/7",
    description:
      "Taxi to Bordeaux Saint-Jean train station: live train tracking, immediate or pre-booked pickup, clear pricing. Available every day.",
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
    title: "Taxi Bordeaux → Arcachon — Direct transfer, clear pricing",
    description:
      "Taxi from Bordeaux to Arcachon (Bay, Cap-Ferret, Pyla): direct trip, advance booking, upfront fare, comfortable vehicle for luggage and family.",
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
    title: "Approved Medical Taxi Bordeaux — Direct billing, ALD, dialysis",
    description:
      "Medical taxi approved by French health insurance in Bordeaux: seated medical transport, direct billing (tiers payant), ALD, dialysis, chemotherapy, hospital visits.",
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
    title: "Taxi Aeropuerto Burdeos-Mérignac — Servicio 24/7",
    description: "Taxi hacia o desde el aeropuerto Burdeos-Mérignac: seguimiento de vuelo en tiempo real, tarifa fija transparente, vehículo cómodo, 7 días a la semana.",
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
    description: "سيارة أجرة معتمدة من التأمين الصحي الفرنسي في بوردو: نقل طبي جالس، فوترة مباشرة، ALD، غسيل الكلى، العلاج الكيميائي.",
    intro: "سيارة أجرة معتمدة من التأمين الصحي الفرنسي (CPAM) في بوردو. مع وصفة النقل الطبية، تُفوتر الرحلة مباشرة.",
    sections: [
      { h: "تغطية CPAM", p: "أحضر قسيمة النقل الموقعة من طبيبك. نتولى الفوترة مباشرة." },
      { h: "ALD: تغطية 100%", p: "في حالة المرض طويل الأمد، الرحلات المرتبطة مغطاة 100%، بدون حد للمسافة." },
      { h: "مواعيد متكررة", p: "غسيل الكلى، العلاج الكيميائي، العلاج الطبيعي: ننظم رحلاتك المنتظمة بجدول ثابت." },
    ],
    faq: [
      { q: "ما المطلوب للفوترة المباشرة؟", a: "وصفة النقل (قسيمة CERFA) الموقعة، بطاقة Vitale، والتأمين التكميلي عند الاقتضاء." },
      { q: "هل أنا مغطى 100% في ALD؟", a: "نعم، 100% من التأمين الصحي للرحلات المرتبطة بمرضك، بدون حد كيلومتري." },
      { q: "هل يمكنني حجز رحلات متكررة؟", a: "نعم، نضع جدولًا ثابتًا لجلساتك المنتظمة." },
    ],
    ctaBook: CTA.ar.book, ctaCall: CTA.ar.call,
  },
};

export const LANDING: Record<Lang, Record<LandingKey, LandingContent>> = {
  fr: FR, en: EN, es: ES, pt: PT, it: IT, ar: AR,
};

export function getLanding(lang: Lang, key: LandingKey): LandingContent {
  return LANDING[lang]?.[key] ?? LANDING.fr[key];
}
