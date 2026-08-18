import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* PWA — manifest + colores. Los assets viven en public/ y Expo los copia
            al build estático tal cual. iOS ignora manifest.webmanifest, hay que
            declarar aparte apple-mobile-web-app-* y apple-touch-icon. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0D2B52" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GOTA" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&family=Manrope:wght@600;700;800&family=Montserrat:wght@800;900&display=swap"
        />
        <ScrollViewStyleReset />
        {/* Registro del service worker (Fase 1 — passthrough, ver public/sw.js).
            El SW es el requisito de Chrome/Edge para ofrecer "Instalar app"; sin
            un SW registrado con fetch handler, `beforeinstallprompt` nunca
            dispara. Va inline para que corra antes que cualquier fetch de la
            app y no dependa de que un bundle JS cargue primero. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function (e) {
                    console.warn('SW register failed:', e);
                  });
                });
              }
              // Captura temprana del prompt de instalación — beforeinstallprompt
              // dispara UNA sola vez y muy temprano; si React no ha montado la
              // pantalla de /instalar todavía, el evento se pierde. Lo
              // guardamos en window.__gotaDeferredPrompt y notificamos con un
              // CustomEvent para que el hook usePwaInstall pueda hidratarse.
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.__gotaDeferredPrompt = e;
                window.dispatchEvent(new CustomEvent('gota:install-available'));
              });
              window.addEventListener('appinstalled', function () {
                window.__gotaDeferredPrompt = null;
                window.dispatchEvent(new CustomEvent('gota:installed'));
              });
            `,
          }}
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            *, *::before, *::after { box-sizing: border-box; }
            html, body, #root {
              font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              margin: 0;
              padding: 0;
            }
            input, button, select, textarea {
              font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            }
          `,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
