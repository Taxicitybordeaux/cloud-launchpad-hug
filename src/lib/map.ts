const DEFAULT_TILE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_OSM_TILE_URL
  ? (import.meta.env.VITE_OSM_TILE_URL as string)
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const DEFAULT_TILE_ATTRIBUTION = typeof import.meta !== 'undefined' && import.meta.env?.VITE_OSM_TILE_ATTRIBUTION
  ? (import.meta.env.VITE_OSM_TILE_ATTRIBUTION as string)
  : '© OpenStreetMap contributors';

const DEFAULT_TILE_SUBDOMAINS = typeof import.meta !== 'undefined' && import.meta.env?.VITE_OSM_TILE_SUBDOMAINS
  ? (import.meta.env.VITE_OSM_TILE_SUBDOMAINS as string).split(',').map((s) => s.trim()).filter(Boolean)
  : ['a', 'b', 'c'];

export const OSM_TILE_URL = DEFAULT_TILE_URL.replace(/\/+$/g, '');
export const OSM_TILE_ATTRIBUTION = DEFAULT_TILE_ATTRIBUTION;
export const OSM_TILE_SUBDOMAINS = DEFAULT_TILE_SUBDOMAINS.length > 0 ? DEFAULT_TILE_SUBDOMAINS : ['a', 'b', 'c'];

export const OSM_TILE_OPTIONS = {
  maxZoom: 19,
  attribution: OSM_TILE_ATTRIBUTION,
  subdomains: OSM_TILE_SUBDOMAINS,
};

export default {
  OSM_TILE_URL,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_OPTIONS,
};
