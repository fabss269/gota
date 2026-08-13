import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Breakpoints del rediseño 2026-08-13 (Edgar): 3 tramos por ancho de ventana,
 * cubren mobile-strict, tablet landscape/portrait y desktop.
 *
 *   mobile:  < 640
 *   tablet:  640 – 1023
 *   desktop: >= 1024
 *
 * Se resuelve con `window.matchMedia` (más barato que un resize listener y
 * dispara sólo al cruzar el umbral). En nativo devuelve 'mobile' por default
 * — los layouts web-only quedan neutrales, no rompen la app RN.
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function detectar(): Breakpoint {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'mobile';
  if (window.matchMedia('(min-width: 1024px)').matches) return 'desktop';
  if (window.matchMedia('(min-width: 640px)').matches) return 'tablet';
  return 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(detectar);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const mMobile = window.matchMedia('(max-width: 639px)');
    const mTablet = window.matchMedia('(min-width: 640px) and (max-width: 1023px)');
    const mDesktop = window.matchMedia('(min-width: 1024px)');
    const update = () => setBp(detectar());
    // Los tres listeners cubren cualquier cruce entre tramos.
    mMobile.addEventListener('change', update);
    mTablet.addEventListener('change', update);
    mDesktop.addEventListener('change', update);
    return () => {
      mMobile.removeEventListener('change', update);
      mTablet.removeEventListener('change', update);
      mDesktop.removeEventListener('change', update);
    };
  }, []);

  return bp;
}

export function esMobile(bp: Breakpoint): boolean {
  return bp === 'mobile';
}

export function esCompacto(bp: Breakpoint): boolean {
  return bp === 'mobile' || bp === 'tablet';
}
