import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Documento HTML raíz para la versión web.
 * Los meta tags de Apple son esenciales para que Safari oculte
 * la barra del navegador cuando la app se instala desde la pantalla de inicio (PWA).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Viewport: evita zoom y ajusta al dispositivo */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* ===== PWA / iOS Safari ===== */}
        {/* Oculta la barra del navegador en Safari al abrir desde pantalla de inicio */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Estilo de la barra de estado: black-translucent ocupa toda la pantalla */}
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        {/* Nombre que aparece bajo el icono en la pantalla de inicio */}
        <meta name="apple-mobile-web-app-title" content="Nosotros" />

        {/* ===== PWA estándar ===== */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#23C55E" />
        <meta name="application-name" content="Nosotros" />

        {/* Evita que el teléfono detecte automáticamente números como teléfonos */}
        <meta name="format-detection" content="telephone=no" />

        <title>Nosotros</title>

        {/*
         * Expo Router usa un ScrollView de React Native Web que necesita
         * este reset de estilos para funcionar correctamente en web.
         */}
        <ScrollViewStyleReset />

        <style id="expo-pwa-styles">{`
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            /* Soporte para el notch/safe area de iPhone */
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            padding-left: env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
          }
          body {
            overflow: hidden;
            background-color: #0a0a0a;
          }
          #root {
            display: flex;
            height: 100%;
            flex: 1;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
