// ─────────────────────────────────────────────────────────────
//  PATCH reserver.tsx — lire ?passagers= au mount
// ─────────────────────────────────────────────────────────────

// REMPLACER ce bloc (ligne ~838) :

const [f, setF] = useState<FormState>(() => {
  // Pré-remplir depuis les query params (?depart=...&destination=...)
  // Ex: venant de "Réserver la même course" dans l'espace client.
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  return {
    depart: params?.get("depart") ?? "",
    destination: params?.get("destination") ?? "",
    date: "",
    heure: "",
    passagers: 1,
    bagages: 0,
    paiement: "cb",
    prenom: "",
    nom: "",
    phone: "",
    email: "",
  };
});

// PAR :

const [f, setF] = useState<FormState>(() => {
  // Pré-remplir depuis les query params (?depart=...&destination=...&passagers=N)
  // Ex: venant de "Réserver le même trajet" depuis suivi.$id
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const passagersParam = parseInt(params?.get("passagers") ?? "1", 10);
  return {
    depart: params?.get("depart") ?? "",
    destination: params?.get("destination") ?? "",
    date: "",
    heure: "",
    passagers: Number.isFinite(passagersParam) && passagersParam >= 1 && passagersParam <= 6 ? passagersParam : 1,
    bagages: 0,
    paiement: "cb",
    prenom: "",
    nom: "",
    phone: "",
    email: "",
  };
});

// ─── Optionnel : résoudre automatiquement les adresses pré-remplies ───
// Ajouter ce useEffect après la déclaration de `f` et `set` :

useEffect(() => {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const hasPreFill = params?.get("depart") || params?.get("destination");
  if (!hasPreFill) return;
  // Court délai pour que les refs de résolution soient montées
  const t = setTimeout(() => {
    if (params?.get("depart")) resolveDepartAddressRef.current?.();
    if (params?.get("destination")) setTimeout(() => resolveDestinationAddressRef.current?.(), 600);
  }, 400);
  return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // run once on mount
