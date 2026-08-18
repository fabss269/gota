/**
 * Normaliza el resultado de `require('@/assets/...')` a un URL string usable en
 * `<img src>` o `map.addImage(url)`. En Expo web Metro puede devolver un string
 * directo o un objeto `{ uri }` — este helper cubre ambos casos.
 */
export const resolveAsset = (m: { uri?: string } | string): string =>
  typeof m === 'string' ? m : (m.uri ?? '');
