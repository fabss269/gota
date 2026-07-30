// Cliente de Nominatim (OpenStreetMap) — geocoding gratuito, sin API key.
// Política de uso (https://operations.osmfoundation.org/policies/nominatim/):
//   - Máx. 1 request/seg — por eso el buscador debounce-a antes de llamar.
//   - Piden un User-Agent o Referer que identifique la app: los navegadores no dejan
//     setear User-Agent desde fetch(), así que dependemos del Referer que el propio
//     navegador manda automáticamente con la URL de la app.
//   - No usar para autocompletar tecla por tecla sin debounce (correríamos riesgo de
//     que bloqueen el IP).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

// Unión de los bbox de las 3 provincias de Lambayeque (mismo bbox que ya calculamos
// en el backend para provincias/distritos/sectores) — acota los resultados a la zona
// de cobertura de EPSEL en vez de buscar en todo el Perú/mundo.
const LAMBAYEQUE_VIEWBOX = '-80.627,-5.480,-79.121,-7.177';

export type DireccionResultado = {
  label: string;
  lat: number;
  lon: number;
};

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
};

export async function buscarDireccion(
  query: string,
  signal?: AbortSignal
): Promise<DireccionResultado[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'pe',
    viewbox: LAMBAYEQUE_VIEWBOX,
    bounded: '1',
    'accept-language': 'es',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error('No se pudo buscar la dirección');

  const data: NominatimItem[] = await res.json();
  return data.map((item) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
  }));
}
