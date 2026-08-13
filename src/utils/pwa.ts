/**
 * Helpers PWA para Fase 1 — detección de móvil web, detección de "ya instalado"
 * como PWA y hook alrededor del `beforeinstallprompt` que +html.tsx captura
 * temprano en window.
 *
 * Diseño consciente: TODO acá se guarda con `typeof window` y `Platform.OS ===
 * 'web'` porque los módulos se importan también desde builds nativos (RN
 * bundler no distingue import por plataforma para archivos sin sufijo `.web`).
 * Sin los guards, cualquier acceso a `window.*`/`navigator.*` explota en el
 * bundle nativo aunque el código nunca corra ahí.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = any;

declare global {
  interface Window {
    __gotaDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function isWeb(): boolean {
  return Platform.OS === 'web';
}

/** User-agent móvil (Android/iOS). Deliberadamente NO usamos `max-width` de CSS
 * porque laptops con touch cumplen el media query y no queremos redirigirlos al
 * flujo de "instalar app en tu teléfono". */
export function isMobileWeb(): boolean {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** True cuando el usuario abrió la app en modo standalone (ya la tiene
 * instalada como PWA). Chrome/Android usa el media query; iOS Safari usa la
 * bandera legacy `navigator.standalone`. */
export function isPWAInstalled(): boolean {
  if (!isWeb() || typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((navigator as any).standalone === true) return true;
  return false;
}

/** iOS Safari no expone el evento `beforeinstallprompt` — la única forma es
 * "Compartir → Añadir a pantalla de inicio" a mano. Se distingue del resto de
 * móviles para mostrar instrucciones diferentes. */
export function isIOS(): boolean {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  // iPadOS 13+ se anuncia como Mac; el heurístico "Mac con touch" lo pesca.
  const ua = navigator.userAgent;
  const iOSClasico = /iPhone|iPad|iPod/i.test(ua);
  const iPadMasked = /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
  return iOSClasico || iPadMasked;
}

type PwaInstallState = {
  /** Chrome/Android capturó el prompt y podemos dispararlo con install(). */
  canInstall: boolean;
  /** Ya se instaló (o se detectó como PWA standalone). */
  installed: boolean;
  /** Dispara el prompt nativo. Rechaza si canInstall es false (iOS, o el
   * navegador todavía no expuso el evento). Devuelve la elección del usuario. */
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
};

export function usePwaInstall(): PwaInstallState {
  const [canInstall, setCanInstall] = useState<boolean>(
    () => isWeb() && typeof window !== 'undefined' && !!window.__gotaDeferredPrompt
  );
  const [installed, setInstalled] = useState<boolean>(isPWAInstalled());

  useEffect(() => {
    if (!isWeb()) return;
    const onAvail = () => setCanInstall(true);
    const onInstalled = () => {
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener('gota:install-available', onAvail);
    window.addEventListener('gota:installed', onInstalled);
    return () => {
      window.removeEventListener('gota:install-available', onAvail);
      window.removeEventListener('gota:installed', onInstalled);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!isWeb() || typeof window === 'undefined') return 'unavailable';
    const deferred = window.__gotaDeferredPrompt;
    if (!deferred || typeof deferred.prompt !== 'function') return 'unavailable';
    deferred.prompt();
    const choice = await deferred.userChoice;
    window.__gotaDeferredPrompt = null;
    setCanInstall(false);
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  };

  return { canInstall, installed, install };
}
