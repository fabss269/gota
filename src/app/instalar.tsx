import { Redirect } from 'expo-router';

/**
 * Fallback nativo del route `/instalar`. La landing PWA (`instalar.web.tsx`)
 * solo tiene sentido en el navegador — en la app nativa no hay nada que
 * instalar. Requerido por expo-router aunque el flujo real jamás lo alcance
 * porque `index.tsx` solo redirige a `/instalar` cuando `isMobileWeb()` es
 * true, y eso es false en RN nativo.
 */
export default function InstalarNativoFallback() {
  return <Redirect href="/(app)/mapa" />;
}
