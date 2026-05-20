Configuration OSRM / Géocode

But: Le projet utilise :
- OSRM pour le routage (`src/lib/osrm.ts`).
- Nominatim (par défaut) pour le géocodage via `src/lib/geocode.ts`.

Variables d'environnement (Vite)
- `VITE_OSRM_URL` : URL de votre serveur OSRM (ex: `http://osrm.internal:5000`). Par défaut le helper utilise `https://router.project-osrm.org`.
- `VITE_OSRM_API_KEY` ou `VITE_ORS_API_KEY` : clé publique pour l'API de routage si votre instance ou fournisseur l'exige.
- `VITE_OSRM_KEY_PARAM` : nom du paramètre de requête pour la clé (par défaut `api_key`).
- `VITE_OSRM_AUTH_HEADER` : nom d'en-tête HTTP pour la clé si votre fournisseur attend un header (ex: `Authorization`).
- `VITE_GEOCODER_URL` : URL du service de géocodage (Nominatim ou autre). Par défaut `https://nominatim.openstreetmap.org`.
- `VITE_GEOCODER_API_KEY` : clé pour le géocodeur si votre service exige une authentification.
- `VITE_GEOCODER_KEY_PARAM` : nom du paramètre de requête pour la clé de géocodage (par défaut `key`).

Remarques importantes
- CORS : votre instance OSRM/Nominatim doit autoriser les requêtes depuis l'origine de l'app (en dev `http://localhost:5173` ou l'hôte/VPS en production). Si vous self-hostez derrière un reverse-proxy, activez `Access-Control-Allow-Origin: *` ou la valeur exacte de votre domaine.
- Performance : l'OSRM public (`router.project-osrm.org`) est pratique pour du développement mais n'est pas recommandé en production (quotas, fiabilité). Hébergez un OSRM local ou via un fournisseur.
- Géolocalisation : la position du client est obtenue via l'API native du navigateur (`navigator.geolocation`), donc elle n'a pas besoin de clé d'API supplémentaire.

Tests rapides
1. Pour tester localement, lancez vite avec les variables :

```bash
# PowerShell
$env:VITE_OSRM_URL="http://localhost:5000"; $env:VITE_GEOCODER_URL="http://localhost:7070"; bun dev

# ou sur Linux/macOS
VITE_OSRM_URL=http://localhost:5000 VITE_GEOCODER_URL=http://localhost:7070 bun dev
```

2. Ouvrez l'interface de simulation de tarif et cliquez sur "Utiliser ma position".
3. Vérifiez que les distances/itinéraires se calculent correctement.

Si vous voulez, je peux ajouter un petit script `docker-compose.yml` pour démarrer OSRM + Nominatim localement.
